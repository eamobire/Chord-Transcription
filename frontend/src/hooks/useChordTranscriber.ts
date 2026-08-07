import { useState, useCallback, useEffect } from 'react';
import type { ChordData } from '@/types/audio';

// Essentia.js usually needs to be loaded from a WASM/CDN or as a worker
// For this implementation, we assume it's installed via npm and available

export const useChordTranscriber = () => {
    const [chords, setChords] = useState<ChordData[]>([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [progress, setProgress] = useState(0);

    const transcribeAudio = useCallback(async (audioBuffer: AudioBuffer) => {
        setIsTranscribing(true);
        setProgress(0);

        try {
            console.log("[Studio-Diagnostic] Starting transcription logic...");

            // Use explicit ES builds and handle potential default/named export variations
            const EssentiaCore = await import('essentia.js/dist/essentia.js-core.es.js').then(m => m.default || m);
            // Some builds put the class inside the module, others ARE the class
            const Essentia = EssentiaCore.Essentia || EssentiaCore;

            console.log("[Studio-Diagnostic] Essentia class resolved:", typeof Essentia);

            const EssentiaWASM = await import('essentia.js/dist/essentia-wasm.web.js').then(m => m.default || m);

            let wasmModule = EssentiaWASM;
            if (typeof wasmModule === 'function') {
                console.log("[Studio-Diagnostic] EssentiaWASM is a factory, initializing...");
                wasmModule = await wasmModule({
                    locateFile: (path: string) => {
                        if (path.endsWith('.wasm')) return '/essentia/essentia-wasm.web.wasm';
                        return path;
                    }
                });
            }

            console.log("[Studio-Diagnostic] WASM Module loaded. Keys:", Object.keys(wasmModule || {}));

            // Defensive check for the EssentiaJS constructor
            let backend = wasmModule;
            if (!backend.EssentiaJS && backend.Module?.EssentiaJS) {
                console.log("[Studio-Diagnostic] Found EssentiaJS in .Module sub-object");
                backend = backend.Module;
            } else if (!backend.EssentiaJS && backend.default?.EssentiaJS) {
                console.log("[Studio-Diagnostic] Found EssentiaJS in .default sub-object");
                backend = backend.default;
            }

            if (!backend || !backend.EssentiaJS) {
                console.error("[Studio-Diagnostic] CRITICAL: EssentiaJS constructor not found in backend!", backend);
                throw new Error(`Initialization failed: EssentiaJS not found. Available keys: ${Object.keys(wasmModule).join(', ')}`);
            }

            const essentia = new Essentia(backend);
            console.log("[Studio-Diagnostic] Essentia.js engine active and ready.");

            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;

            const frameSize = 4096;
            const hopSize = 2048;

            const numFrames = Math.floor((channelData.length - frameSize) / hopSize) + 1;
            console.log(`Processing ${numFrames} frames...`);
            const discoveredChords: ChordData[] = [];

            const hpcps: any[] = [];

            for (let i = 0; i < numFrames; i++) {
                const start = i * hopSize;
                const end = start + frameSize;
                const frame = channelData.slice(start, end);

                const frameVec = essentia.arrayToVector(frame);

                // 1. Windowing
                const winResult = essentia.Windowing(frameVec, "hann");
                const windowed = winResult.vector || winResult.frame;

                if (!windowed) {
                    frameVec.delete();
                    continue;
                }

                // 2. Spectrum
                const specResult = essentia.Spectrum(windowed);
                const spectrum = specResult.spectrum || specResult.vector;

                if (!spectrum) {
                    frameVec.delete();
                    windowed.delete();
                    continue;
                }

                // 3. SpectralPeaks
                const peaksResult = essentia.SpectralPeaks(spectrum, undefined, undefined, undefined, undefined, undefined, sampleRate);
                const frequencies = peaksResult.frequencies;
                const magnitudes = peaksResult.magnitudes;

                if (!frequencies || !magnitudes || frequencies.size() === 0) {
                    frameVec.delete();
                    windowed.delete();
                    spectrum.delete();
                    if (frequencies) frequencies.delete();
                    if (magnitudes) magnitudes.delete();
                    continue;
                }

                // 4. HPCP
                const hpcpResult = essentia.HPCP(frequencies, magnitudes, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, sampleRate);
                const hpcpVec = hpcpResult.hpcp || hpcpResult.vector;

                if (i === 0) {
                    console.log("[Studio-Diagnostic] Frame 0 validation pass:", {
                        hasFrameVec: !!frameVec,
                        hasWindowed: !!windowed,
                        hasSpectrum: !!spectrum,
                        hasFrequencies: !!frequencies,
                        hasMagnitudes: !!magnitudes,
                        hasHPCP: !!hpcpVec
                    });
                }

                if (!hpcpVec) {
                    frameVec.delete();
                    windowed.delete();
                    spectrum.delete();
                    frequencies.delete();
                    magnitudes.delete();
                    continue;
                }

                hpcps.push(hpcpVec);

                // Cleanup WASM memory
                frameVec.delete();
                windowed?.delete();
                spectrum?.delete();
                frequencies.delete();
                magnitudes.delete();
                // hpcpVec will be deleted after ChordsDetection

                if (i % 100 === 0) {
                    setProgress(Math.round((i / numFrames) * 100));
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            console.log("Frame processing complete. Detecting chords...");

            if (hpcps.length === 0) {
                throw new Error("No harmonic content detected in the audio file.");
            }

            const hpcpMatrix = new essentia.module.VectorVectorFloat();
            for (const h of hpcps) {
                hpcpMatrix.push_back(h);
            }
            const results = essentia.ChordsDetection(hpcpMatrix, hopSize, sampleRate);

            // VectorString from WASM cannot use vectorToArray (designed for VectorFloat).
            // We must iterate manually using the Emscripten binding API.
            const chordsVec = results.chords;
            const rawChords: string[] = [];
            for (let j = 0; j < chordsVec.size(); j++) {
                rawChords.push(chordsVec.get(j) as string);
            }
            console.log(`[Studio-Diagnostic] First 5 raw chords:`, rawChords.slice(0, 5));

            // Cleanup matrix and result vectors
            hpcpMatrix.delete();
            results.chords.delete();
            results.strength.delete();
            for (const h of hpcps) {
                h.delete();
            }

            let lastChord = "";
            for (let i = 0; i < rawChords.length; i++) {
                const chord = rawChords[i];
                if (chord !== lastChord) {
                    const time = (i * hopSize) / audioBuffer.sampleRate;
                    discoveredChords.push({ time, chord });
                    lastChord = chord;
                }
            }
            console.log(`Chord detection complete. Found ${discoveredChords.length} unique chord changes.`);

            setChords(discoveredChords);
            setIsTranscribing(false);
            return discoveredChords;

        } catch (error) {
            console.error("Transcription error:", error);
            setIsTranscribing(false);
            throw error;
        }
    }, [setChords]);

    return {
        chords,
        setChords,
        isTranscribing,
        progress,
        transcribeAudio
    };
};

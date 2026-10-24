"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { Play, Pause, SkipBack, Repeat, X } from 'lucide-react';

export interface Selection {
    start: number;
    end: number;
}

interface WavesurferPlayerProps {
    url: string | null;
    onReady?: (wavesurfer: WaveSurfer) => void;
    onTimeUpdate?: (time: number) => void;
    onSelectionChange?: (selection: Selection | null) => void;
}

const SPEEDS = [1, 0.75, 0.5, 0.25];

export const WavesurferPlayer: React.FC<WavesurferPlayerProps> = ({ url, onReady, onTimeUpdate, onSelectionChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<RegionsPlugin | null>(null);
    const regionRef = useRef<Region | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [isLooping, setIsLooping] = useState(true);
    const [speed, setSpeed] = useState(1);
    const isLoopingRef = useRef(isLooping);
    const onReadyRef = useRef(onReady);
    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onSelectionChangeRef = useRef(onSelectionChange);

    // Update refs when props change
    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

    useEffect(() => {
        onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
        isLoopingRef.current = isLooping;
    }, [isLooping]);

    useEffect(() => {
        if (!containerRef.current || !url) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#4f4f4f',
            progressColor: '#8b5cf6',
            cursorColor: '#ffffff',
            barWidth: 2,
            barRadius: 3,
            height: 100,
            normalize: true,
        });

        // Drag on the waveform to select a loop; only one selection at a time
        const regions = ws.registerPlugin(RegionsPlugin.create());
        regionsRef.current = regions;
        regions.enableDragSelection({ color: 'rgba(139, 92, 246, 0.25)' });

        const reportSelection = (region: Region) => {
            regionRef.current = region;
            setHasSelection(true);
            onSelectionChangeRef.current?.({ start: region.start, end: region.end });
        };

        regions.on('region-created', (region) => {
            for (const other of regions.getRegions()) {
                if (other !== region) other.remove();
            }
            reportSelection(region);
        });
        regions.on('region-updated', reportSelection);
        regions.on('region-clicked', (region, e) => {
            e.stopPropagation();
            region.play();
        });
        // Jump back to the start when playback runs off the end of the loop,
        // but not when the user has clicked somewhere else on the waveform
        regions.on('region-out', (region) => {
            const time = ws.getCurrentTime();
            if (isLoopingRef.current && region === regionRef.current && ws.isPlaying()
                && time >= region.end - 0.05 && time < region.end + 0.5) {
                region.play();
            }
        });

        // Destroying the player mid-load (e.g. a quick unmount) aborts the fetch; that's expected
        ws.load(url).catch((e) => {
            if (e?.name !== 'AbortError') console.error("[Studio-Diagnostic] Failed to load audio:", e);
        });

        ws.on('ready', () => {
            wavesurferRef.current = ws;
            onReadyRef.current?.(ws);
        });

        // timeupdate also fires on seeks and clicks, so the live spectrum follows the playhead when paused
        ws.on('timeupdate', () => {
            onTimeUpdateRef.current?.(ws.getCurrentTime());
        });

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));

        return () => {
            try {
                console.log("[Studio-Diagnostic] Cleaning up Wavesurfer instance...");
                ws.unAll();
                ws.destroy();
            } catch (e) {
                // Suppress AbortError which is common during rapid unmounts
                console.warn("[Studio-Diagnostic] Wavesurfer cleanup suppressed error:", e);
            }
            wavesurferRef.current = null;
            regionsRef.current = null;
            regionRef.current = null;
            setHasSelection(false);
            onSelectionChangeRef.current?.(null);
        };
    }, [url]);

    const togglePlay = useCallback(() => {
        const ws = wavesurferRef.current;
        const region = regionRef.current;
        if (!ws) return;
        // When looping, start from the loop if the playhead is outside it
        if (!ws.isPlaying() && isLoopingRef.current && region) {
            const time = ws.getCurrentTime();
            if (time < region.start || time >= region.end) {
                region.play();
                return;
            }
        }
        ws.playPause();
    }, []);

    const reset = useCallback(() => {
        wavesurferRef.current?.stop();
    }, []);

    const clearSelection = useCallback(() => {
        regionsRef.current?.clearRegions();
        regionRef.current = null;
        setHasSelection(false);
        onSelectionChangeRef.current?.(null);
    }, []);

    const changeSpeed = useCallback((rate: number) => {
        setSpeed(rate);
        // Second argument keeps the pitch unchanged while slowing down
        wavesurferRef.current?.setPlaybackRate(rate, true);
    }, []);

    if (!url) return null;

    return (
        <div className="w-full studio-card p-6 mt-6">
            <div ref={containerRef} className="w-full mb-2" />
            <p className="text-[11px] text-white/30 mb-4">
                Drag across the waveform to select a loop and see its notes and chord guesses.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                <button
                    onClick={reset}
                    aria-label="Back to start"
                    className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/70"
                >
                    <SkipBack size={24} />
                </button>

                <button
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="w-12 h-12 flex items-center justify-center bg-purple-600 rounded-full hover:bg-purple-500 transition-all transform hover:scale-105 neon-border"
                >
                    {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
                </button>

                <div className="text-sm font-mono text-white/50 w-20">
                    {wavesurferRef.current?.getCurrentTime().toFixed(2)}s
                </div>

                <button
                    onClick={() => setIsLooping(l => !l)}
                    aria-pressed={isLooping}
                    title="Loop the selection"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isLooping ? 'border-purple-500/60 text-purple-300 bg-purple-500/10' : 'border-white/10 text-white/50 hover:bg-white/5'}`}
                >
                    <Repeat size={14} />
                    Loop
                </button>

                {hasSelection && (
                    <button
                        onClick={clearSelection}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:bg-white/5 transition-colors"
                    >
                        <X size={14} />
                        Clear selection
                    </button>
                )}

                <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
                    {SPEEDS.map(rate => (
                        <button
                            key={rate}
                            onClick={() => changeSpeed(rate)}
                            aria-pressed={speed === rate}
                            className={`px-2 py-1 rounded-md text-xs font-mono transition-colors ${speed === rate ? 'bg-white/15 text-white' : 'text-white/40 hover:bg-white/5'}`}
                        >
                            {rate}×
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

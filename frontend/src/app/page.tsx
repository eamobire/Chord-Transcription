"use client";

import { useState, useCallback, useRef } from 'react';
import { Upload, Music, Loader2, Download, Keyboard } from 'lucide-react';
import { WavesurferPlayer } from '@/components/WavesurferPlayer';
import { ChordDisplay } from '@/components/ChordDisplay';
import { useChordTranscriber } from '@/hooks/useChordTranscriber';
import type { ChordData } from '@/types/audio';

export default function Home() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { chords, setChords, isTranscribing, progress, transcribeAudio } = useChordTranscriber();
  const [currentChord, setCurrentChord] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Prepare for transcription
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const result = await transcribeAudio(audioBuffer);

      if (result && result.length > 0) {
        setChords(result);
      } else {
        throw new Error("No chords detected in this audio file.");
      }
    } catch (err: any) {
      console.error("Failed to transcribe", err);
      setError(err.message || "An unexpected error occurred during transcription.");
      // Fallback to mock data for visibility if needed, but for now let's show the error
    } finally {
      await audioContext.close();
    }
  }, [transcribeAudio, setChords]);

  const onTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);

    // Efficiently find the current chord based on time
    const activeChord = chords.reduce((prev: ChordData | null, curr) => {
      if (curr.time <= time) return curr;
      return prev;
    }, null);

    setCurrentChord(activeChord ? activeChord.chord : null);
  }, [chords]);

  const handleExportMidi = useCallback(async () => {
    if (chords.length === 0) return;

    try {
      const response = await fetch('http://localhost:8001/midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chords }),
      });

      const data = await response.json();
      if (data.midi_url) {
        window.open(`http://localhost:8001${data.midi_url}`, '_blank');
      }
    } catch (err) {
      console.error("Failed to export MIDI", err);
    }
  }, [chords]);

  return (
    <main className="min-h-screen flex flex-col items-center p-8 bg-[#121212] selection:bg-purple-500/30">
      <header className="w-full max-w-6xl flex justify-between items-center mb-16">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/20">
            <Music className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Chord<span className="text-purple-500">Magic</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/60">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Essentia.js Engine Active
          </div>
          <button className="p-2 rounded-full hover:bg-white/5 text-white/40 transition-colors">
            <Keyboard size={20} />
          </button>
        </div>
      </header>

      <div className="w-full max-w-4xl flex flex-col items-center">
        {!audioUrl ? (
          <div className="w-full aspect-video studio-card flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-purple-500/40 transition-all cursor-pointer group relative">
            <input
              type="file"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              accept="audio/*"
            />
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload className="text-white/40 group-hover:text-purple-400" size={32} />
            </div>
            <p className="text-lg font-medium text-white/80">Drop your music here</p>
            <p className="text-sm text-white/40 mt-1">WAV, MP3, or AIFF up to 50MB</p>
          </div>
        ) : (
          <>
            <WavesurferPlayer url={audioUrl} onTimeUpdate={onTimeUpdate} />

            {isTranscribing ? (
              <div className="flex flex-col items-center gap-4 mt-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                <p className="text-white/60 font-mono text-sm tracking-widest uppercase">
                  Analyzing Harmonics... {progress}%
                </p>
                <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300 shadow-[0_0_8px_#8b5cf6]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : error ? (
              <div className="mt-12 p-6 studio-card border-red-500/20 bg-red-500/5 flex flex-col items-center gap-4">
                <div className="text-red-400 text-sm font-semibold tracking-wide uppercase">Extraction Failed</div>
                <p className="text-white/70 text-center max-w-md">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <ChordDisplay
                currentChord={currentChord}
                allChords={chords}
                currentTime={currentTime}
              />
            )}

            <div className="mt-12 flex gap-4">
              <button
                onClick={handleExportMidi}
                disabled={isTranscribing || chords.length === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
              >
                <Download size={18} className="text-purple-400 group-hover:translate-y-0.5 transition-transform" />
                <span className="text-sm font-semibold">Export MIDI</span>
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="mt-auto pt-20 pb-8 text-white/20 text-[10px] font-medium tracking-[0.2em] uppercase">
        Pro Studio Edition • Powered by Essentia.js
      </footer>
    </main>
  );
}

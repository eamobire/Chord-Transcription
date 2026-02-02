"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, SkipBack, Download, Loader2 } from 'lucide-react';

interface WavesurferPlayerProps {
    url: string | null;
    onReady?: (wavesurfer: WaveSurfer) => void;
    onTimeUpdate?: (time: number) => void;
}

export const WavesurferPlayer: React.FC<WavesurferPlayerProps> = ({ url, onReady, onTimeUpdate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const onReadyRef = useRef(onReady);
    const onTimeUpdateRef = useRef(onTimeUpdate);

    // Update refs when props change
    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        onTimeUpdateRef.current = onTimeUpdate;
    }, [onTimeUpdate]);

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

        ws.load(url);

        ws.on('ready', () => {
            wavesurferRef.current = ws;
            onReadyRef.current?.(ws);
        });

        ws.on('audioprocess', () => {
            onTimeUpdateRef.current?.(ws.getCurrentTime());
        });

        ws.on('play', () => setIsPlaying(true));
        ws.on('pause', () => setIsPlaying(false));

        return () => {
            if (wavesurferRef.current) {
                try {
                    console.log("[Studio-Diagnostic] Cleaning up Wavesurfer instance...");
                    wavesurferRef.current.unAll();
                    wavesurferRef.current.destroy();
                    wavesurferRef.current = null;
                } catch (e) {
                    // Suppress AbortError which is common during rapid unmounts
                    console.warn("[Studio-Diagnostic] Wavesurfer cleanup suppressed error:", e);
                }
            }
        };
    }, [url]);

    const togglePlay = useCallback(() => {
        wavesurferRef.current?.playPause();
    }, []);

    const reset = useCallback(() => {
        wavesurferRef.current?.stop();
    }, []);

    if (!url) return null;

    return (
        <div className="w-full studio-card p-6 mt-6">
            <div ref={containerRef} className="w-full mb-4" />

            <div className="flex items-center justify-center gap-6">
                <button
                    onClick={reset}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/70"
                >
                    <SkipBack size={24} />
                </button>

                <button
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center bg-purple-600 rounded-full hover:bg-purple-500 transition-all transform hover:scale-105 neon-border"
                >
                    {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" className="ml-1" />}
                </button>

                <div className="text-sm font-mono text-white/50 w-20">
                    {wavesurferRef.current?.getCurrentTime().toFixed(2)}s
                </div>
            </div>
        </div>
    );
};

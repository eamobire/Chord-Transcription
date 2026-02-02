"use client";

import React from 'react';
import type { ChordData } from '@/types/audio';

interface ChordDisplayProps {
    currentChord: string | null;
    allChords: ChordData[];
    currentTime: number;
}

export const ChordDisplay: React.FC<ChordDisplayProps> = ({ currentChord, allChords, currentTime }) => {
    return (
        <div className="flex flex-col items-center gap-8 mt-12 w-full max-w-4xl">
            {/* Main Glowing Chord Card */}
            <div className="w-64 h-64 studio-card flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-purple-600/5 group-hover:bg-purple-600/10 transition-colors" />
                <div className="text-sm font-mono text-white/40 uppercase tracking-widest mb-2">Current Chord</div>
                <div className="text-8xl font-black neon-text select-none">
                    {currentChord || "—"}
                </div>
            </div>

            {/* Chord Timeline/Scroll */}
            <div className="w-full studio-card p-4 overflow-hidden relative">
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide items-end h-24 px-4">
                    {allChords.map((item, idx) => {
                        const isActive = currentTime >= item.time && (idx === allChords.length - 1 || currentTime < allChords[idx + 1].time);

                        return (
                            <div
                                key={`${item.time}-${idx}`}
                                className={`flex flex-col items-center min-w-[80px] transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-40'}`}
                            >
                                <div className={`text-xl font-bold ${isActive ? 'neon-text' : 'text-white'}`}>
                                    {item.chord}
                                </div>
                                <div className="text-[10px] font-mono text-white/30 mt-1">
                                    {item.time.toFixed(1)}s
                                </div>
                                {isActive && (
                                    <div className="w-1 h-1 bg-purple-500 rounded-full mt-2 animate-pulse shadow-[0_0_8px_#8b5cf6]" />
                                )}
                            </div>
                        );
                    })}
                    {allChords.length === 0 && (
                        <div className="w-full text-center text-white/20 font-mono py-4">
                            Waiting for transcription...
                        </div>
                    )}
                </div>
                {/* Horizontal progress indicator line */}
                <div className="absolute bottom-0 left-0 h-[2px] bg-white/5 w-full" />
            </div>
        </div>
    );
};

"use client";

import React, { useMemo } from 'react';
import { Volume2 } from 'lucide-react';
import { KEYBOARD_LOW, KEYBOARD_HIGH, midiToName, type ChordGuess, type PitchAnalysis } from '@/lib/pitchAnalysis';
import { playNotes } from '@/lib/referenceTone';
import type { Selection } from '@/components/WavesurferPlayer';

export type SpectrumMode = 'live' | 'loop';

interface SpectrumPanelProps {
    analysis: PitchAnalysis | null;
    mode: SpectrumMode;
    onModeChange: (mode: SpectrumMode) => void;
    range: Selection;
    hasSelection: boolean;
    timelineChord: string | null;
}

const WHITE_W = 20;
const CURVE_TOP = 8;
const CURVE_H = 130;
const KEYS_TOP = CURVE_TOP + CURVE_H + 6;
const WHITE_H = 78;
const BLACK_H = 48;
const BLACK_W = WHITE_W * 0.6;

const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);

// Lay out the keyboard once: x position of each key's centre, in SVG units
const KEYS = (() => {
    const keys: { midi: number; black: boolean; center: number; whiteIndex: number }[] = [];
    let whiteIndex = 0;
    for (let midi = KEYBOARD_LOW; midi <= KEYBOARD_HIGH; midi++) {
        if (isBlack(midi)) {
            keys.push({ midi, black: true, center: whiteIndex * WHITE_W, whiteIndex: whiteIndex - 1 });
        } else {
            keys.push({ midi, black: false, center: (whiteIndex + 0.5) * WHITE_W, whiteIndex });
            whiteIndex++;
        }
    }
    return { keys, width: whiteIndex * WHITE_W };
})();

// x position of a fractional MIDI note, interpolated between key centres
const midiToX = (m: number) => {
    const { keys } = KEYS;
    const pos = Math.max(0, Math.min(keys.length - 1, m - KEYBOARD_LOW));
    const i = Math.min(keys.length - 2, Math.floor(pos));
    const t = pos - i;
    return keys[i].center * (1 - t) + keys[i + 1].center * t;
};

// Close voicing around C3 with the bass note an octave below when it differs from the root
const chordVoicing = (chord: ChordGuess) => {
    const notes = chord.intervals.map(i => 48 + chord.root + i);
    if (chord.bass !== chord.root) notes.unshift(36 + chord.bass);
    return notes;
};

export const SpectrumPanel: React.FC<SpectrumPanelProps> = ({ analysis, mode, onModeChange, range, hasSelection, timelineChord }) => {
    const curvePath = useMemo(() => {
        if (!analysis) return '';
        const { curve, curveStart, curveStep } = analysis;
        const base = CURVE_TOP + CURVE_H;
        let d = `M ${midiToX(curveStart).toFixed(1)} ${base}`;
        for (let i = 0; i < curve.length; i++) {
            const x = midiToX(curveStart + i * curveStep);
            const y = base - curve[i] * CURVE_H;
            d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
        d += ` L ${midiToX(curveStart + (curve.length - 1) * curveStep).toFixed(1)} ${base} Z`;
        return d;
    }, [analysis]);

    const guessed = new Set(analysis?.notes ?? []);
    const tuning = analysis?.tuningCents ?? 0;
    const height = KEYS_TOP + WHITE_H + 2;
    const topChord = analysis?.chords[0];

    return (
        <section className="w-full studio-card p-6 mt-6" aria-label="Spectrum">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5" role="group" aria-label="Spectrum mode">
                        {(['live', 'loop'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => onModeChange(m)}
                                disabled={m === 'loop' && !hasSelection}
                                aria-pressed={mode === m}
                                title={m === 'loop' && !hasSelection ? 'Drag across the waveform to select a loop first' : undefined}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${mode === m ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                            >
                                {m === 'live' ? 'Live' : 'Whole loop'}
                            </button>
                        ))}
                    </div>
                    <h2 className="text-sm font-mono uppercase tracking-widest text-white/50">
                        {mode === 'live'
                            ? `At ${range.start.toFixed(2)}s`
                            : `Loop ${range.start.toFixed(2)}s – ${range.end.toFixed(2)}s`}
                    </h2>
                </div>
                {analysis && (
                    <span className="text-xs font-mono text-white/40" title="Estimated distance of the recording from A=440 Hz">
                        Tuning {tuning > 0 ? '+' : ''}{tuning} cents
                    </span>
                )}
            </div>

            <div className="w-full overflow-x-auto">
                <svg
                    viewBox={`0 0 ${KEYS.width} ${height}`}
                    className="w-full min-w-[640px] select-none"
                    role="img"
                    aria-label="Pitch spectrum over a piano keyboard"
                >
                    {/* Octave guide lines at each C */}
                    {KEYS.keys.filter(k => k.midi % 12 === 0).map(k => (
                        <line key={k.midi} x1={k.center} x2={k.center} y1={CURVE_TOP} y2={CURVE_TOP + CURVE_H}
                            stroke="rgba(255,255,255,0.06)" />
                    ))}

                    {analysis && (
                        <path d={curvePath} fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth={1.2} />
                    )}

                    {analysis?.notes.map(midi => {
                        const i = Math.round((midi - analysis.curveStart) / analysis.curveStep);
                        const y = CURVE_TOP + CURVE_H - analysis.curve[i] * CURVE_H;
                        return <circle key={midi} cx={midiToX(midi)} cy={y} r={3.5} fill="#ffffff" />;
                    })}

                    {/* White keys first, then black keys on top */}
                    {KEYS.keys.filter(k => !k.black).map(k => (
                        <g key={k.midi} onClick={() => playNotes([k.midi], tuning)} className="cursor-pointer">
                            <title>{midiToName(k.midi)}</title>
                            <rect x={k.whiteIndex * WHITE_W + 0.5} y={KEYS_TOP} width={WHITE_W - 1} height={WHITE_H} rx={2}
                                fill={guessed.has(k.midi) ? '#8b5cf6' : '#e8e8e8'} />
                            {k.midi % 12 === 0 && (
                                <text x={k.center} y={KEYS_TOP + WHITE_H - 6} textAnchor="middle" fontSize={8}
                                    fill={guessed.has(k.midi) ? '#ffffff' : '#666666'}>
                                    {midiToName(k.midi)}
                                </text>
                            )}
                        </g>
                    ))}
                    {KEYS.keys.filter(k => k.black).map(k => (
                        <g key={k.midi} onClick={() => playNotes([k.midi], tuning)} className="cursor-pointer">
                            <title>{midiToName(k.midi)}</title>
                            <rect x={k.center - BLACK_W / 2} y={KEYS_TOP} width={BLACK_W} height={BLACK_H} rx={1.5}
                                fill={guessed.has(k.midi) ? '#a78bfa' : '#1a1a1a'} />
                        </g>
                    ))}
                </svg>
            </div>
            <p className="text-[11px] text-white/30 mt-2">Click any key to hear that note, tuned to the recording.</p>

            {analysis && (
                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div>
                        <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">Chord guesses</div>
                        {analysis.chords.length === 0 ? (
                            <p className="text-sm text-white/40">No clear notes in this selection.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {analysis.chords.map((chord, idx) => (
                                    <button
                                        key={chord.name}
                                        onClick={() => playNotes(chordVoicing(chord), tuning)}
                                        title="Play this chord"
                                        className={`flex items-center gap-2 rounded-lg border transition-colors ${idx === 0
                                            ? 'px-4 py-2 text-xl font-bold border-purple-500/60 bg-purple-500/10 neon-text hover:bg-purple-500/20'
                                            : 'px-3 py-2 text-sm font-semibold border-white/10 text-white/70 hover:bg-white/5'}`}
                                    >
                                        {chord.name}
                                        <Volume2 size={idx === 0 ? 16 : 13} className="opacity-60" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {analysis.notes.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/60">
                                <span className="text-white/40">Notes:</span>
                                <span className="font-mono">{analysis.notes.map(midiToName).join('  ')}</span>
                                <button
                                    onClick={() => playNotes(analysis.notes, tuning)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-white/10 hover:bg-white/5"
                                >
                                    <Volume2 size={12} /> Play
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="text-sm text-white/50 sm:text-right">
                        <div className="text-xs font-mono uppercase tracking-widest text-white/40 mb-2">Timeline says</div>
                        <span className={`text-lg font-semibold ${topChord && timelineChord && timelineChord !== topChord.name ? 'text-amber-300' : 'text-white/80'}`}>
                            {timelineChord ?? '—'}
                        </span>
                    </div>
                </div>
            )}
            <p className="text-[11px] text-white/30 mt-4">
                These are guesses. Loop the section, play the guesses against it, and trust your ear.
            </p>
        </section>
    );
};

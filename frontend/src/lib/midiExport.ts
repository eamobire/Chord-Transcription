// Builds a standard MIDI file from the chord timeline entirely in the browser,
// so export works without the Python backend (and inside the desktop app).

import type { ChordData } from '@/types/audio';

const TICKS_PER_BEAT = 480;
const TEMPO_BPM = 120;
const TICKS_PER_SECOND = TICKS_PER_BEAT * TEMPO_BPM / 60;
const VELOCITY = 100;
const LAST_CHORD_SECONDS = 2;

const NOTE_MAP: Record<string, number> = {
    C: 60, 'C#': 61, Db: 61, D: 62, 'D#': 63, Eb: 63, E: 64, F: 65, 'F#': 66, Gb: 66,
    G: 67, 'G#': 68, Ab: 68, A: 69, 'A#': 70, Bb: 70, B: 71,
};

// Accepts "C:maj" style labels as well as Essentia's "C", "G#m", "Bbm" style.
// "N.C." (no chord) and anything unrecognised produce silence.
export function chordToNotes(label: string): number[] {
    let root: string;
    let quality: string;
    if (label.includes(':')) {
        [root, quality] = label.split(':', 2);
    } else {
        root = label[1] === '#' || label[1] === 'b' ? label.slice(0, 2) : label.slice(0, 1);
        const suffix = label.slice(root.length);
        if (suffix.startsWith('dim')) quality = 'dim';
        else if (suffix.startsWith('aug')) quality = 'aug';
        else if (suffix.startsWith('m') && !suffix.startsWith('maj')) quality = 'min';
        else quality = 'maj';
    }

    const base = NOTE_MAP[root];
    if (base === undefined) return [];
    if (quality.includes('maj')) return [base, base + 4, base + 7];
    if (quality.includes('min')) return [base, base + 3, base + 7];
    if (quality.includes('dim')) return [base, base + 3, base + 6];
    if (quality.includes('aug')) return [base, base + 4, base + 8];
    return [base];
}

const varLen = (value: number) => {
    const bytes = [value & 0x7f];
    while ((value >>= 7) > 0) bytes.unshift((value & 0x7f) | 0x80);
    return bytes;
};

const ascii = (text: string) => Array.from(text, c => c.charCodeAt(0));

const uint32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

export function chordsToMidi(chords: ChordData[]): Uint8Array {
    const events: { tick: number; on: boolean; note: number }[] = [];
    chords.forEach((chord, i) => {
        const end = i < chords.length - 1 ? chords[i + 1].time : chord.time + LAST_CHORD_SECONDS;
        const startTick = Math.round(chord.time * TICKS_PER_SECOND);
        const endTick = Math.max(startTick + 1, Math.round(end * TICKS_PER_SECOND));
        for (const note of chordToNotes(chord.chord)) {
            events.push({ tick: startTick, on: true, note });
            events.push({ tick: endTick, on: false, note });
        }
    });
    // Note-offs before note-ons at the same tick, so repeated notes retrigger cleanly
    events.sort((a, b) => a.tick - b.tick || Number(a.on) - Number(b.on));

    const name = ascii('Transcribed Chords');
    const microsPerBeat = Math.round(60_000_000 / TEMPO_BPM);
    const track: number[] = [
        0x00, 0xff, 0x03, ...varLen(name.length), ...name,
        0x00, 0xff, 0x51, 0x03, (microsPerBeat >> 16) & 0xff, (microsPerBeat >> 8) & 0xff, microsPerBeat & 0xff,
    ];
    let lastTick = 0;
    for (const e of events) {
        track.push(...varLen(e.tick - lastTick), e.on ? 0x90 : 0x80, e.note, e.on ? VELOCITY : 0);
        lastTick = e.tick;
    }
    track.push(0x00, 0xff, 0x2f, 0x00);

    return new Uint8Array([
        ...ascii('MThd'), ...uint32(6), 0x00, 0x00, 0x00, 0x01, (TICKS_PER_BEAT >> 8) & 0xff, TICKS_PER_BEAT & 0xff,
        ...ascii('MTrk'), ...uint32(track.length), ...track,
    ]);
}

export interface ChordData {
    time: number;
    chord: string;
    duration?: number;
}

export interface TranscriptionResult {
    chords: ChordData[];
    bpm?: number;
    key?: string;
}

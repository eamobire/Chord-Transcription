// Spectrum analysis of a short selection of audio, in the spirit of Transcribe!'s
// spectrum view: an averaged FFT mapped onto piano keys, plus note and chord guesses.
// Guesses are meant to be checked by ear, not trusted blindly.

export const KEYBOARD_LOW = 28;   // E1, lowest note on a bass guitar
export const KEYBOARD_HIGH = 96;  // C7

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// 16384 samples gives ~3 Hz per bin at 48 kHz, enough to separate most bass notes
const FFT_SIZE = 16384;
const MAX_FRAMES = 48;
const CURVE_STEPS_PER_SEMITONE = 10;
const CURVE_FLOOR_DB = -60;
const SILENCE_RMS = 0.001; // -60 dBFS

// Harmonic number -> [semitones above the fundamental, weight]
const HARMONICS: [number, number][] = [[0, 1], [12, 0.8], [19, 0.64], [24, 0.51], [28, 0.41], [31, 0.33]];
const MAX_NOTES = 6;

const CHORD_TEMPLATES: { suffix: string; intervals: number[] }[] = [
    { suffix: '', intervals: [0, 4, 7] },
    { suffix: 'm', intervals: [0, 3, 7] },
    { suffix: '5', intervals: [0, 7] },
    { suffix: '7', intervals: [0, 4, 7, 10] },
    { suffix: 'maj7', intervals: [0, 4, 7, 11] },
    { suffix: 'm7', intervals: [0, 3, 7, 10] },
    { suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
    { suffix: 'm7b5', intervals: [0, 3, 6, 10] },
    { suffix: 'dim', intervals: [0, 3, 6] },
    { suffix: 'dim7', intervals: [0, 3, 6, 9] },
    { suffix: 'aug', intervals: [0, 4, 8] },
    { suffix: 'sus2', intervals: [0, 2, 7] },
    { suffix: 'sus4', intervals: [0, 5, 7] },
    { suffix: '7sus4', intervals: [0, 5, 7, 10] },
    { suffix: '6', intervals: [0, 4, 7, 9] },
    { suffix: 'm6', intervals: [0, 3, 7, 9] },
    { suffix: 'add9', intervals: [0, 2, 4, 7] },
    { suffix: '9', intervals: [0, 2, 4, 7, 10] },
    { suffix: 'maj9', intervals: [0, 2, 4, 7, 11] },
    { suffix: 'm9', intervals: [0, 2, 3, 7, 10] },
];

export interface ChordGuess {
    name: string;
    root: number;        // pitch class, 0 = C
    intervals: number[];
    bass: number;        // pitch class of the lowest guessed note
    score: number;
}

export interface PitchAnalysis {
    curve: Float32Array; // 0..1 level, one value every curveStep semitones from curveStart
    curveStart: number;  // fractional MIDI note of curve[0]
    curveStep: number;
    notes: number[];     // guessed MIDI notes, ascending
    chords: ChordGuess[];
    tuningCents: number; // how far the recording sits from A=440
}

export const midiToName = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
export const pitchClassName = (pc: number) => NOTE_NAMES[((pc % 12) + 12) % 12];

// In-place iterative radix-2 FFT
function fft(re: Float64Array, im: Float64Array) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            [re[i], re[j]] = [re[j], re[i]];
            [im[i], im[j]] = [im[j], im[i]];
        }
    }
    for (let len = 2; len <= n; len <<= 1) {
        const half = len >> 1;
        const angle = -2 * Math.PI / len;
        const wRe = Math.cos(angle), wIm = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let curRe = 1, curIm = 0;
            for (let k = 0; k < half; k++) {
                const a = i + k, b = a + half;
                const bRe = re[b] * curRe - im[b] * curIm;
                const bIm = re[b] * curIm + im[b] * curRe;
                re[b] = re[a] - bRe;
                im[b] = im[a] - bIm;
                re[a] += bRe;
                im[a] += bIm;
                const nextRe = curRe * wRe - curIm * wIm;
                curIm = curRe * wIm + curIm * wRe;
                curRe = nextRe;
            }
        }
    }
}

// Power spectrum averaged over Hann-windowed frames spread across the samples
function averagePowerSpectrum(samples: Float32Array): Float64Array {
    const power = new Float64Array(FFT_SIZE / 2 + 1);
    const window = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (FFT_SIZE - 1));

    const numFrames = samples.length <= FFT_SIZE
        ? 1
        : Math.min(MAX_FRAMES, Math.ceil((samples.length - FFT_SIZE) / (FFT_SIZE / 4)) + 1);
    const hop = numFrames > 1 ? (samples.length - FFT_SIZE) / (numFrames - 1) : 0;

    const re = new Float64Array(FFT_SIZE);
    const im = new Float64Array(FFT_SIZE);
    for (let f = 0; f < numFrames; f++) {
        const offset = Math.round(f * hop);
        re.fill(0);
        im.fill(0);
        for (let i = 0; i < FFT_SIZE && offset + i < samples.length; i++) {
            re[i] = samples[offset + i] * window[i];
        }
        fft(re, im);
        for (let k = 0; k < power.length; k++) power[k] += re[k] * re[k] + im[k] * im[k];
    }
    return power;
}

// Weighted average of how far spectral peaks sit from the 440 Hz semitone grid,
// so a slightly sharp or flat recording still lands on the right keys
function estimateTuningCents(power: Float64Array, binHz: number): number {
    let maxP = 0;
    for (const p of power) maxP = Math.max(maxP, p);
    let sumCos = 0, sumSin = 0;
    const kLo = Math.ceil(150 / binHz), kHi = Math.min(power.length - 2, Math.floor(2500 / binHz));
    for (let k = Math.max(1, kLo); k <= kHi; k++) {
        const p = power[k];
        if (p < maxP * 1e-3 || p <= power[k - 1] || p < power[k + 1]) continue;
        const a = Math.log(power[k - 1] + 1e-20), b = Math.log(p + 1e-20), c = Math.log(power[k + 1] + 1e-20);
        const denom = a - 2 * b + c;
        const delta = denom !== 0 ? 0.5 * (a - c) / denom : 0;
        const cents = 1200 * Math.log2(((k + delta) * binHz) / 440);
        const angle = (cents / 100) * 2 * Math.PI;
        const w = Math.sqrt(p);
        sumCos += w * Math.cos(angle);
        sumSin += w * Math.sin(angle);
    }
    if (sumCos === 0 && sumSin === 0) return 0;
    return Math.round((Math.atan2(sumSin, sumCos) / (2 * Math.PI)) * 100);
}

function guessChords(notes: number[], saliences: number[]): ChordGuess[] {
    if (notes.length === 0) return [];
    const pcWeight = new Array(12).fill(0);
    const total = saliences.reduce((a, b) => a + b, 0);
    notes.forEach((n, i) => { pcWeight[n % 12] += saliences[i] / total; });
    const bass = notes[0] % 12;

    const guesses: ChordGuess[] = [];
    for (let root = 0; root < 12; root++) {
        for (const { suffix, intervals } of CHORD_TEMPLATES) {
            const pcs = intervals.map(i => (root + i) % 12);
            const explained = pcs.reduce((sum, pc) => sum + pcWeight[pc], 0);
            // A missing fifth is common in real voicings, so it costs less than a missing third
            const missing = intervals.reduce((sum, i, idx) => sum + (pcWeight[pcs[idx]] < 0.04 ? (i === 7 ? 0.5 : 1) : 0), 0);
            const score = explained
                - 0.8 * (1 - explained)
                - 0.12 * missing
                - 0.02 * (intervals.length - 3)
                + (bass === root ? 0.08 : 0);
            let name = pitchClassName(root) + suffix;
            if (bass !== root && pcs.includes(bass)) name += `/${pitchClassName(bass)}`;
            guesses.push({ name, root, intervals, bass, score });
        }
    }
    guesses.sort((a, b) => b.score - a.score);
    return guesses.slice(0, 4);
}

export function analyseSelection(buffer: AudioBuffer, start: number, end: number): PitchAnalysis {
    const sr = buffer.sampleRate;
    let s0 = Math.floor(start * sr);
    let s1 = Math.ceil(end * sr);
    // Selections shorter than one FFT frame borrow audio from either side to keep bass resolution
    if (s1 - s0 < FFT_SIZE) {
        s0 = Math.round((s0 + s1) / 2 - FFT_SIZE / 2);
        s1 = s0 + FFT_SIZE;
    }
    s0 = Math.max(0, Math.min(buffer.length, s0));
    s1 = Math.max(s0, Math.min(buffer.length, s1));

    const mono = new Float32Array(s1 - s0);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += data[s0 + i] / buffer.numberOfChannels;
    }

    // Near-silent windows would otherwise be normalised up and show noise as notes
    let sumSquares = 0;
    for (let i = 0; i < mono.length; i++) sumSquares += mono[i] * mono[i];
    const rms = Math.sqrt(sumSquares / Math.max(1, mono.length));
    if (rms < SILENCE_RMS) {
        const curveLen = Math.round((KEYBOARD_HIGH - KEYBOARD_LOW + 1) * CURVE_STEPS_PER_SEMITONE) + 1;
        return {
            curve: new Float32Array(curveLen),
            curveStart: KEYBOARD_LOW - 0.5,
            curveStep: 1 / CURVE_STEPS_PER_SEMITONE,
            notes: [],
            chords: [],
            tuningCents: 0,
        };
    }

    const power = averagePowerSpectrum(mono);
    const binHz = sr / FFT_SIZE;
    const tuningCents = estimateTuningCents(power, binHz);
    const refHz = 440 * Math.pow(2, tuningCents / 1200);
    const midiToHz = (m: number) => refHz * Math.pow(2, (m - 69) / 12);

    // Strongest power between two frequencies, interpolated when they fall inside one bin
    const bandPower = (fLo: number, fHi: number) => {
        const kLo = fLo / binHz, kHi = fHi / binHz;
        if (kLo >= power.length - 1) return 0;
        const first = Math.ceil(kLo), last = Math.min(power.length - 1, Math.floor(kHi));
        if (last < first) {
            const k = (kLo + kHi) / 2, i = Math.floor(k), t = k - i;
            return power[i] * (1 - t) + power[i + 1] * t;
        }
        let max = 0;
        for (let k = first; k <= last; k++) max = Math.max(max, power[k]);
        return max;
    };

    // Continuous curve for display, in dB relative to the loudest point
    const curveStep = 1 / CURVE_STEPS_PER_SEMITONE;
    const curveStart = KEYBOARD_LOW - 0.5;
    const curveLen = Math.round((KEYBOARD_HIGH - KEYBOARD_LOW + 1) / curveStep) + 1;
    const curvePower = new Float64Array(curveLen);
    let curveMax = 1e-20;
    for (let i = 0; i < curveLen; i++) {
        const m = curveStart + i * curveStep;
        curvePower[i] = bandPower(midiToHz(m - curveStep / 2), midiToHz(m + curveStep / 2));
        curveMax = Math.max(curveMax, curvePower[i]);
    }
    const curve = new Float32Array(curveLen);
    for (let i = 0; i < curveLen; i++) {
        const db = 10 * Math.log10(curvePower[i] / curveMax + 1e-20);
        curve[i] = Math.max(0, Math.min(1, (db - CURVE_FLOOR_DB) / -CURVE_FLOOR_DB));
    }

    // Amplitude per semitone, including notes above the keyboard so harmonics can be looked up
    const topNote = KEYBOARD_HIGH + HARMONICS[HARMONICS.length - 1][0];
    const amp = new Float64Array(topNote + 2);
    let ampMax = 1e-20;
    for (let m = KEYBOARD_LOW - 1; m <= topNote + 1; m++) {
        amp[m] = Math.sqrt(bandPower(midiToHz(m) * Math.pow(2, -45 / 1200), midiToHz(m) * Math.pow(2, 45 / 1200)));
        ampMax = Math.max(ampMax, amp[m]);
    }
    for (let m = 0; m < amp.length; m++) amp[m] /= ampMax;

    // Iterative estimate-and-cancel: pick the note whose harmonics explain the most energy,
    // remove its overtones from the residual, repeat. This keeps overtones from being named as notes.
    const residual = Float64Array.from(amp);
    const notes: number[] = [];
    const saliences: number[] = [];
    let firstSalience = 0;
    for (let iter = 0; iter < MAX_NOTES; iter++) {
        let best = -1, bestSalience = 0;
        for (let n = KEYBOARD_LOW; n <= KEYBOARD_HIGH; n++) {
            // The fundamental can be weak (low bass notes) but must be there, and be a local peak
            if (residual[n] < 0.05 || amp[n] < amp[n - 1] || amp[n] < amp[n + 1]) continue;
            let salience = 0;
            for (const [offset, weight] of HARMONICS) salience += weight * residual[n + offset];
            if (salience > bestSalience) {
                best = n;
                bestSalience = salience;
            }
        }
        if (best < 0 || bestSalience < 0.25 * firstSalience) break;
        if (firstSalience === 0) firstSalience = bestSalience;
        notes.push(best);
        saliences.push(bestSalience);

        residual[best] = 0;
        residual[best - 1] *= 0.3;
        residual[best + 1] *= 0.3;
        for (const [offset, weight] of HARMONICS.slice(1)) residual[best + offset] *= 1 - weight;
    }

    const order = notes.map((n, i) => i).sort((a, b) => notes[a] - notes[b]);
    const sortedNotes = order.map(i => notes[i]);
    const sortedSaliences = order.map(i => saliences[i]);

    return {
        curve,
        curveStart,
        curveStep,
        notes: sortedNotes,
        chords: guessChords(sortedNotes, sortedSaliences),
        tuningCents,
    };
}

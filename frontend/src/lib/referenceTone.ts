// Plays short reference notes so guesses can be compared with the recording by ear.
// Notes are retuned by the recording's estimated tuning so they don't clash with it.

let context: AudioContext | null = null;

export function playNotes(midis: number[], tuningCents = 0, duration = 1.5) {
    if (midis.length === 0) return;
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.value = 0.3 / Math.sqrt(midis.length);
    master.connect(context.destination);

    for (const midi of midis) {
        const osc = context.createOscillator();
        const env = context.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12 + tuningCents / 1200);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(1, now + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(env).connect(master);
        osc.start(now);
        osc.stop(now + duration);
    }
}

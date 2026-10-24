from midiutil import MIDIFile

def generate_midi(chords, output_path):
    """
    chords: list of dicts like [{"time": 0, "chord": "C:maj"}, ...]
    """
    # Create MIDI object
    midi = MIDIFile(1)  # One track
    track = 0
    time = 0
    midi.addTrackName(track, time, "Transcribed Chords")
    midi.addTempo(track, time, 120)

    # Chord mapping (simplified)
    # Mapping "C:maj" to MIDI notes [60, 64, 67]
    note_map = {
        "C": 60, "C#": 61, "Db": 61, "D": 62, "D#": 63, "Eb": 63,
        "E": 64, "F": 65, "F#": 66, "Gb": 66, "G": 67, "G#": 68,
        "Ab": 68, "A": 69, "A#": 70, "Bb": 70, "B": 71
    }

    def get_notes(chord_label):
        # Accepts "C:maj" style labels as well as Essentia's "C", "G#m", "Bbm" style
        if ':' in chord_label:
            root, quality = chord_label.split(':', 1)
        else:
            root = chord_label[:2] if chord_label[1:2] in ('#', 'b') else chord_label[:1]
            suffix = chord_label[len(root):]
            if suffix.startswith('dim'):
                quality = "dim"
            elif suffix.startswith('aug'):
                quality = "aug"
            elif suffix.startswith('m') and not suffix.startswith('maj'):
                quality = "min"
            else:
                quality = "maj"

        # "N.C." (no chord) and anything unrecognised produce silence
        if root not in note_map:
            return []

        base_note = note_map[root]

        if "maj" in quality:
            return [base_note, base_note + 4, base_note + 7]
        elif "min" in quality:
            return [base_note, base_note + 3, base_note + 7]
        elif "dim" in quality:
            return [base_note, base_note + 3, base_note + 6]
        elif "aug" in quality:
            return [base_note, base_note + 4, base_note + 8]
        return [base_note]

    channel = 0
    volume = 100

    for i, item in enumerate(chords):
        start_time = item['time']
        # End time is next chord start or +2 seconds if last
        if i < len(chords) - 1:
            duration = chords[i+1]['time'] - start_time
        else:
            duration = 2.0
            
        notes = get_notes(item['chord'])
        
        # MIDIUtil uses 'beats', not 'seconds' directly if tempo is 60
        # If tempo is 120, 1 second = 2 beats
        # To make it simple, let's stick to 120 BPM and convert
        beats_start = start_time * 2
        beats_duration = max(0.1, duration * 2)

        for note in notes:
            midi.addNote(track, channel, note, beats_start, beats_duration, volume)

    with open(output_path, "wb") as output_file:
        midi.writeFile(output_file)

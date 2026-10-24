# ChordMagic

Load a song or video and ChordMagic transcribes its chords, then lets you check them by ear:
loop any section, slow it down without changing pitch, and see the notes on a live piano-keyboard
spectrum with chord guesses you can play back. Everything runs on your computer; nothing is uploaded.

This guide covers **running ChordMagic on a Mac**. (On Windows, use the `.exe` installer from the
same build; see [desktop/README.md](desktop/README.md).)

---

## Option 1: Install the app (recommended)

**Requirements:** macOS 12 Monterey or later, on an Intel or Apple Silicon Mac (one download works on both).

### 1. Download

1. Sign in to GitHub and open this repository's **Actions** tab.
2. Click the latest successful **Build desktop apps** run (green tick).
3. Scroll to **Artifacts** at the bottom and download **ChordMagic-macOS**.
4. Double-click the downloaded `.zip` to unzip it. You'll get `ChordMagic-0.1.0.dmg`.

### 2. Install

1. Double-click `ChordMagic-0.1.0.dmg`.
2. In the window that opens, drag **ChordMagic** into the **Applications** folder.
3. Eject the disk image (click ⏏ next to it in Finder's sidebar).

### 3. Open it the first time

ChordMagic isn't signed with a paid Apple developer certificate, so macOS blocks it on first launch.
You only need to do this once:

1. Open **Applications** and double-click **ChordMagic**. macOS says it can't verify the app. Click **Done** (or **Cancel**).
2. Open **System Settings → Privacy & Security**.
3. Scroll down to the message about ChordMagic and click **Open Anyway**, then confirm with your password or Touch ID.

On macOS 14 Sonoma and earlier you can instead **right-click** the app, choose **Open**, then click **Open** again.

After this, ChordMagic opens normally from Applications, Launchpad or Spotlight.

> **"ChordMagic is damaged and can't be opened"?** macOS sometimes says this about unsigned apps
> downloaded from the internet. Open **Terminal** and run the command below, then open the app again:
>
> ```bash
> xattr -dr com.apple.quarantine /Applications/ChordMagic.app
> ```

### Uninstall

Drag **ChordMagic** from Applications to the Trash.

---

## Using ChordMagic

1. **Load a file:** drag or pick an audio file (WAV, MP3, M4A, AIFF) or a video (MP4, WebM, MOV).
   The chord timeline appears after a few seconds.
2. **Play and follow along:** the big card shows the current chord; the timeline below lists every change.
3. **Check a chord by ear:**
   - Drag across the waveform to select a loop. With **Loop** on, playback repeats it.
   - Use **0.75× / 0.5× / 0.25×** to slow down without changing pitch.
   - The spectrum panel's **Live** mode shows the notes at the playhead as it plays;
     **Whole loop** summarises the whole selection.
   - Click a chord guess, or any piano key, to hear it in the recording's tuning.
4. **Export MIDI:** saves the chord timeline as a `.mid` file you can open in GarageBand, Logic or any DAW.

Chord names are guesses. They're most reliable on clear recordings; with dense mixes, use the loop,
slow-down and play-back tools to confirm them.

---

## Option 2: Run from the source code

Use this if you want to change the code or can't download the app.

**Requirements:** [Node.js](https://nodejs.org) 20.9 or later (the LTS installer is fine) and
[Git](https://git-scm.com) (macOS offers to install it the first time you type `git` in Terminal).

Open **Terminal** and get the code:

```bash
git clone https://github.com/eamobire/Chord-Transcription.git
```

```bash
cd Chord-Transcription
```

### In your browser

```bash
cd frontend && npm install && npm run dev
```

Then open <http://localhost:3000> in Chrome, Edge or Firefox. Press `Ctrl+C` in Terminal to stop.

### As a desktop window

From the `Chord-Transcription` folder:

```bash
cd desktop && npm install && npm --prefix ../frontend install && npm start
```

### Build your own .dmg

From the `desktop` folder (after the step above):

```bash
npm run dist:mac
```

The `.dmg` is written to a **ChordMagic Installers** folder next to the `Chord-Transcription` folder.
A `.dmg` you build yourself on your own Mac opens without the security steps above.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Couldn't read the audio from this file" | The format or codec isn't supported. Convert to MP3/WAV (audio) or MP4 (video). |
| No sound | Check the Mac's output device and volume in the menu bar, then press the play button in ChordMagic again. |
| A long video is slow to load or the app freezes | The whole file is loaded into memory. Trim it, or extract just the audio. |
| `npm: command not found` | Install Node.js from <https://nodejs.org>, then open a new Terminal window. |

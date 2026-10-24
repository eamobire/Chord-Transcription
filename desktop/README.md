# ChordMagic desktop app

An Electron wrapper around the static build of `frontend/`. Everything runs locally:
chord detection, the spectrum view and MIDI export all happen inside the app, with no server.

## Build

```bash
npm install
npm run dist:win   # Windows: installer + portable .exe
npm run dist:mac   # macOS: .dmg (only works on a Mac)
```

Installers are written to `../../ChordMagic Installers` (next to this repository, so they are never committed).
`npm start` runs the app without packaging it.

A `.dmg` can't be built on Windows. To get one without a Mac, run the **Build desktop apps** workflow
from the repository's Actions tab (or push a tag such as `v0.1.0`). It builds both installers on
GitHub's runners and attaches them to the run as downloadable artifacts.

## Opening the app the first time

The installers aren't signed with a paid developer certificate, so each OS warns on first launch:

- **Windows:** SmartScreen shows "Windows protected your PC". Click **More info → Run anyway**.
- **macOS:** open the `.dmg`, drag ChordMagic to Applications, then right-click the app and choose **Open**.
  On recent macOS versions you may instead need **System Settings → Privacy & Security → Open Anyway**.

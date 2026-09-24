<div align="center">
  <img src="renderer/app-icon.png" width="96" height="96" alt="clawd-pet icon" />

  # Clawd Pet

  A tiny pixel-art desktop pet — pick Clawd, a cat, or a sheep — that lives
  on your Windows desktop.

  [![Stars](https://img.shields.io/github/stars/jin3107/clawd-pet?style=flat-square)](https://github.com/jin3107/clawd-pet/stargazers)
  [![Forks](https://img.shields.io/github/forks/jin3107/clawd-pet?style=flat-square)](https://github.com/jin3107/clawd-pet/network/members)
  [![License](https://img.shields.io/github/license/jin3107/clawd-pet?style=flat-square)](LICENSE)
  [![Version](https://img.shields.io/badge/version-1.3.0-blue?style=flat-square)](package.json)
  [![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](#requirements)
  [![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
</div>

<br>

On first launch it asks you to pick a companion — **Clawd** (the original
pixel crab), a **cat**, or a **sheep** — then walks along the taskbar on its
own, reacts to your mouse, and every so often breaks into a trick. Clawd's
full trick list: sits down to type on a laptop, DJs with headphones and a
turntable, heads a soccer ball, jumps, climbs up the screen and rappels back
down, surfs across the taskbar on a board, sips a cup of coffee, or just
stands there thinking. The cat and sheep stick to a calmer, on-model subset
(jump, climb, think — the cat also chases a butterfly), skipping the
laptop/DJ/soccer/coffee/surf props that don't fit them. Drop the pet mid-air
and it free-falls — sometimes with a parachute, sometimes without.

Built with Electron: transparent, frameless, always-on-top, and click-through
except when you're actually touching the pet.

## Features

- **Pick your pet** — a small picker window on first run (or whenever no
  model is saved yet) lets you choose Clawd, cat, or sheep; the choice is
  saved to `pet-config.json` and can be changed by clearing it.
- **Autonomous wandering** — walks back and forth along the taskbar inside
  `screen.getPrimaryDisplay().workArea`, so it never overlaps the taskbar.
- **Random tricks, gated per model** — walking is the default behavior;
  every so often it picks a trick. Clawd gets the full set: `code`, `music`,
  `soccer`, `jump`, `climb`, `surf`, `think`, `coffee`. Cat and sheep get a
  trimmed set (`jump`, `climb`, `think`) since they don't have the
  laptop/DJ/soccer/coffee props drawn for them — the cat additionally gets a
  `butterfly` trick (crouches, tracks a fluttering butterfly, then pounces).
- **Animated legs & tail on cat/sheep** — the hand-drawn cat/sheep sprites
  have their painted-on legs (and, for the cat, its tail) clipped out of the
  base artwork and re-attached as separate pieces so they can walk, dangle,
  and wag independently instead of being frozen into the static image.
- **Care-message bubble** — roughly once an hour, it pauses to "think" and
  pops up a small speech bubble above its head with a short check-in message
  (drink water, stretch, rest your eyes...). The bubble is its own overlay
  window, not an OS notification, so it still shows up even if system
  notifications are turned off.
- **Settings window** — rename the pet, toggle which care messages are
  enabled, add your own custom ones, and adjust how often they pop up.
- **AFK mode** — if your mouse sits still for a while, the pet wanders over
  and hangs around your cursor instead of doing its own thing.
- **Drag and drop** — click and hold the pet to pick it up, drop it anywhere
  on screen; it free-falls and settles with a bounce, sometimes popping a
  parachute on the way down.
- **Pet the head** — hover over its head to see it react happily.
- **Click-through by default** — the window only captures mouse input while
  the cursor is directly over the sprite, so it never blocks clicks on
  whatever is underneath it.

## Requirements

- Windows
- [Node.js](https://nodejs.org/) 18 or newer (20/22 LTS recommended — see the
  Node 24 note below)

## Getting started

```bash
git clone https://github.com/jin3107/clawd-pet.git
cd clawd-pet
npm install
npm start
```

A tray icon appears; right-click it and choose **Exit** to quit.

### Known issue: Node 24 + Electron install

On Node 24, `npm install`'s Electron postinstall step can silently fail to
extract `electron.exe` (you'll see only a `locales` folder under
`node_modules/electron/dist`, and `npm start` fails with "Electron failed to
install correctly"). This is an `extract-zip` incompatibility, not a network
issue — the zip is already downloaded correctly into
`%LOCALAPPDATA%\electron\Cache`.

Workarounds, in order of preference:
1. Use Node 20 or 22 LTS instead (easiest fix).
2. Or manually finish the install after `npm install`:
   ```powershell
   npm approve-scripts electron
   Expand-Archive "$env:LOCALAPPDATA\electron\Cache\<hash>\electron-v31.7.7-win32-x64.zip" -DestinationPath "node_modules\electron\dist"
   "electron.exe" | Out-File -NoNewline "node_modules\electron\path.txt"
   ```

## Building a portable .exe

```bash
npm run dist
```

Outputs a Windows installer via `electron-builder` (see the `build` section
in `package.json`).

## Project structure

```
main.js               Electron main process — window creation, movement/state
                       loop, drag/pat IPC handlers, care-message scheduling,
                       model-picker/settings window creation, tray menu
config.js             Loads/saves pet-config.json (petModel, petName,
                       greetings, care-message interval)
preload.js             contextBridge: exposes petAPI to the pet renderer
bubblePreload.js        contextBridge: exposes bubbleAPI to the speech-bubble
                       overlay renderer
settingsPreload.js      contextBridge: exposes settingsAPI to the settings window
modelPickerPreload.js   contextBridge: exposes modelPickerAPI to the model-picker window
renderer/
  index.html            One <svg id="creature"> mount point plus one
                         <script type="text/svg-template" id="tpl-*"> per
                         model (clawd/cat/sheep); pet.js swaps the right
                         template's markup into #creature at startup
  pet.js                Applies state classes, wires up drag/hover listeners
  model-picker.html/js   First-run "choose your pet" window
  settings.html/js       Settings window (name, greetings, interval)
  bubble.html            The speech-bubble overlay window
  bubble.js             Renders bubble text, reports its size back to main
  img/                  cat.png / sheep.png — hand-drawn 48x48 Piskel sprites
  css/
    base.css            Layout, cursors, transform origins, hidden-groups
    states.css          One body.<state> block per state/trick
    keyframes.css        All @keyframes
```

The pet's behavior is a simple state machine driven by `main.js`'s `tick()`
loop (runs every 30ms), broadcasting `{ state, facing, careMsg }` over IPC to
the renderer, which just toggles CSS classes — all animation logic lives in
`renderer/css/`. The speech bubble is a second, separate transparent
`BrowserWindow` that main.js positions above the pet's head and shows/hides
in lockstep with the `think` state.

The cat/sheep sprites are static PNGs, so their legs (and the cat's tail)
are cut out of the source art with an SVG `clip-path` and re-drawn as
separate `<rect>`/`<image>` pieces positioned back in place — that's what
lets `states.css` animate them (walk, dangle when held, wag, etc.) the same
way it animates Clawd's rect-built legs.

## Contributing

Issues and pull requests are welcome — new tricks, better animations, Linux/
macOS support, whatever. A few things that help:

- Keep the sprite pixel-accurate: plain axis-aligned `<rect>` elements, no
  `rx`/rounded corners, no smooth easing on movement (use `steps(1)` for
  frame-swap style animation, not `ease-in-out`).
- New tricks go in the `tricks` array in `nextAction()` (`main.js`); gate it
  by `petConfig.petModel` if the trick needs props a model doesn't have, and
  add a matching `body.<state>` block in `renderer/css/states.css`.
- Test by running `npm start` and actually watching the pet on your desktop
  before opening a PR — this is a visual project, screenshots/GIFs in the PR
  description help a lot.

## License

MIT — see [LICENSE](LICENSE).

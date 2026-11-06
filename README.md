# hook & chill

A lofi swinging game inspired by Stickman Hook — one self-contained `index.html`, no build step.

**Play:** open `index.html` in a browser (or enable GitHub Pages on this repo).

## Controls
- **Hold** (click / tap / space) — grab the nearest lantern
- **Release** — let go and fly (each release gives a little hop, so spam to climb)
- **R** restart · **Esc** pause · **M** music

## Modes
- **Campaign** — 15 tapes with ghost replays of your best run
- **Endless** — procedural, difficulty ramps, flips add bonus points
- **Rush** — clock ticks down, checkpoints add +8s
- **Daily tape** — a new seeded level each day
- **Daily obstacle course** — 8 sections remixed every day: walls, spike tunnels, saws, laser gates, ring launches, stairways, checkpoints
- **Zen** — clouds catch you, no fail

Collect vinyl records ◉ to unlock colours, headwear and trails in the wardrobe.

Music is generated live with the Web Audio API (rhodes chords, swung drums, vinyl crackle). Progress is saved in `localStorage`.

## Extras
- Works on desktop, phones (portrait & landscape, notch-safe) and tablets; installable to home screen
- Gamepad support (A/B/X/Y or RT to hook, Start to pause), fullscreen (F)
- ASMR UI sounds, haptics on Android, copy-your-result sharing for daily runs

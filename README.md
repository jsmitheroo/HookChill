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
- **Obstacle course** — 8 handmade sections: walls, spike tunnel, saws, laser gates, ring launches, checkpoints
- **Zen** — clouds catch you, no fail

Collect vinyl records ◉ to unlock colours, headwear and trails in the wardrobe.

Music is generated live with the Web Audio API (rhodes chords, swung drums, vinyl crackle). Progress is saved in `localStorage`.

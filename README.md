# hook & chill

A lofi swinging game inspired by Stickman Hook — one self-contained `index.html`, no build step.

**Play:** the game is `public/index.html` — open it in a browser, or deploy the whole repo to Cloudflare (below) for accounts, cloud saves and leaderboards.

## Controls
- **Hold** (click / tap / space) — grab the nearest lantern
- **Release** — let go and fly (each release gives a little hop, so spam to climb)
- **R** restart · **Esc** pause · **M** music

## Modes
**Play** — campaign (15 tapes, 3 stars each, boss chases on tapes 5/10/15), endless, rush
**Daily** — daily tape, daily obstacle course (remixed every day), 3 daily challenges
**Social** — race a friend (swap race codes / links and race their ghost), leaderboards (claude.ai version)
**Chill** — zen (no fail, day/night sky), my room (wardrobe, trophies, music packs)

**Create** — level editor: place lanterns, pads, walls, spikes, saws, lasers, rings, bubbles, updrafts and records; test-play; share level codes.

Progression: XP levels (pets unlock as you level), a free 30-tier monthly season pass, buy & arrange furniture in your room.
An intro cutscene plays on load (skippable, toggle in settings).

Obstacles: lanterns, burn-out lanterns, bounce pads, boost rings, crumbly platforms, updrafts, portals, slow-mo bubbles, saws, lasers, spikes.
Combos for fast grab chains, clutch bonus for grabs just above the fog. 33 trophies, 4 music packs.

## Extras
- Works on desktop, phones (portrait & landscape, notch-safe) and tablets; installable to home screen
- Gamepad support (A/B/X/Y or RT to hook, Start to pause), fullscreen (F)
- ASMR UI sounds, haptics on Android, copy-your-result sharing for daily runs
- Accessibility: colour-safe hazards, big text, assist mode

## Website + accounts (Cloudflare)
This repo is a Cloudflare Worker: `public/` is the game, `src/api.js` is the accounts API, and a D1 database stores users, saves and leaderboards.

Deploy: Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick `jsmitheroo/hookchill` → Deploy (no build command needed). The D1 database `hookchill` is created automatically on the first deploy, and every push to `main` redeploys.

Accounts are username + password (passwords are salted and hashed with PBKDF2; sessions are random tokens stored only as hashes). Signed-in players get cloud saves on every device and can post leaderboard scores.

API: `POST /api/register` · `POST /api/login` · `POST /api/logout` · `GET /api/me` · `GET|PUT /api/save` · `POST /api/score` · `GET /api/scores?board=&day=` · `POST /api/password`

## Offline / install
Hosted on GitHub Pages it works as an installable app: open it once, then "Add to Home Screen" (iOS Safari) or "Install app" (Chrome/Android/desktop). After that it plays fully offline — `sw.js` caches the game and its icons.

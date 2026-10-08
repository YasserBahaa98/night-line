# 🚂 Night Line

A tap-to-drive 3D train game for young kids, built for **iPad Safari (landscape)** with **Three.js + Vite**.
No asset files at all: every model, texture and sound is generated in code, so the whole game is ~150 KB gzipped.

## Play it

```bash
npm install
npm run dev        # http://localhost:5173  (also reachable from an iPad on the same Wi-Fi: use the "Network" URL Vite prints)
npm run build      # static site in ./dist
npm run preview    # serve ./dist locally
```

Add `?fps` to the URL to show a tiny FPS / draw-call counter.

## How it plays (every control is one big tap)

| Button | What it does |
|---|---|
| 🚂 **GO** | speed up one step (4 steps: stop · 🐢 20 · 🐇 40 · 🚀 60) |
| 🐢 **SLOW** / 🛑 **STOP** | slow down one step (turns into STOP near a station and glows when *now* is the perfect moment) |
| 💡 **FRONT** | headlight on/off |
| 🪑 **SEATS** | passenger lights on/off |
| 🚏 camera strip | (at stations) cab · platform view · inside the carriage |
| 🚩 **LET'S GO!** | depart (orange = some friends still waiting, green = everyone aboard) |

**Mechanics**
1. **Lights** – 3 dark tunnels. Turn the headlight *and* passenger lights on before you enter; turn them off again in daylight for a bonus. Passengers' faces go 😊 → 😢 if it's dark and you forgot.
2. **Speed limits** – road signs change the limit (🐢20 / 🐇40 / 🚀60). The speedometer shows a green band = "just right", yellow = too slow, red = too fast. Match the band.
3. **Stations** – 3 stations. The train auto-slows; tap STOP at the green beacon. Passengers walk on and fill the 24 seats (counter at the top). Use the camera strip to watch them board.
4. **Score + stars** – 1000 points max (speed 300 · lights 270 · stops 240 · friends 150 · comfort 40). ⭐ at 0, ⭐⭐ at 600, ⭐⭐⭐ at 850. Best score is saved in `localStorage`. Nothing is ever "game over".

## iPad tips
* Open the deployed URL in Safari → Share → **Add to Home Screen** → it launches fullscreen (PWA meta tags + manifest included).
* WebAudio follows the iPad's silent switch / ringer volume on some iOS versions; the game plays a silent looping `<audio>` to force the media channel, but if there is no sound check the side switch and volume.
* Landscape only – portrait shows a "turn your iPad sideways" screen.

## Free hosting (pick one – it's just static files)

**Cloudflare Pages** (recommended: fast, free, unlimited bandwidth)
1. Push this folder to a GitHub repo.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command `npm run build`, output directory `dist`. Done – you get `https://<name>.pages.dev`.

**GitHub Pages** (workflow already included in `.github/workflows/deploy.yml`)
1. Push to a GitHub repo's `main` branch.
2. Settings → Pages → Source: **GitHub Actions**. Every push then builds and deploys `dist`.
3. `vite.config.js` already uses `base: './'`, so sub-path URLs (`user.github.io/repo/`) work.

**Netlify / itch.io** – drag-and-drop the `dist` folder.

## Performance notes (iPad-friendly by design)
* ≈ 35–70 draw calls and ≈ 55–60k triangles per frame (measured in real Chrome via DevTools: ~0.6 ms/frame on a desktop GPU at 2× pixel ratio – lots of headroom; only the iPad itself can confirm 60 fps, so open it with `?fps` there).
* Pixel ratio capped at 2, **no shadow maps, no post-processing**, only **one real light** (the headlight `SpotLight`) + a hemisphere light. Window glow, tunnel lamps, headlight cone, carriage lights are all emissive/additive fakes.
* Trees are built in 250 m **chunks** (instanced, shared geometry/materials); chunks behind or far ahead of the train are switched off, so ~3 of 11 are drawn at any time. Hills, poles, wheels, passengers and sleepers are instanced; scenery props are merged vertex-coloured meshes. Steam and sparks use two fixed-size particle pools (one draw call each).

## Project layout
```
src/main.js        game loop, state machine (menu → playing → station → finish → results), camera rig, rules
src/route.js       all tuning: route length, stations, speed zones, tunnels, speed steps
src/world.js       sky, ground, track, bridge, tunnels, stations, signs, trees, hills, village
src/train.js       locomotive, carriages, wheels, headlight + passenger-light logic
src/passengers.js  instanced passengers, boarding paths, happy/sad faces
src/ui.js          HUD, gauge, banners, results screen, confetti
src/audio.js       procedural WebAudio: engine chug, clacks, horn, chimes, jingles, music box
src/scoring.js     point weights, star thresholds, localStorage best
src/fx.js          pooled steam + spark particles
scripts/make-icons.mjs   regenerates the PWA icons (no dependencies)
```

Want it easier/harder? Tweak `STEPS`, `ZONES`, `TUNNELS` in `src/route.js` and the thresholds in `src/scoring.js`.

# Motion Studio

Motion graphics videos written as code. Each video is one HTML file in `videos/`.

## A video file must define
- `window.DURATION` – length in seconds
- `window.SIZE` – `[width, height]`
- `window.render(t)` – draws the exact frame at time `t` (seconds). No CSS animations or timers, so every render is identical.

Link `../brand.css` for your colors and fonts.

## Render
```bash
npm install
node render.mjs videos/hello.html            # -> out/hello.mp4 (30 fps)
node render.mjs videos/hello.html --stills 3 # -> 3 quick preview PNGs in out/
```

Requires Node.js, ffmpeg on PATH, and Google Chrome. `out/` and `node_modules/` are git-ignored.

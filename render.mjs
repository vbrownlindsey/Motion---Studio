// Usage:
//   node render.mjs videos/hello.html              -> out/hello.mp4
//   node render.mjs videos/hello.html --stills 3   -> out/hello-still-1.png ...
//   optional: --fps 30
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i === -1 ? def : Number(args[i + 1]);
};
const file = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!file) {
  console.error("Usage: node render.mjs videos/<name>.html [--stills N] [--fps 30]");
  process.exit(1);
}
const FPS = flag("--fps", 30);
const stills = flag("--stills", 0);
const name = basename(file, ".html");
const outDir = resolve("out");
mkdirSync(outDir, { recursive: true });

// Uses your installed Chrome so no separate browser download is needed.
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
page.on("pageerror", e => console.error("Page error:", e.message));
await page.goto(pathToFileURL(resolve(file)).href);
await page.evaluate(() => document.fonts.ready);

const { duration, size } = await page.evaluate(() => ({
  duration: window.DURATION,
  size: window.SIZE,
}));
if (!duration || !size || typeof (await page.evaluate(() => typeof window.render)) !== "string") {
  throw new Error("Video must define window.DURATION, window.SIZE and window.render(t)");
}
const [w, h] = size;
await page.setViewportSize({ width: w, height: h });

const frameAt = async t => {
  await page.evaluate(async t => {
    window.render(t);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
  return page.screenshot({ type: "png" });
};

if (stills > 0) {
  for (let i = 0; i < stills; i++) {
    const t = stills === 1 ? duration / 2 : Math.min((duration * i) / (stills - 1), duration - 1 / FPS);
    const out = resolve(outDir, `${name}-still-${i + 1}.png`);
    const { writeFileSync } = await import("node:fs");
    writeFileSync(out, await frameAt(t));
    console.log(`still ${i + 1}/${stills}  t=${t.toFixed(2)}s  ->  ${out}`);
  }
  await browser.close();
  process.exit(0);
}

const total = Math.round(duration * FPS);
const outFile = resolve(outDir, `${name}.mp4`);
const ff = spawn(
  "ffmpeg",
  [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "medium",
    "-movflags", "+faststart",
    outFile,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const done = new Promise((res, rej) => {
  ff.on("close", c => (c === 0 ? res() : rej(new Error("ffmpeg exited with " + c))));
  ff.on("error", rej);
});

for (let i = 0; i < total; i++) {
  const buf = await frameAt(i / FPS);
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
  if (i % FPS === 0 || i === total - 1) process.stdout.write(`\rframe ${i + 1}/${total}`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`\nDone: ${outFile}`);

// Takes the viewport captures of the current version that the design comparer in Evolution is cut from
// (content/evolution/v2/{es,en}-{hero,projects,stack,contact}.png, 1440x900). It drives Edge without a
// window through its debugging protocol, against the static export served locally (npm run build, then
// serve `out/`). Each section is reached by scrolling down in small steps, the way a visitor would, so the
// change of section has run and the content is in place; the chrome that does not belong in a picture is
// hidden (crown control, cursor light and the floating note of the watch piece).
// Usage: node scripts/capture-evolution.mjs [baseUrl]   (default http://localhost:4000)
// Then:  node scripts/crop-evolution.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.argv[2] ?? 'http://localhost:4000';
const PORT = 9333;
const OUT = 'content/evolution/v2';
const IDS = ['hero', 'projects', 'stack', 'contact'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const profile = `${process.env.TEMP ?? '.'}/capture-evolution-profile`;
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const run = async (expression) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const lang of ['es', 'en']) {
    for (const section of IDS) {
      await send('Page.navigate', { url: `${BASE}/${lang}/` });
      await sleep(3500);
      for (let i = 0; i < 40; i++) {
        const ready = await run("document.documentElement.dataset.watch === '3d' && !!document.querySelector('.crown-control')");
        if (ready) break;
        await sleep(500);
      }
      // The scroll position at which the section has settled: its top, less the header.
      const target =
        section === 'hero'
          ? 0
          : await run(
              `(() => { document.documentElement.style.scrollBehavior = 'auto'; const header = document.querySelector('.site-header').offsetHeight; return Math.max(0, Math.round(document.getElementById('${section}').getBoundingClientRect().top + scrollY - header)); })()`,
            );
      // Down in small steps, so the section's choreography follows the scroll, then let it settle.
      const steps = Math.max(1, Math.ceil(target / 250));
      for (let step = 1; step <= steps; step++) {
        await run(`window.scrollTo(0, ${Math.round((target * step) / steps)}); 1`);
        await sleep(120);
      }
      await sleep(4500);
      await run(
        "(() => { for (const s of ['.crown-control', '.crown-tether', '.cursor-light', '.callout']) document.querySelectorAll(s).forEach((e) => (e.style.display = 'none')); return 1; })()",
      );
      await sleep(600);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/${lang}-${section}.png`, Buffer.from(shot.data, 'base64'));
      console.log(lang, section, 'scroll', target);
    }
  }
  ws.close();
} finally {
  edge.kill();
}

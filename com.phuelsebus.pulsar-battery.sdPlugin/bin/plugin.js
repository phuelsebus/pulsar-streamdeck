// Stream Deck plugin: battery level of a Pulsar mouse. Runs pulsar_battery.py and draws the key.
const { spawn } = require("child_process");
const path = require("path");
const WebSocket = require("ws");

const POLL_MS = 60_000;
const SCRIPT = path.join(__dirname, "pulsar_battery.py");
const PYTHONS = process.env.PULSAR_PYTHON ? [[process.env.PULSAR_PYTHON]] : [["python"], ["py", "-3"]];

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^-/, "")] = process.argv[i + 1];

const contexts = new Set();
let last = null; // { percent, charging } | { error }
let running = false;

function runWith(cmd) {
  return new Promise((resolve, reject) => {
    const [exe, ...pre] = cmd;
    const p = spawn(exe, [...pre, SCRIPT], { windowsHide: true });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", () => {
      try { resolve(JSON.parse(out.trim().split("\n").pop())); }
      catch { reject(new Error("Invalid output")); }
    });
    setTimeout(() => p.kill(), 8000);
  });
}

async function readBattery() {
  for (const cmd of PYTHONS) {
    try { return await runWith(cmd); } catch { /* try the next interpreter */ }
  }
  return { error: "Python not found" };
}

function svg(state) {
  const bg = "#16181d";
  if (!state || state.error) {
    const msg = state && state.error && /offline/i.test(state.error) ? "offline" : "?";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">
      <text x="72" y="84" font-family="Segoe UI,Arial" font-size="30" fill="#8a8f98" text-anchor="middle">${msg}</text></svg>`;
  }
  const p = Math.max(0, Math.min(100, state.percent));
  const color = state.charging ? "#3b9eff" : p <= 20 ? "#ff4d4d" : p <= 40 ? "#ffb02e" : "#3ddc84";
  const fill = Math.round((p / 100) * 84);
  const bolt = state.charging
    ? `<path d="M76 40 L58 72 H72 L66 100 L88 64 H74 Z" fill="#fff" stroke="${bg}" stroke-width="2"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">
    <rect x="18" y="30" width="96" height="48" rx="8" fill="none" stroke="#e8e9ec" stroke-width="5"/>
    <rect x="116" y="44" width="8" height="20" rx="3" fill="#e8e9ec"/>
    <rect x="24" y="36" width="${fill}" height="36" rx="4" fill="${color}"/>${bolt}
    <text x="72" y="123" font-family="Segoe UI,Arial" font-weight="700" font-size="38" fill="#fff" text-anchor="middle">${p}%</text></svg>`;
}

const ws = new WebSocket(`ws://127.0.0.1:${args.port}`);
const send = (o) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(o));

function render(context) {
  send({ event: "setImage", context, payload: { image: "data:image/svg+xml;charset=utf8," + encodeURIComponent(svg(last)), target: 0 } });
}

async function refresh() {
  if (running || contexts.size === 0) return;
  running = true;
  const res = await readBattery();
  // On a short failure (mouse asleep) keep the last good value
  if (res.error && last && !last.error) last = { ...last, stale: true };
  else last = res;
  running = false;
  contexts.forEach(render);
}

ws.on("open", () => send({ event: args.registerEvent, uuid: args.pluginUUID }));
ws.on("message", (raw) => {
  const m = JSON.parse(raw);
  if (m.event === "willAppear") { contexts.add(m.context); render(m.context); refresh(); }
  else if (m.event === "willDisappear") contexts.delete(m.context);
  else if (m.event === "keyDown") refresh();
});
setInterval(refresh, POLL_MS);
ws.on("close", () => process.exit(0));

const { spawn } = require("child_process");
const { WebSocketServer } = require("ws");
const path = require("path");

function startSidecar(port = 8765) {
  const wss = new WebSocketServer({ port });
  const clients = new Set();
  wss.on("connection", (ws) => { clients.add(ws); ws.on("close", () => clients.delete(ws)); });

  const py = spawn("python", [path.join(__dirname, "whisper_stream.py")], { stdio: ["ignore", "pipe", "inherit"] });
  let acc = "";
  py.stdout.on("data", (d) => {
    acc += d.toString();
    let nl;
    while ((nl = acc.indexOf("\n")) >= 0) {
      const line = acc.slice(0, nl).trim();
      acc = acc.slice(nl + 1);
      if (line) for (const ws of clients) { try { ws.send(line); } catch {} }
    }
  });
  py.on("exit", (code) => console.error(`[sidecar] python exited: ${code}`));
  return { wss, py, stop() { py.kill(); wss.close(); } };
}

module.exports = { startSidecar };

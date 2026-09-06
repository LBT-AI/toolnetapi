const pty = require("node-pty");
const fs = require("fs");
const path = require("path");

const cwd = path.join(require("os").tmpdir(), "test-dumb");
if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });

const ptyProcess = pty.spawn("/root/.config/manicode/freebuff", ["--cwd", cwd], {
  name: "dumb",
  cols: 120,
  rows: 4000,
  cwd: cwd,
  env: { ...process.env, FREEBUFF_CONFIG_DIR: "/root/ToolnetAPI/open-sse/services/freebuff/.accounts/thienbinhmedia.tv_at_gmail.com" }
});

let output = "";
ptyProcess.onData(data => output += data);
setTimeout(() => { fs.writeFileSync("dumb.log", output); process.exit(0); }, 3000);

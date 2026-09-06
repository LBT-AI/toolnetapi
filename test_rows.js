const pty = require("node-pty");
const fs = require("fs");
const path = require("path");

const binary = "/root/.config/manicode/freebuff";
const cwd = path.join(require("os").tmpdir(), "test-fb-rows");
if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });

const env = Object.assign({}, process.env, {
  FREEBUFF_CONFIG_DIR: "/root/ToolnetAPI/open-sse/services/freebuff/.accounts/thienbinhmedia.tv_at_gmail.com"
});

const ptyProcess = pty.spawn(binary, ["--cwd", cwd], {
  name: "xterm-256color",
  cols: 120,
  rows: 5000,
  cwd: cwd,
  env: env
});

let output = "";
ptyProcess.onData((data) => {
  output += data;
});

setTimeout(() => ptyProcess.write("\u001b[200~/end-session\u001b[201~\r"), 3000);
setTimeout(() => ptyProcess.write("\r"), 5000);
setTimeout(() => {
  ptyProcess.write("\u001b[200~Write a 50 line poem with line numbers.\u001b[201~");
  setTimeout(() => ptyProcess.write("\r"), 400);
}, 8000);

setTimeout(() => {
  fs.writeFileSync("test_rows.log", output);
  ptyProcess.write("/exit\r");
  setTimeout(() => process.exit(0), 1000);
}, 25000);

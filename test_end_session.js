const pty = require("node-pty");
const fs = require("fs");
const path = require("path");
const os = require("os");

const binary = "/root/.config/manicode/freebuff";
const cwd = path.join(os.tmpdir(), "test-fb-cli-end");
if (!fs.existsSync(cwd)) fs.mkdirSync(cwd, { recursive: true });

const env = Object.assign({}, process.env, {
  FREEBUFF_CONFIG_DIR: "/root/ToolnetAPI/open-sse/services/freebuff/.accounts/thienbinhmedia.tv_at_gmail.com"
});

const ptyProcess = pty.spawn(binary, ["--cwd", cwd], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd: cwd,
  env: env
});

let output = "";
ptyProcess.onData((data) => {
  output += data;
});

setTimeout(() => {
  ptyProcess.write("\u001b[200~/end-session\u001b[201~\r");
}, 3000);

setTimeout(() => {
  fs.writeFileSync("test_end_session_output.log", output);
  process.exit(0);
}, 6000);

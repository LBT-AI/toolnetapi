const pty = require("node-pty");
const fs = require("fs");
const path = require("path");
const os = require("os");

const binary = "/root/.config/manicode/freebuff";
const cwd = path.join(os.tmpdir(), "test-fb-cli-normal");
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
  fs.writeFileSync("test_cli_normal.log", output);
  ptyProcess.kill();
  process.exit(0);
}, 10000);

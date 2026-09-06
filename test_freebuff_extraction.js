const pty = require("node-pty");
const fs = require("fs");
const path = require("path");
const os = require("os");

const binary = "/root/.config/manicode/freebuff";
const cwd = path.join(os.tmpdir(), "test-fb-ext2");
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
  ptyProcess.write("\r"); // Select model
}, 3000);

setTimeout(() => {
  ptyProcess.write("\u001b[200~Reply exactly TOOLNET_FREEBUFF_OK\u001b[201~");
  setTimeout(() => ptyProcess.write("\r"), 400);
}, 6000);

setTimeout(() => {
  fs.writeFileSync("test_ext_output.log", output);
  ptyProcess.write("/exit\r");
  setTimeout(() => process.exit(0), 1000);
}, 18000);

#!/usr/bin/env node
import { Command } from "commander";
import { install } from "../src/commands/install.js";
import { start } from "../src/commands/start.js";
import { stop } from "../src/commands/stop.js";
import { restart } from "../src/commands/restart.js";
import { status } from "../src/commands/status.js";
import { pair } from "../src/commands/pair.js";
import { doctor } from "../src/commands/doctor.js";
import { uninstall } from "../src/commands/uninstall.js";

const program = new Command();

program
  .name("toolnet-agent")
  .description("ToolNet Local Agent - Windows MITM proxy agent")
  .version("0.1.0");

program
  .command("install")
  .description("Install agent (create config dir, generate CA)")
  .action(install);

program
  .command("start")
  .description("Start agent and MITM server")
  .option("--foreground", "Run in foreground (default)")
  .action(start);

program
  .command("stop")
  .description("Stop agent and MITM server")
  .action(stop);

program
  .command("restart")
  .description("Restart agent")
  .action(restart);

program
  .command("status")
  .description("Show agent status")
  .action(status);

program
  .command("pair")
  .description("Pair with ToolNet server")
  .option("--server <url>", "ToolNet server URL", "https://api.toolnet.tech")
  .action(pair);

program
  .command("doctor")
  .description("Run diagnostics")
  .action(doctor);

program
  .command("uninstall")
  .description("Uninstall agent and clean up")
  .option("--purge", "Also remove pairing config")
  .action(uninstall);

program.parse(process.argv);
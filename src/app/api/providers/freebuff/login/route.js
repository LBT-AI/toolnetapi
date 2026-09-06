import { NextResponse } from "next/server";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pty = require("node-pty");
import {
  getAccountEnv,
  getAccountHome,
  hasAccountCredentials,
  getAccountInfo,
  resolveFreebuffBinary,
  ensureAccountDir,
} from "open-sse/services/freebuff/accountManager.js";
import { updateProviderConnection } from "@/models";

// Store active login PTY processes by connectionId
const activeLoginSessions = new Map();

export async function POST(request) {
  try {
    const body = await request.json();
    const { connectionId, action = "start" } = body;

    if (!connectionId) {
      return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
    }

    ensureAccountDir(connectionId);

    if (action === "check") {
      const loggedIn = hasAccountCredentials(connectionId);
      if (loggedIn) {
        const info = getAccountInfo(connectionId);
        // Clean up login session if still alive
        const session = activeLoginSessions.get(connectionId);
        if (session) {
          try { session.kill(); } catch { /* ignore */ }
          activeLoginSessions.delete(connectionId);
        }

        // Update connection in database
        try {
          await updateProviderConnection(connectionId, {
            isActive: 1,
            testStatus: "active",
            email: info?.email || undefined,
            name: info?.name || info?.email || undefined,
          });
        } catch {
          /* ignore db update error */
        }

        return NextResponse.json({
          loggedIn: true,
          accountInfo: info,
        });
      }

      return NextResponse.json({ loggedIn: false });
    }

    // action === "start"
    // Clean up any existing login process for this account
    if (activeLoginSessions.has(connectionId)) {
      try {
        activeLoginSessions.get(connectionId).kill();
      } catch {
        /* ignore */
      }
      activeLoginSessions.delete(connectionId);
    }

    const binary = resolveFreebuffBinary();
    const env = getAccountEnv(connectionId);
    const cwd = getAccountHome(connectionId);

    const loginProc = pty.spawn(binary, ["login"], {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd,
      env,
    });

    activeLoginSessions.set(connectionId, loginProc);

    loginProc.onExit(() => {
      activeLoginSessions.delete(connectionId);
    });

    // Capture stdout looking for the login URL
    const loginUrlPromise = new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(() => {
        resolve({ loginUrl: null, timeout: true });
      }, 12000);

      loginProc.onData((data) => {
        output += data;

        // Auto-reply to terminal queries
        if (data.includes("\u001b]11;?")) loginProc.write("\u001b]11;rgb:0000/0000/0000\u0007");
        if (data.includes("\u001b]10;?")) loginProc.write("\u001b]10;rgb:ffff/ffff/ffff\u0007");
        if (data.includes("\u001b[6n")) loginProc.write("\u001b[1;1R");

        const urlMatch = output.match(/https:\/\/freebuff\.com\/login\?auth_code=[a-zA-Z0-9_-]+/);
        if (urlMatch) {
          clearTimeout(timer);
          resolve({ loginUrl: urlMatch[0] });
        }
      });
    });

    const result = await loginUrlPromise;
    if (result.loginUrl) {
      return NextResponse.json({
        success: true,
        loginUrl: result.loginUrl,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Could not retrieve login URL from Freebuff CLI within 12 seconds",
    }, { status: 504 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

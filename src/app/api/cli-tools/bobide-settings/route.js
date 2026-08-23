"use server";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

const getBobDir = () => path.join(os.homedir(), ".bob");
const getBobideDir = () => path.join(os.homedir(), ".bobide");
const getBobSettingsPath = () => path.join(getBobDir(), "settings.json");
const getBobideSettingsPath = () => path.join(getBobideDir(), "settings.json");

// Check if Bob CLI / IDE is installed
const checkBobInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const commands = isWindows ? ["where bob", "where bobide"] : ["which bob", "which bobide"];
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;

    for (const cmd of commands) {
      try {
        await execAsync(cmd, { windowsHide: true, env });
        return true;
      } catch {
        // try next command
      }
    }
  } catch {
    // fallback to checking directories
  }

  try {
    await fs.access(getBobDir());
    return true;
  } catch {
    try {
      await fs.access(getBobideDir());
      return true;
    } catch {
      return false;
    }
  }
};

// Read settings JSON safely
const readSettings = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const stripped = content.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
};

// Check if settings contain ToolNet API configuration
const hasToolNetAPIConfig = (settings) => {
  if (!settings) return false;
  if (settings.customModels && Array.isArray(settings.customModels)) {
    if (settings.customModels.some((m) => m.id?.startsWith("custom:ToolNet API") || m.name?.includes("ToolNet API"))) {
      return true;
    }
  }
  if (settings.providers?.["toolnetapi"] || settings.providers?.["toolnet"]) {
    return true;
  }
  if (settings["bob.api.baseUrl"] && (settings["bob.api.baseUrl"].includes("localhost") || settings["bob.api.baseUrl"].includes("127.0.0.1") || settings["bob.api.baseUrl"].includes("toolnet"))) {
    return true;
  }
  return false;
};

// GET - Check Bob IDE / CLI installation and read settings
export async function GET() {
  try {
    const isInstalled = await checkBobInstalled();

    if (!isInstalled) {
      return NextResponse.json({
        installed: false,
        settings: null,
        message: "IBM Bob IDE / CLI is not installed",
      });
    }

    const settings = (await readSettings(getBobSettingsPath())) || (await readSettings(getBobideSettingsPath())) || {};

    return NextResponse.json({
      installed: true,
      settings,
      hasToolNetAPI: hasToolNetAPIConfig(settings),
      settingsPath: getBobSettingsPath(),
    });
  } catch (error) {
    console.log("Error checking Bob settings:", error);
    return NextResponse.json({ error: "Failed to check Bob settings" }, { status: 500 });
  }
}

// POST - Update Bob settings with ToolNet API models
export async function POST(request) {
  try {
    const { baseUrl, apiKey, model, models, activeModel } = await request.json();

    const modelsArray = Array.isArray(models)
      ? models.slice()
      : typeof model === "string" && model
        ? [model]
        : [];

    if (!baseUrl || modelsArray.length === 0) {
      return NextResponse.json({ error: "baseUrl and at least one model are required" }, { status: 400 });
    }

    const bobDir = getBobDir();
    const bobideDir = getBobideDir();
    const settingsPath = getBobSettingsPath();
    const bobideSettingsPath = getBobideSettingsPath();

    await fs.mkdir(bobDir, { recursive: true });
    await fs.mkdir(bobideDir, { recursive: true });

    let settings = (await readSettings(settingsPath)) || (await readSettings(bobideSettingsPath)) || {};

    if (!settings.customModels) {
      settings.customModels = [];
    }

    // Remove existing ToolNet API custom models
    settings.customModels = settings.customModels.filter(
      (m) => !m.id?.startsWith("custom:ToolNet API") && !m.name?.includes("ToolNet API")
    );

    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
    const keyToUse = apiKey || "sk_toolnetapi";

    let defaultIndex = 0;
    if (typeof activeModel === "string") {
      if (activeModel === "") {
        defaultIndex = -1;
      } else {
        const idx = modelsArray.indexOf(activeModel);
        defaultIndex = idx >= 0 ? idx : 0;
      }
    }

    // Add model configurations
    for (let i = 0; i < modelsArray.length; i++) {
      const m = modelsArray[i];
      if (!m || typeof m !== "string") continue;
      settings.customModels.push({
        id: `custom:ToolNet API-${i}`,
        name: `ToolNet API - ${m}`,
        model: m,
        baseUrl: normalizedBaseUrl,
        apiKey: keyToUse,
        provider: "openai",
        index: i,
        maxOutputTokens: 131072,
      });
    }

    if (defaultIndex >= 0 && settings.customModels[defaultIndex]) {
      const [defaultEntry] = settings.customModels.splice(defaultIndex, 1);
      settings.customModels.unshift({ ...defaultEntry, index: 0 });
      settings.customModels.forEach((m, i) => {
        m.index = i;
      });
    }

    if (!settings.providers) {
      settings.providers = {};
    }
    settings.providers["toolnetapi"] = {
      type: "openai-compatible",
      baseUrl: normalizedBaseUrl,
      apiKey: keyToUse,
      models: modelsArray,
      defaultModel: modelsArray[defaultIndex >= 0 ? defaultIndex : 0] || modelsArray[0],
    };

    settings["bob.api.baseUrl"] = normalizedBaseUrl;
    settings["bob.api.apiKey"] = keyToUse;
    settings["bob.defaultModel"] = modelsArray[defaultIndex >= 0 ? defaultIndex : 0] || modelsArray[0];

    const content = JSON.stringify(settings, null, 2);
    await fs.writeFile(settingsPath, content, "utf-8");
    try {
      await fs.writeFile(bobideSettingsPath, content, "utf-8");
    } catch {
      // secondary path best effort
    }

    return NextResponse.json({
      success: true,
      message: "IBM Bob settings applied successfully!",
      settingsPath,
    });
  } catch (error) {
    console.log("Error updating Bob settings:", error);
    return NextResponse.json({ error: "Failed to update Bob settings" }, { status: 500 });
  }
}

// DELETE - Remove ToolNet API configuration
export async function DELETE() {
  try {
    const settingsPath = getBobSettingsPath();
    const bobideSettingsPath = getBobideSettingsPath();

    let settings = (await readSettings(settingsPath)) || (await readSettings(bobideSettingsPath));

    if (!settings) {
      return NextResponse.json({ success: true, message: "No settings file to reset" });
    }

    if (settings.customModels) {
      settings.customModels = settings.customModels.filter(
        (m) => !m.id?.startsWith("custom:ToolNet API") && !m.name?.includes("ToolNet API")
      );
      if (settings.customModels.length === 0) {
        delete settings.customModels;
      }
    }

    if (settings.providers) {
      delete settings.providers["toolnetapi"];
      delete settings.providers["toolnet"];
      if (Object.keys(settings.providers).length === 0) {
        delete settings.providers;
      }
    }

    delete settings["bob.api.baseUrl"];
    delete settings["bob.api.apiKey"];
    delete settings["bob.defaultModel"];

    const content = JSON.stringify(settings, null, 2);
    await fs.writeFile(settingsPath, content, "utf-8");
    try {
      await fs.writeFile(bobideSettingsPath, content, "utf-8");
    } catch {
      // secondary path best effort
    }

    return NextResponse.json({
      success: true,
      message: "ToolNet API settings removed from IBM Bob",
    });
  } catch (error) {
    console.log("Error resetting Bob settings:", error);
    return NextResponse.json({ error: "Failed to reset Bob settings" }, { status: 500 });
  }
}

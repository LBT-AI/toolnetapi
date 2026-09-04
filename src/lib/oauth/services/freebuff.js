import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { FREEBUFF_CONFIG } from "../constants/oauth.js";

/**
 * Freebuff OAuth / Multi-Account Service
 * Handles Freebuff browser login flow, status polling, token validation, and CLI credentials import.
 */
export class FreebuffService {
  constructor() {
    this.config = FREEBUFF_CONFIG;
  }

  /**
   * Generate enhanced fingerprint ID matching Freebuff CLI format
   */
  generateFingerprintId() {
    const random = randomBytes(24).toString("base64url");
    return `enhanced-${random}`;
  }

  /**
   * Request login code from Freebuff auth API
   * Calls POST https://freebuff.com/api/auth/cli/code
   */
  async requestLoginCode(fingerprintId = null) {
    const fpId = fingerprintId || this.generateFingerprintId();
    const url = this.config.loginCodeUrl || "https://freebuff.com/api/auth/cli/code";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "freebuff-cli",
      },
      body: JSON.stringify({ fingerprintId: fpId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Failed to request Freebuff login URL (${res.status}): ${text}`);
    }

    const data = await res.json();
    return {
      fingerprintId: data.fingerprintId || fpId,
      fingerprintHash: data.fingerprintHash,
      loginUrl: data.loginUrl,
      expiresAt: data.expiresAt,
      expiresInMs: data.expiresInMs,
    };
  }

  /**
   * Poll login status from Freebuff auth API
   * Calls GET https://freebuff.com/api/auth/cli/status
   */
  async pollLoginStatus({ fingerprintId, fingerprintHash, expiresAt }) {
    if (!fingerprintId || !fingerprintHash) {
      throw new Error("fingerprintId and fingerprintHash are required");
    }

    const params = new URLSearchParams({
      fingerprintId,
      fingerprintHash,
      expiresAt: String(expiresAt || ""),
    });

    const url = `${this.config.loginStatusUrl || "https://freebuff.com/api/auth/cli/status"}?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "freebuff-cli",
      },
    });

    if (res.status === 401) {
      return { status: "pending" };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || errData?.message || `HTTP ${res.status}`;
      return { status: "error", error: errMsg };
    }

    const data = await res.json();
    if (data?.user && typeof data.user === "object") {
      return {
        status: "success",
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          authToken: data.user.authToken,
          fingerprintId: data.user.fingerprintId || fingerprintId,
          fingerprintHash: data.user.fingerprintHash || fingerprintHash,
        },
      };
    }

    return { status: "pending" };
  }

  /**
   * Get user profile info from token
   * Calls GET https://www.codebuff.com/api/v1/me?fields=id,email
   */
  async getUserInfo(authToken) {
    if (!authToken) throw new Error("Auth token is required");
    const url = this.config.meUrl || "https://www.codebuff.com/api/v1/me?fields=id,email";

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "User-Agent": "freebuff-cli",
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Freebuff authentication failed (${res.status}): ${err}`);
    }

    return await res.json();
  }

  /**
   * Get usage & quota details
   */
  async getUsage(authToken, fingerprintId = "cli-usage") {
    const url = this.config.usageUrl || "https://www.codebuff.com/api/v1/usage";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "freebuff-cli",
      },
      body: JSON.stringify({ fingerprintId: fingerprintId || "cli-usage" }),
    });

    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * Get Freebuff active session info and model quotas
   */
  async getFreebuffSession(authToken) {
    const url = this.config.sessionUrl || "https://www.codebuff.com/api/v1/freebuff/session";
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "User-Agent": "freebuff-cli",
      },
    });

    if (!res.ok) return null;
    return await res.json();
  }

  /**
   * Auto-detect local credentials from ~/.config/manicode/credentials.json
   */
  async readLocalCredentials() {
    const configPath = join(homedir(), ".config", "manicode", "credentials.json");
    try {
      const content = await readFile(configPath, "utf-8");
      const parsed = JSON.parse(content);
      const accounts = [];

      for (const [key, val] of Object.entries(parsed)) {
        if (val && typeof val === "object" && val.authToken) {
          accounts.push({
            profileKey: key,
            id: val.id || null,
            name: val.name || key,
            email: val.email || null,
            authToken: val.authToken,
            fingerprintId: val.fingerprintId || null,
            fingerprintHash: val.fingerprintHash || null,
          });
        }
      }

      return { found: accounts.length > 0, accounts, configPath };
    } catch {
      return { found: false, accounts: [], configPath };
    }
  }
}

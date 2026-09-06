import crypto from "crypto";

const BASE64_BLOCK_SIZE = 4;

function validateXaiOAuthEndpoint(rawUrl, field) {
  const value = String(rawUrl || "").trim();
  if (!value) throw new Error(`xai discovery ${field} is empty`);
  let parsed;
  try { parsed = new URL(value); } catch (err) {
    throw new Error(`xai discovery ${field} is invalid: ${err.message}`);
  }
  if (parsed.protocol !== "https:") throw new Error(`xai discovery ${field} must use https: ${value}`);
  const host = parsed.hostname.toLowerCase().trim();
  if (host !== "x.ai" && !host.endsWith(".x.ai")) {
    throw new Error(`xai discovery ${field} host ${host} is not on x.ai`);
  }
  return value;
}

function decodeXaiIdTokenEmail(idToken) {
  if (!idToken || typeof idToken !== "string") return undefined;
  const parts = idToken.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = (BASE64_BLOCK_SIZE - (base64.length % BASE64_BLOCK_SIZE)) % BASE64_BLOCK_SIZE;
    const json = Buffer.from(base64 + "=".repeat(padding), "base64").toString("utf8");
    const payload = JSON.parse(json);
    return payload.email || payload.preferred_username || payload.sub || undefined;
  } catch {
    return undefined;
  }
}

function decodeJwtPayload(jwt) {
  try {
    if (!jwt || typeof jwt !== "string") return null;
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const missingPadding = (BASE64_BLOCK_SIZE - (base64.length % BASE64_BLOCK_SIZE)) % BASE64_BLOCK_SIZE;
    const padded = base64 + "=".repeat(missingPadding);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function extractEmailFromAccessToken(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return undefined;
  return payload.email || payload.preferred_username || payload.sub || undefined;
}

export async function fetchKiroProfileArn(accessToken) {
  if (!accessToken) return null;
  try {
    const response = await fetch("https://codewhisperer.us-east-1.amazonaws.com/ListAvailableProfiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ maxResults: 10 }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.profiles?.find((p) => p.arn?.trim())?.arn?.trim() || null;
  } catch {
    return null;
  }
}

export function extractCodexAccountInfo(idToken) {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return {};
  const chatgpt = payload["https://api.openai.com/auth"] || {};
  return {
    email: payload.email,
    chatgptAccountId: chatgpt.chatgpt_account_id || payload.account_id,
    chatgptPlanType: chatgpt.chatgpt_plan_type || payload.plan_type,
  };
}

export function extractKiroClaims(token) {
  if (!token || typeof token !== "string") return {};
  const payload = decodeJwtPayload(token);
  if (!payload) return {};
  const rawEmail = payload.email || payload.preferred_username || payload.upn || payload.user_name || undefined;
  return {
    email: typeof rawEmail === "string" ? rawEmail.trim() : undefined,
    sub: typeof payload.sub === "string" ? payload.sub.trim() : undefined,
    username: typeof payload.preferred_username === "string" ? payload.preferred_username.trim() : undefined,
    payload,
  };
}

export function resolveKiroIdentity(tokens = {}, options = {}) {
  const idClaims = extractKiroClaims(tokens.id_token || tokens.idToken);
  const accessClaims = extractKiroClaims(tokens.access_token || tokens.accessToken);

  const rawEmail = options.email || idClaims.email || accessClaims.email || tokens.email || null;
  const normalizedEmail = rawEmail && typeof rawEmail === "string" && rawEmail.includes("@")
    ? rawEmail.trim().toLowerCase()
    : null;

  const sub = idClaims.sub || accessClaims.sub || options.sub || tokens.sub || null;
  const profileArn = options.profileArn || tokens.profile_arn || tokens.profileArn || null;
  const rawLabel = options.accountLabel || options.name || tokens.accountLabel || tokens.name || null;
  const accountLabel = rawLabel && typeof rawLabel === "string" && rawLabel.trim() ? rawLabel.trim() : null;

  let finalEmail = normalizedEmail;
  if (!finalEmail && accountLabel && accountLabel.includes("@") && !accountLabel.includes(" ")) {
    finalEmail = accountLabel.toLowerCase();
  }

  let identityKey = null;
  if (finalEmail) {
    identityKey = `email:${finalEmail}`;
  } else if (sub) {
    identityKey = `sub:${sub}`;
  } else if (profileArn) {
    identityKey = `arn:${profileArn}`;
  } else if (accountLabel && !/^account\s+\d+$/i.test(accountLabel)) {
    identityKey = `label:${accountLabel.toLowerCase()}`;
  } else {
    const tokenSource = tokens.refreshToken || tokens.refresh_token || tokens.accessToken || tokens.access_token;
    if (tokenSource && typeof tokenSource === "string") {
      const hash = crypto.createHash("sha256").update(tokenSource).digest("hex").slice(0, 16);
      identityKey = `kiro:${hash}`;
    }
  }

  let shortProfile = null;
  if (profileArn) {
    const parts = profileArn.split("/");
    const last = parts[parts.length - 1];
    shortProfile = `Profile …${last.length > 8 ? last.slice(-6) : last}`;
  }

  let displayName;
  if (accountLabel && !/^account\s+\d+$/i.test(accountLabel)) {
    displayName = accountLabel;
  } else if (finalEmail) {
    displayName = finalEmail;
  } else if (shortProfile) {
    displayName = shortProfile;
  } else if (sub) {
    displayName = `AWS User (${sub.slice(0, 8)})`;
  } else if (identityKey && identityKey.startsWith("kiro:")) {
    displayName = `AWS Builder ID (${identityKey.slice(5, 11)})`;
  } else {
    displayName = accountLabel || "AWS Builder ID";
  }

  return {
    email: finalEmail,
    sub,
    profileArn,
    identityKey,
    accountLabel,
    displayName,
  };
}

export {
  BASE64_BLOCK_SIZE,
  validateXaiOAuthEndpoint,
  decodeXaiIdTokenEmail,
  decodeJwtPayload,
  extractEmailFromAccessToken,
};

import { describe, expect, it } from "vitest";
import { redactProviderSecrets } from "../../src/lib/providerRedaction.js";

describe("Freebuff secret redaction for provider APIs", () => {
  it("strips authToken / fingerprint secrets from providerSpecificData", () => {
    const raw = {
      userId: "usr_123",
      name: "Acc One",
      authMethod: "cli_import",
      authToken: "super-secret-token",
      fingerprintId: "enhanced-abc",
      fingerprintHash: "hash-abc",
    };

    const safe = redactProviderSecrets("freebuff", raw);

    expect(safe.userId).toBe("usr_123");
    expect(safe.name).toBe("Acc One");
    expect(safe.authMethod).toBe("cli_import");
    expect(safe.authToken).toBeUndefined();
    expect(safe.fingerprintId).toBeUndefined();
    expect(safe.fingerprintHash).toBeUndefined();
    expect(JSON.stringify(safe)).not.toContain("super-secret-token");
  });

  it("does not mutate the stored record", () => {
    const raw = { authToken: "keep-me-in-db", userId: "u1" };
    const safe = redactProviderSecrets("freebuff", raw);

    expect(raw.authToken).toBe("keep-me-in-db");
    expect(safe).not.toBe(raw);
  });

  it("passes through non-object and empty payloads unchanged", () => {
    expect(redactProviderSecrets("freebuff", null)).toBeNull();
    expect(redactProviderSecrets("freebuff", undefined)).toBeUndefined();
    expect(redactProviderSecrets("freebuff", "raw")).toBe("raw");
  });
});

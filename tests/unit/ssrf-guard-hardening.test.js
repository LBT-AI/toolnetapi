import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns", () => ({
  default: { promises: { lookup: lookupMock } },
  promises: { lookup: lookupMock },
}));

const { assertPublicUrl, assertPublicUrlResolved, fetchPublic } = await import("../../src/shared/utils/ssrfGuard.js");

describe("assertPublicUrl SSRF hardening", () => {
  it("blocks trailing-dot localhost", () => {
    expect(() => assertPublicUrl("http://localhost/")).toThrow();
    expect(() => assertPublicUrl("http://localhost./")).toThrow();
    expect(() => assertPublicUrl("http://LOCALHOST./")).toThrow();
  });

  it("blocks IPv4-mapped IPv6 private addresses", () => {
    expect(() => assertPublicUrl("http://[::ffff:127.0.0.1]/")).toThrow();
    expect(() => assertPublicUrl("http://[::ffff:7f00:1]/")).toThrow();
    expect(() => assertPublicUrl("http://[::ffff:169.254.169.254]/")).toThrow();
    expect(() => assertPublicUrl("http://[::ffff:a9fe:a9fe]/")).toThrow();
  });

  it("blocks private/link-local IPv6 and NAT64 private mappings", () => {
    for (const url of [
      "http://[::1]/",
      "http://[::127.0.0.1]/",
      "http://[fe80::1]/",
      "http://[fc00::1]/",
      "http://[fd12:3456::1]/",
      "http://[64:ff9b::127.0.0.1]/",
    ]) {
      expect(() => assertPublicUrl(url), url).toThrow();
    }
  });

  it("still allows public hosts", () => {
    expect(() => assertPublicUrl("https://api.openai.com/v1/models")).not.toThrow();
    expect(() => assertPublicUrl("http://8.8.8.8/")).not.toThrow();
    expect(() => assertPublicUrl("https://[2001:4860:4860::8888]/")).not.toThrow();
  });
});

describe("assertPublicUrlResolved DNS hardening", () => {
  beforeEach(() => lookupMock.mockReset());

  it("blocks a hostname resolving to loopback", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(assertPublicUrlResolved("http://127.0.0.1.nip.io/")).rejects.toThrow();
  });

  it("blocks a hostname resolving to any private address", async () => {
    lookupMock.mockResolvedValue([
      { address: "203.0.113.5", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(assertPublicUrlResolved("http://multi-a-record.example.test/")).rejects.toThrow();
  });

  it("allows public DNS results", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertPublicUrlResolved("https://example.com/")).resolves.not.toThrow();
  });
});

describe("fetchPublic redirect validation", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
  });

  it("blocks redirects to internal targets", async () => {
    global.fetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1:9999/admin" },
    }));

    await expect(fetchPublic("https://public.example.test/redirect")).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("follows safe public redirects", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://hop2.example.test/" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const res = await fetchPublic("https://hop1.example.test/");
    expect(await res.text()).toBe("ok");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("bounds redirect chains", async () => {
    global.fetch = vi.fn(async (url) => new Response(null, {
      status: 302,
      headers: { Location: url === "https://loop.example.test/a" ? "https://loop.example.test/b" : "https://loop.example.test/a" },
    }));

    await expect(fetchPublic("https://loop.example.test/a", {}, { maxRedirects: 3 })).rejects.toThrow(/too many redirects/i);
  });
});

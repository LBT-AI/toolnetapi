import { describe, it, expect } from "vitest";
import { handleSttCore } from "../../open-sse/handlers/sttCore.js";
import selfhostedTts from "../../open-sse/handlers/ttsProviders/selfhostedTts.js";
import selfhostedEmbedding, { MissingBaseUrlError } from "../../open-sse/handlers/embeddingProviders/selfhostedEmbedding.js";
import { HTTP_STATUS } from "../../open-sse/config/runtimeConfig.js";

describe("Self-hosted STT", () => {
  it("returns HTTP 400 when baseUrl is missing", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["fake audio"], { type: "audio/wav" }), "test.wav");

    const res = await handleSttCore({
      provider: "selfhosted-stt",
      model: "whisper-1",
      formData,
      credentials: {},
      sttConfig: { format: "openai", authType: "apikey" },
    });

    expect(res.success).toBe(false);
    expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(res.error).toContain("requires a baseUrl configuration");
  });
});

describe("Self-hosted TTS", () => {
  it("throws error (400) when baseUrl is missing", async () => {
    await expect(selfhostedTts.synthesize("hello", "kokoro", {})).rejects.toThrow(
      "Self-hosted TTS requires a baseUrl configuration"
    );
  });
});

describe("Self-hosted Embedding (OpenAI Leak Protection)", () => {
  it("throws MissingBaseUrlError and refuses to fall back to api.openai.com when baseUrl is missing", () => {
    expect(() => selfhostedEmbedding.buildUrl("embedding", {})).toThrow(MissingBaseUrlError);
    expect(() => selfhostedEmbedding.buildUrl("embedding", { providerSpecificData: { baseUrl: "" } })).toThrow(
      MissingBaseUrlError
    );
  });

  it("builds correct /embeddings URL when baseUrl is supplied", () => {
    const url = selfhostedEmbedding.buildUrl("embedding", {
      providerSpecificData: { baseUrl: "http://my-vps:8080/v1" },
    });
    expect(url).toBe("http://my-vps:8080/v1/embeddings");
  });
});

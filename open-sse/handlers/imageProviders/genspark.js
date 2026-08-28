// Genspark image generation adapter
import { nowSec } from "./_base.js";

const BASE_URL = "https://www.genspark.ai/api/tool_cli/image_generation";

export default {
  buildUrl: () => BASE_URL,
  buildHeaders: (creds) => {
    const key = creds?.apiKey || creds?.accessToken;
    return {
      "Content-Type": "application/json",
      "X-Api-Key": key || "",
      "Authorization": key ? `Bearer ${key}` : "",
      "X-GSK-CLI-Caps": "cli-groups-v2,cli-paths-v3,cli-actions-v4",
      "X-GSK-CLI-Version": "1.7.1",
    };
  },
  buildBody: (model, body) => {
    const cleanModel = model?.replace(/^genspark\//, "") || "nano-banana-2-flash-lite";
    const req = {
      query: body.prompt,
      model: cleanModel,
    };
    if (body.aspect_ratio) req.aspect_ratio = body.aspect_ratio;
    if (body.size) req.image_size = body.size;
    if (Array.isArray(body.image_urls)) req.image_urls = body.image_urls;
    else if (body.image) req.image_urls = [body.image];
    return req;
  },
  async parseResponse(response) {
    const text = await response.text();
    const lines = text.trim().split("\n");
    let finalResult = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("{")) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.status || parsed.version === undefined) {
          finalResult = parsed;
        }
      } catch {}
    }
    if (!finalResult) throw new Error("No valid response from Genspark");
    if (finalResult.status === "error") throw new Error(finalResult.message || "Genspark image generation failed");
    return finalResult;
  },
  normalize: (responseBody, prompt) => {
    const data = responseBody.data || responseBody;
    const generated = data?.generated_images?.[0];
    const url = generated?.image_urls_nowatermark?.[0]
      || generated?.image_urls?.[0]
      || data?.image_url
      || data?.url
      || (Array.isArray(data?.images) ? data.images[0] : null);
    if (url) {
      return {
        created: nowSec(),
        data: [{ url, revised_prompt: prompt }],
      };
    }
    return { created: nowSec(), data: [] };
  },
};

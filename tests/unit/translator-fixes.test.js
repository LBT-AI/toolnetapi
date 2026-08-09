import { describe, it, expect } from "vitest";
import { hasValidContent, prepareClaudeRequest } from "../../open-sse/translator/formats/claude.js";
import { cleanJSONSchemaForAntigravity, UNSUPPORTED_SCHEMA_CONSTRAINTS } from "../../open-sse/translator/formats/gemini.js";

describe("Claude format - hasValidContent & prepareClaudeRequest", () => {
  it("recognizes image-only content as valid content", () => {
    const msg = {
      role: "user",
      content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "xyz" } }]
    };
    expect(hasValidContent(msg)).toBe(true);
  });

  it("recognizes document-only content as valid content", () => {
    const msg = {
      role: "user",
      content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: "xyz" } }]
    };
    expect(hasValidContent(msg)).toBe(true);
  });

  it("does not drop image-only user message during prepareClaudeRequest", () => {
    const body = {
      model: "claude-sonnet-5",
      messages: [
        {
          role: "user",
          content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "123" } }]
        }
      ]
    };
    const prepared = prepareClaudeRequest({ ...body }, "claude");
    expect(prepared.messages).toHaveLength(1);
    expect(prepared.messages[0].content[0].type).toBe("image");
  });
});

describe("Gemini format - cleanJSONSchemaForAntigravity", () => {
  it("includes all requested unsupported constraints in UNSUPPORTED_SCHEMA_CONSTRAINTS", () => {
    const requiredList = [
      "multipleOf", "uniqueItems", "contains",
      "unevaluatedProperties", "unevaluatedItems", "contentSchema"
    ];
    for (const kw of requiredList) {
      expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain(kw);
    }
  });

  it("strips unsupported keywords recursively from schema", () => {
    const inputSchema = {
      type: "object",
      properties: {
        count: { type: "number", multipleOf: 2 },
        tags: { type: "array", items: { type: "string" }, uniqueItems: true, contains: { type: "string" } },
        nested: { type: "object", unevaluatedProperties: false, contentSchema: { type: "string" } }
      },
      unevaluatedItems: false
    };

    const cleaned = cleanJSONSchemaForAntigravity(inputSchema);
    expect(cleaned.properties.count.multipleOf).toBeUndefined();
    expect(cleaned.properties.tags.uniqueItems).toBeUndefined();
    expect(cleaned.properties.tags.contains).toBeUndefined();
    expect(cleaned.properties.nested.unevaluatedProperties).toBeUndefined();
    expect(cleaned.properties.nested.contentSchema).toBeUndefined();
    expect(cleaned.unevaluatedItems).toBeUndefined();
  });
});

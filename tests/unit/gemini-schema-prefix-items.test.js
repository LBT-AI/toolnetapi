import { describe, expect, it } from "vitest";
import { cleanJSONSchemaForAntigravity } from "open-sse/translator/formats/gemini.js";

describe("cleanJSONSchemaForAntigravity prefixItems and array items", () => {
  it("converts single prefixItem into items and strips prefixItems", () => {
    const schema = {
      type: "object",
      properties: {
        tupleProp: {
          type: "array",
          prefixItems: [{ type: "string" }],
        },
      },
    };
    const cleaned = cleanJSONSchemaForAntigravity(schema);
    expect(cleaned.properties.tupleProp.items).toEqual({ type: "string" });
    expect(cleaned.properties.tupleProp.prefixItems).toBeUndefined();
  });

  it("converts multi prefixItems into anyOf items and then flattens for Gemini", () => {
    const schema = {
      type: "object",
      properties: {
        multiTuple: {
          type: "array",
          prefixItems: [{ type: "string" }, { type: "number" }],
        },
      },
    };
    const cleaned = cleanJSONSchemaForAntigravity(schema);
    // anyOf is flattened to the best single variant for Gemini Antigravity compatibility
    expect(cleaned.properties.multiTuple.items).toEqual({ type: "string" });
    expect(cleaned.properties.multiTuple.prefixItems).toBeUndefined();
  });

  it("ensures array type has default items placeholder if missing", () => {
    const schema = {
      type: "object",
      properties: {
        rawArray: {
          type: "array",
        },
      },
    };
    const cleaned = cleanJSONSchemaForAntigravity(schema);
    expect(cleaned.properties.rawArray.items).toEqual({ type: "string" });
  });
});

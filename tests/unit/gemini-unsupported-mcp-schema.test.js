/**
 * Regression tests for unsupported MCP JSON Schema annotations.
 * Gemini/Antigravity rejects unknown schema keys with HTTP 400.
 */
import { describe, it, expect } from "vitest";
import {
  cleanJSONSchemaForAntigravity,
  UNSUPPORTED_SCHEMA_CONSTRAINTS,
} from "../../open-sse/translator/formats/gemini.js";

describe("Gemini unsupported MCP schema annotations", () => {
  it.each([
    "errorMessage",
    "errorMessages",
    "x-errorMessage",
    "x-errorMessages",
    "markdownDescription",
    "x-intellij-html-description",
    "x-taplo-info",
    "x-taplo",
    "doNotSuggest",
    "suggestSortText",
    "minProperties",
    "maxProperties",
    "~optional",
  ])("strips %s from the unsupported keyword list", (keyword) => {
    expect(UNSUPPORTED_SCHEMA_CONSTRAINTS).toContain(keyword);
  });

  it("strips unsupported annotations recursively without changing valid schema fields", () => {
    const schema = {
      type: "object",
      description: "Valid MCP tool",
      errorMessage: "Invalid input",
      minProperties: 1,
      maxProperties: 5,
      properties: {
        name: {
          type: "string",
          markdownDescription: "Display name",
          errorMessages: ["Required"],
        },
        items: {
          type: "array",
          items: {
            type: "object",
            "~optional": true,
            "x-taplo-info": { key: "value" },
            properties: { id: { type: "string" } },
          },
        },
      },
    };

    const result = cleanJSONSchemaForAntigravity(structuredClone(schema));

    expect(result).not.toHaveProperty("errorMessage");
    expect(result).not.toHaveProperty("minProperties");
    expect(result).not.toHaveProperty("maxProperties");
    expect(result.description).toBe("Valid MCP tool");
    expect(result.properties.name).not.toHaveProperty("markdownDescription");
    expect(result.properties.name).not.toHaveProperty("errorMessages");
    expect(result.properties.items.items).not.toHaveProperty("~optional");
    expect(result.properties.items.items).not.toHaveProperty("x-taplo-info");
    expect(result.properties.items.items.properties.id.type).toBe("string");
  });
});

import { describe, it, expect } from "vitest";
import { DEFAULT_WEB_URL, resolveWebUrl, WEB_URL_ENV } from "./url.js";

describe("resolveWebUrl", () => {
  it("returns the default URL when WAYPOINT_WEB_URL is unset", () => {
    expect(resolveWebUrl({})).toBe(DEFAULT_WEB_URL);
  });

  it("returns the default URL when WAYPOINT_WEB_URL is empty or whitespace", () => {
    expect(resolveWebUrl({ [WEB_URL_ENV]: "" })).toBe(DEFAULT_WEB_URL);
    expect(resolveWebUrl({ [WEB_URL_ENV]: "   " })).toBe(DEFAULT_WEB_URL);
  });

  it("honours a valid http override", () => {
    expect(resolveWebUrl({ [WEB_URL_ENV]: "http://localhost:8080" })).toBe(
      "http://localhost:8080/",
    );
  });

  it("honours a valid https override", () => {
    expect(resolveWebUrl({ [WEB_URL_ENV]: "https://waypoint.example.com" })).toBe(
      "https://waypoint.example.com/",
    );
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(resolveWebUrl({ [WEB_URL_ENV]: "  http://localhost:5273  " })).toBe(
      "http://localhost:5273/",
    );
  });

  it("throws on a malformed URL", () => {
    expect(() => resolveWebUrl({ [WEB_URL_ENV]: "not a url" })).toThrow(/not a valid URL/);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(() => resolveWebUrl({ [WEB_URL_ENV]: "file:///etc/passwd" })).toThrow(
      /must be an http\(s\) URL/,
    );
    expect(() => resolveWebUrl({ [WEB_URL_ENV]: "ftp://example.com" })).toThrow(
      /must be an http\(s\) URL/,
    );
  });
});

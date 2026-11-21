import { describe, expect, it } from "vitest";
import { builtMark, stampPage } from "../src/stamp.js";

describe("a page that changes whenever what it is served with does", () => {
  const html = "<!doctype html>\n<html>\n<head>\n<title>A world</title>\n</head>\n<body></body>\n</html>\n";
  const narrow = [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: "connect-src 'self' wss:" }] }];
  const wide = [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: "connect-src 'self' https: wss:" }] }];

  it("is marked in its head with the kit and with its rules", () => {
    const page = stampPage(html, "0.59.1", narrow);
    expect(page).toContain(`<meta name="nswp-built" content="${builtMark("0.59.1", narrow)}">\n</head>`);
    expect(page.replace(/<meta name="nswp-built"[^>]*>\n/, "")).toBe(html);
  });

  it("differs when its rules do, though nothing else about it has changed: a browser keeps old rules for an unchanged page", () => {
    expect(stampPage(html, "0.59.1", narrow)).not.toBe(stampPage(html, "0.59.1", wide));
    expect(stampPage(html, "0.59.1", narrow)).toBe(stampPage(html, "0.59.1", JSON.parse(JSON.stringify(narrow))));
  });

  it("differs from one kit to the next", () => {
    expect(stampPage(html, "0.59.1", narrow)).not.toBe(stampPage(html, "0.59.2", narrow));
  });

  it("is marked once however often it is built", () => {
    const twice = stampPage(stampPage(html, "0.59.0", narrow), "0.59.1", wide);
    expect(twice).toBe(stampPage(html, "0.59.1", wide));
    expect(twice.match(/nswp-built/g)).toHaveLength(1);
  });

  it("is marked at its end where it has no head, and never with anything but plain characters", () => {
    expect(stampPage("<p>bare</p>", "0.59.1", null)).toMatch(/^<p>bare<\/p>\n<meta name="nswp-built" content="0\.59\.1 [0-9a-f]{16}">\n$/);
    expect(stampPage(html, '1"><script>', null)).not.toContain("<script>");
  });
});

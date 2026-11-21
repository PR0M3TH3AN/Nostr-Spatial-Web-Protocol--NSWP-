import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { cleanFileBytes, cleanFileName, cleanFileType, cleanFileUrl, FILE_LIMITS, fileUrlNames, readSignerReply, readSignerRequest, signerMessage } from "../src/index.js";

const bytes = new TextEncoder().encode("a drawing, as bytes");
const hash = bytesToHex(sha256(bytes));
const cp = (n: number) => String.fromCodePoint(n);

describe("a file passed between a world and its visitor's own files", () => {
  it("keeps a name only a name: no path, nothing unseen, one line, not too long", () => {
    expect(cleanFileName("My drawing.png")).toBe("My drawing.png");
    expect(cleanFileName("  spaced   out \n name.txt ")).toBe("spaced out name.txt");
    expect(cleanFileName("../../etc/passwd")).toBe(".. .. etc passwd");
    expect(cleanFileName("C:\\Users\\me\\notes.txt")).toBe("C: Users me notes.txt");
    // Characters nobody sees, and ones that turn the words round, are gone: a name reads as it is.
    expect(cleanFileName(`invoice${cp(0x202e)}gnp.exe`)).toBe("invoice gnp.exe");
    expect(cleanFileName(`a${cp(0x200b)}b${cp(0xfeff)}c${cp(0)}d`)).toBe("a b c d");
    expect([...cleanFileName("x".repeat(500))].length).toBe(FILE_LIMITS.name);
    // Counted in characters, not halves of one.
    expect([...cleanFileName("🙂".repeat(200))].length).toBe(FILE_LIMITS.name);
    for (const not of ["", "   ", ".", "..", "/", "\\\\", cp(0x200b), 7, null, undefined, {}]) expect(cleanFileName(not), String(not)).toBe("");
  });

  it("takes a type only as a media type, and anything else as just bytes", () => {
    expect(cleanFileType("image/png")).toBe("image/png");
    expect(cleanFileType(" Image/SVG+XML ")).toBe("image/svg+xml");
    expect(cleanFileType("model/gltf-binary")).toBe("model/gltf-binary");
    for (const not of ["", "png", "image/", "/png", "text/html; charset=utf-8", "image/png\nX-Evil: 1", "a".repeat(200) + "/b", 7, null, undefined]) expect(cleanFileType(not), String(not).slice(0, 30)).toBe("application/octet-stream");
  });

  it("takes bytes only as bytes: some, and no more than may be passed", () => {
    expect(cleanFileBytes(bytes)).toBe(bytes);
    expect(cleanFileBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length))).toEqual(bytes);
    expect(cleanFileBytes(new Uint8Array(FILE_LIMITS.bytes))?.length).toBe(FILE_LIMITS.bytes);
    for (const not of [new Uint8Array(0), new Uint8Array(FILE_LIMITS.bytes + 1), "bytes", [1, 2, 3], { length: 3 }, btoa("base64"), null, undefined]) expect(cleanFileBytes(not)).toBeNull();
  });

  it("believes an address only if it is a secure one that ends in a file's hash, and names these bytes", () => {
    const url = `https://files.example/${hash}`;
    expect(cleanFileUrl(url)).toBe(url);
    expect(cleanFileUrl(`${url}.png`)).toBe(`${url}.png`);
    for (const not of [`http://files.example/${hash}`, `https://files.example/${hash}?download=1`, `https://files.example/${hash}#x`, `https://user:pass@files.example/${hash}`, `https://files.example/${hash}/more`, `https://files.example/${hash.slice(0, 60)}`, `https://files.example/${hash.toUpperCase()}`, "https://files.example/drawing.png", `javascript:alert("${hash}")`, "", 7, null]) expect(cleanFileUrl(not), String(not).slice(0, 50)).toBe("");
    expect(fileUrlNames(url, bytes)).toBe(true);
    expect(fileUrlNames(`${url}.png`, bytes)).toBe(true);
    // The right shape, naming some other file: not believed.
    expect(fileUrlNames(`https://files.example/${"ab".repeat(32)}`, bytes)).toBe(false);
    expect(fileUrlNames(url, new TextEncoder().encode("other bytes"))).toBe(false);
    expect(fileUrlNames("https://files.example/drawing.png", bytes)).toBe(false);
  });

  it("is what a world sends its signer to offer or ask for a file, and what it hears back", () => {
    expect(readSignerRequest(signerMessage({ t: "file-pick", id: "fp1" }))).toEqual({ t: "file-pick", id: "fp1" });
    // Private unless it says otherwise; the name and type tidied.
    expect(readSignerRequest({ ...signerMessage({ t: "file-pick", id: "fs1" }), t: "file-save", name: "a/b.png", type: "IMAGE/PNG", bytes })).toEqual({ t: "file-save", id: "fs1", name: "a b.png", type: "image/png", bytes, private: true });
    expect(readSignerRequest(signerMessage({ t: "file-save", id: "fs1", name: "b.png", type: "image/png", bytes, private: false }))).toMatchObject({ private: false });
    expect(readSignerRequest(signerMessage({ t: "file-save", id: "fs1", name: "..", type: "image/png", bytes, private: true }))).toBeNull();
    expect(readSignerRequest(signerMessage({ t: "file-save", id: "fs1", name: "b.png", type: "image/png", bytes: new Uint8Array(0), private: true }))).toBeNull();

    const url = `https://files.example/${hash}`;
    expect(readSignerReply(signerMessage({ t: "file-saved", id: "fs1", name: "renamed.png", size: bytes.length, private: false, url }))).toEqual({ t: "file-saved", id: "fs1", name: "renamed.png", size: bytes.length, private: false, url });
    // An address is taken only for a public file: a private one is never said to be anywhere.
    expect(readSignerReply(signerMessage({ t: "file-saved", id: "fs1", name: "renamed.png", size: bytes.length, private: true, url }))).toEqual({ t: "file-saved", id: "fs1", name: "renamed.png", size: bytes.length, private: true });
    expect(readSignerReply({ ...signerMessage({ t: "asking", id: "fs1" }), t: "file-saved", name: "x.png", size: 3, url })).toEqual({ t: "file-saved", id: "fs1", name: "x.png", size: 3, private: true });
    for (const size of [-1, 1.5, NaN, "3"]) expect(readSignerReply({ ...signerMessage({ t: "asking", id: "fs1" }), t: "file-saved", name: "x.png", size }), String(size)).toBeNull();
    expect(readSignerReply(signerMessage({ t: "file", id: "fp1", name: "mine.png", type: "image/png", bytes, url }))).toEqual({ t: "file", id: "fp1", name: "mine.png", type: "image/png", bytes, url });
    expect(readSignerReply(signerMessage({ t: "file", id: "fp1", name: "mine.png", type: "nonsense", bytes, url: "https://files.example/mine.png" }))).toEqual({ t: "file", id: "fp1", name: "mine.png", type: "application/octet-stream", bytes });
    expect(readSignerReply({ ...signerMessage({ t: "asking", id: "fp1" }), t: "file", name: "mine.png", type: "image/png", bytes: "not bytes" })).toBeNull();
  });
});

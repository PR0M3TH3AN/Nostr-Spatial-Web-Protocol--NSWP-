"use strict";
var NSWP = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // packages/sdk/src/engine.ts
  var engine_exports = {};
  __export(engine_exports, {
    KIT: () => KIT,
    VERSION: () => VERSION,
    arrival: () => arrival2,
    bump: () => bump,
    changeLook: () => changeLook,
    check: () => check,
    claim: () => claim,
    door: () => door,
    doors: () => doors2,
    events: () => events,
    go: () => go,
    headset: () => headset,
    home: () => home,
    kit: () => kit,
    menu: () => menu,
    moved: () => moved,
    open: () => open,
    play: () => play,
    presence: () => presence,
    run: () => run,
    say: () => say,
    signIn: () => signIn,
    start: () => start,
    target: () => target,
    view: () => view
  });

  // packages/core/dist/constants.js
  var WORLD_KIND = 37300;
  var SCHEMAS = {
    manifest: "nswp/manifest/0.3",
    portal: "nswp/portal/0.3",
    arrival: "nswp/arrival/0.3"
  };
  var WELL_KNOWN_PATH = "/.well-known/nswp.json";
  var KIT_VERSION = "0.30.3";
  function parseKitVersion(v) {
    const m = typeof v === "string" ? /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(v) : null;
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  }
  var MODES = ["2d", "inline-3d", "immersive-vr", "immersive-ar"];
  var PREVIEW_LIMITS = {
    pano: { width: 4096, height: 2048, bytes: 2 * 1024 * 1024 },
    flat: { width: 1920, height: 1080, bytes: 500 * 1024 }
  };
  var LIMITS = {
    manifestBytes: 64 * 1024,
    arrivalChars: 16 * 1024,
    maxReceipts: 8,
    /** Keys a visitor's client may say they have blocked, in one arrival. */
    maxBlocked: 64,
    /** Keys a world may report as newly blocked, on one link. */
    maxBlockedOnLink: 16,
    maxIdLength: 128,
    maxTitleLength: 200,
    maxUrlLength: 2048,
    assertionTtlSec: 60,
    assertionFutureSkewSec: 10,
    minNonceLength: 16
  };

  // packages/core/dist/result.js
  var NswpError = class extends Error {
    constructor(code, message, opts = {}) {
      super(message, opts.cause === void 0 ? void 0 : { cause: opts.cause });
      __publicField(this, "code");
      __publicField(this, "retryable");
      __publicField(this, "details");
      this.name = "NswpError";
      this.code = code;
      this.retryable = opts.retryable ?? false;
      if (opts.details)
        this.details = opts.details;
    }
  };
  var Collector = class {
    constructor() {
      __publicField(this, "errors", []);
      __publicField(this, "warnings", []);
    }
    error(code, path, message) {
      this.errors.push({ code, path, message });
    }
    warn(code, path, message) {
      this.warnings.push({ code, path, message });
    }
    result(value) {
      return this.errors.length > 0 ? { ok: false, errors: this.errors, warnings: this.warnings } : { ok: true, value, warnings: this.warnings };
    }
  };
  function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
  }

  // node_modules/@noble/hashes/_u64.js
  var fromNumH = (n) => n / 2 ** 32 | 0;
  var fromNumL = (n) => n >>> 0;
  function setU64FromNum(view2, byteOffset, n, isLE) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view2.setUint32(byteOffset, isLE ? l : h, isLE);
    view2.setUint32(byteOffset + 4, isLE ? h : l, isLE);
  }

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle = (title) => title ? `"${title}" ` : "";
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  var aobject = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
  };
  var aopts = (value, label) => {
    aobject(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
      throw new TypeError(`"${label}" expected plain object`);
    if (Object.hasOwn(value, "__proto__"))
      throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  function asciiToBase16(ch) {
    return ch >= 48 && ch <= 57 ? ch - 48 : ch >= 65 && ch <= 70 ? ch - (65 - 10) : ch >= 97 && ch <= 102 ? ch - (97 - 10) : void 0;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new RangeError(error.message);
        throw error;
      }
    }
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new RangeError("hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new TypeError("string expected");
    const encoded = new TextEncoder().encode(str);
    try {
      return new Uint8Array(encoded);
    } finally {
      clean(encoded);
    }
  }
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
      const a = arrays[i];
      abytes(a);
      sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
      const a = arrays[i];
      res.set(a, pad);
      pad += a.length;
    }
    return res;
  }
  function checkOpts(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  function randomBytes(bytesLength = 32) {
    anumber(bytesLength, "bytesLength");
    const cr = typeof globalThis === "object" ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== "function")
      throw new Error("crypto.getRandomValues must be defined");
    if (bytesLength > 65536)
      throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    constructor(blockLen, outputLen, padOffset, isLE) {
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF", false);
      __publicField(this, "padOffset");
      __publicField(this, "isLE");
      // For partial updates less than block size
      __publicField(this, "buffer");
      __publicField(this, "view");
      __publicField(this, "finished", false);
      __publicField(this, "length", 0);
      __publicField(this, "pos", 0);
      __publicField(this, "destroyed", false);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view: view2, buffer, blockLen } = this;
      const len = data.length;
      let processed = false;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          processed = true;
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view2, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      if (processed)
        this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view: view2, blockLen, isLE } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      buffer.fill(0, pos);
      if (this.padOffset > blockLen - pos) {
        this.process(view2, 0);
        buffer.fill(0);
      }
      setU64FromNum(view2, blockLen - 8, this.length * 8, isLE);
      this.process(view2, 0);
      this.roundClean();
      const oview = out === buffer ? view2 : createView(out);
      const len = this.outputLen;
      const outLen = len / 4;
      const state = this.get();
      if (len % 4 || outLen > state.length)
        throw new Error("invalid outputLen");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      const { buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (pos)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      // Numeric initializers matter: starting the fields as `undefined` changes
      // V8's field representation and makes sha256 3x slower (measured).
      __publicField(this, "A", 0);
      __publicField(this, "B", 0);
      __publicField(this, "C", 0);
      __publicField(this, "D", 0);
      __publicField(this, "E", 0);
      __publicField(this, "F", 0);
      __publicField(this, "G", 0);
      __publicField(this, "H", 0);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to || (to = new this.constructor())).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view2, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view2.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32, SHA256_IV);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );

  // node_modules/@noble/curves/utils.js
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  function aarray(item, title, inner = () => {
  }) {
    if (!Array.isArray(item))
      throw new TypeError(`"${title}" expected array, got type=${typeof item}`);
    for (let i = 0; i < item.length; i++)
      inner(item[i], `${title}[${i}]`);
    return item;
  }
  var abytes2 = (value, length, title) => abytes(value, length, title);
  var anumber2 = anumber;
  function aobject2(value, title = "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError(title === "object" ? "expected valid options object" : `"${title}" expected object, got type=${typeof value}`);
    return value;
  }
  function afunction(value, title) {
    if (typeof value !== "function")
      throw new TypeError(`"${title}" is invalid: expected function, got ${typeof value}`);
    return value;
  }
  var bytesToHex2 = bytesToHex;
  var concatBytes2 = (...arrays) => concatBytes(...arrays);
  var hexToBytes2 = (hex) => hexToBytes(hex);
  var isBytes2 = isBytes;
  var randomBytes2 = (bytesLength) => randomBytes(bytesLength);
  var _0n = /* @__PURE__ */ BigInt(0);
  var _1n = /* @__PURE__ */ BigInt(1);
  var atitle2 = (title) => title ? `"${title}" ` : "";
  function abool(value, title = "") {
    if (typeof value !== "boolean")
      throw new TypeError(atitle2(title) + "expected boolean, got type=" + typeof value);
    return value;
  }
  function abignumber(n) {
    if (typeof n === "bigint") {
      if (!isPosBig(n))
        throw new RangeError("positive bigint expected, got " + n);
    } else
      anumber2(n);
    return n;
  }
  function asafenumber(value, title = "") {
    if (typeof value !== "number") {
      const prefix = title && `"${title}" `;
      throw new TypeError(prefix + "expected number, got type=" + typeof value);
    }
    if (!Number.isSafeInteger(value)) {
      const prefix = title && `"${title}" `;
      throw new RangeError(prefix + "expected safe integer, got " + value);
    }
  }
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new TypeError("hex string expected, got " + typeof hex);
    return hex === "" ? _0n : BigInt("0x" + hex);
  }
  function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
  }
  function bytesToNumberLE(bytes) {
    return hexToNumber(bytesToHex(copyBytes(abytes(bytes)).reverse()));
  }
  function numberToBytesBE(n, len) {
    anumber(len);
    if (len === 0)
      throw new Error("zero output length is invalid");
    n = abignumber(n);
    const expectedLen = len * 2;
    const hex = n.toString(16);
    if (hex.length > expectedLen)
      throw new RangeError("number is too large");
    return hexToBytes(hex.padStart(expectedLen, "0"));
  }
  function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
  }
  function copyBytes(bytes) {
    return Uint8Array.from(abytes2(bytes));
  }
  function asciiToBytes(ascii) {
    if (typeof ascii !== "string")
      throw new TypeError("ascii string expected, got " + typeof ascii);
    return Uint8Array.from(ascii, (c, i) => {
      const charCode = c.charCodeAt(0);
      if (c.length !== 1 || charCode > 127) {
        throw new RangeError(`string contains non-ASCII character "${ascii[i]}" with code ${charCode} at position ${i}`);
      }
      return charCode;
    });
  }
  function isPosBig(n) {
    return typeof n === "bigint" && _0n <= n;
  }
  function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
  }
  function aInRange(title, n, min, max) {
    if (!inRange(n, min, max))
      throw new RangeError("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
  }
  function bitLen(n) {
    if (n < _0n)
      throw new Error("expected non-negative bigint, got " + n);
    return n === _0n ? 0 : n.toString(2).length;
  }
  var bitMask = (n) => {
    asafenumber(n, "n");
    return (_1n << BigInt(n)) - _1n;
  };
  function validateObject(object, fields = {}, optFields = {}, title = "object") {
    aobject2(object, title);
    aobject2(fields, "fields");
    aobject2(optFields, "optFields");
    function checkField(fieldName, expectedType, isOpt) {
      const label = title === "object" ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
      const val = object[fieldName];
      if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== void 0 : expectedType !== "function")) {
        throw new TypeError(`${label} is invalid: expected own property`);
      }
      if (isOpt && val === void 0)
        return;
      const current = typeof val;
      if (current !== expectedType || val === null)
        throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
    }
    const iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
  }

  // node_modules/@noble/curves/abstract/modular.js
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  var _0n2 = /* @__PURE__ */ BigInt(0);
  var _1n2 = /* @__PURE__ */ BigInt(1);
  var _2n = /* @__PURE__ */ BigInt(2);
  var _3n = /* @__PURE__ */ BigInt(3);
  var _4n = /* @__PURE__ */ BigInt(4);
  var _5n = /* @__PURE__ */ BigInt(5);
  var _7n = /* @__PURE__ */ BigInt(7);
  var _8n = /* @__PURE__ */ BigInt(8);
  var _9n = /* @__PURE__ */ BigInt(9);
  var _15n = /* @__PURE__ */ BigInt(15);
  var _16n = /* @__PURE__ */ BigInt(16);
  var POW_WINDOWED_MIN = /* @__PURE__ */ BigInt("0x10000000000000000");
  function mod(a, b) {
    if (b <= _0n2)
      throw new Error("mod: expected positive modulus, got " + b);
    const result = a % b;
    return result >= _0n2 ? result : b + result;
  }
  function pow(num2, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow: expected modulus > 1, got " + modulo);
    if (typeof power !== "bigint")
      throw new TypeError("invalid exponent: expected bigint, got " + typeof power);
    if (power < _0n2)
      throw new Error("invalid exponent, negatives unsupported");
    if (power === _0n2)
      return _1n2;
    if (power === _1n2)
      return num2;
    let d = num2 % modulo;
    if (d < _0n2)
      d += modulo;
    if (power < POW_WINDOWED_MIN) {
      let p2 = _1n2;
      while (power > _0n2) {
        if (power & _1n2)
          p2 = p2 * d % modulo;
        d = d * d % modulo;
        power >>= _1n2;
      }
      return p2;
    }
    const digits = [];
    while (power > _0n2) {
      digits.push(Number(power & _15n));
      power >>= _4n;
    }
    const table = new Array(16);
    table[0] = _1n2;
    table[1] = d;
    for (let i = 2; i < 16; i++)
      table[i] = table[i - 1] * d % modulo;
    let p = table[digits[digits.length - 1]];
    for (let w = digits.length - 2; w >= 0; w--) {
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      p = p * p % modulo;
      const digit = digits[w];
      if (digit !== 0)
        p = p * table[digit] % modulo;
    }
    return p;
  }
  function pow2(x, power, modulo) {
    if (modulo <= _1n2)
      throw new Error("pow2: expected modulus > 1, got " + modulo);
    if (power < _0n2)
      throw new Error("pow2: expected non-negative exponent, got " + power);
    let res = x;
    while (power-- > _0n2) {
      res *= res;
      res %= modulo;
    }
    return res;
  }
  function invert(number, modulo) {
    if (number === _0n2)
      throw new Error("invert: expected non-zero number");
    if (modulo <= _1n2)
      throw new Error("invert: expected modulus > 1, got " + modulo);
    let a = mod(number, modulo);
    let b = modulo;
    let x = _0n2, u = _1n2;
    while (a !== _0n2) {
      const q = b / a;
      const r = b - a * q;
      const m = x - u * q;
      b = a, a = r, x = u, u = m;
    }
    const gcd = b;
    if (gcd !== _1n2)
      throw new Error("invert: does not exist");
    return mod(x, modulo);
  }
  function assertIsSquare(Fp, root, n) {
    const F = Fp;
    if (!F.eql(F.sqr(root), n))
      throw new Error("Cannot find square root");
  }
  function aoddModulus(order, fnName) {
    if ((order & _1n2) === _0n2)
      throw new Error(fnName + ": expected odd modulus, got " + order);
  }
  function sqrt3mod4(Fp, n) {
    const F = Fp;
    const p1div4 = (F.ORDER + _1n2) / _4n;
    const root = F.pow(n, p1div4);
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt5mod8(Fp, n) {
    const F = Fp;
    const p5div8 = (F.ORDER - _5n) / _8n;
    const n2 = F.mul(n, _2n);
    const v = F.pow(n2, p5div8);
    const nv = F.mul(n, v);
    const i = F.mul(F.mul(nv, _2n), v);
    const root = F.mul(nv, F.sub(i, F.ONE));
    assertIsSquare(F, root, n);
    return root;
  }
  function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
    const c2 = tn(Fp_, c1);
    const c3 = tn(Fp_, Fp_.neg(c1));
    const c4 = (P + _7n) / _16n;
    return ((Fp, n) => {
      const F = Fp;
      let tv1 = F.pow(n, c4);
      let tv2 = F.mul(tv1, c1);
      const tv3 = F.mul(tv1, c2);
      const tv4 = F.mul(tv1, c3);
      const e1 = F.eql(F.sqr(tv2), n);
      const e2 = F.eql(F.sqr(tv3), n);
      tv1 = F.cmov(tv1, tv2, e1);
      tv2 = F.cmov(tv4, tv3, e2);
      const e3 = F.eql(F.sqr(tv2), n);
      const root = F.cmov(tv1, tv2, e3);
      assertIsSquare(F, root, n);
      return root;
    });
  }
  function tonelliShanks(P) {
    if (P < _3n)
      throw new Error("sqrt is not defined for small field");
    aoddModulus(P, "tonelliShanks");
    let Q = P - _1n2;
    let S = 0;
    while (Q % _2n === _0n2) {
      Q /= _2n;
      S++;
    }
    let Z = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
      if (Z++ > 1e3)
        throw new Error("Cannot find square root: probably non-prime P");
    }
    if (S === 1)
      return sqrt3mod4;
    let cc = _Fp.pow(Z, Q);
    const Q1div2 = (Q + _1n2) / _2n;
    return function tonelliSlow(Fp, n) {
      const F = Fp;
      if (F.is0(n))
        return n;
      if (FpLegendre(F, n) !== 1)
        throw new Error("Cannot find square root");
      let M = S;
      let c = F.mul(F.ONE, cc);
      let t = F.pow(n, Q);
      let R = F.pow(n, Q1div2);
      while (!F.eql(t, F.ONE)) {
        if (F.is0(t))
          throw new Error("Cannot find square root: probably non-prime P");
        let i = 1;
        let t_tmp = F.sqr(t);
        while (!F.eql(t_tmp, F.ONE)) {
          i++;
          t_tmp = F.sqr(t_tmp);
          if (i === M)
            throw new Error("Cannot find square root");
        }
        const exponent = _1n2 << BigInt(M - i - 1);
        const b = F.pow(c, exponent);
        M = i;
        c = F.sqr(b);
        t = F.mul(t, c);
        R = F.mul(R, b);
      }
      return R;
    };
  }
  function FpSqrt(P) {
    aoddModulus(P, "Fp.sqrt");
    if (P % _4n === _3n)
      return sqrt3mod4;
    if (P % _8n === _5n)
      return sqrt5mod8;
    if (P % _16n === _9n)
      return sqrt9mod16(P);
    return tonelliShanks(P);
  }
  var FIELD_FIELDS = [
    "create",
    "isValid",
    "is0",
    "neg",
    "inv",
    "sqrt",
    "sqr",
    "eql",
    "add",
    "sub",
    "mul",
    "pow",
    "div",
    "addN",
    "subN",
    "mulN",
    "sqrN"
  ];
  function validateField(field) {
    aobject2(field, "field");
    if (typeof field.ORDER !== "bigint")
      throw new TypeError('param "ORDER" is invalid: expected bigint, got ' + typeof field.ORDER);
    asafenumber(field.BYTES, "BYTES");
    asafenumber(field.BITS, "BITS");
    for (const name of FIELD_FIELDS)
      afunction(field[name], "field." + name);
    if (field.BYTES < 1 || field.BITS < 1)
      throw new Error("invalid field: expected BYTES/BITS > 0");
    if (field.ORDER <= _1n2)
      throw new Error("invalid field: expected ORDER > 1, got " + field.ORDER);
    return field;
  }
  function FpInvertBatch(Fp, nums, passZero = false) {
    validateField(Fp);
    aarray(nums, "nums");
    abool(passZero, "passZero");
    const F = Fp;
    const inverted = new Array(nums.length).fill(passZero ? F.ZERO : void 0);
    const multipliedAcc = nums.reduce((acc, num2, i) => {
      if (F.is0(num2))
        return acc;
      inverted[i] = acc;
      return F.mul(acc, num2);
    }, F.ONE);
    const invertedAcc = F.inv(multipliedAcc);
    nums.reduceRight((acc, num2, i) => {
      if (F.is0(num2))
        return acc;
      inverted[i] = F.mul(acc, inverted[i]);
      return F.mul(acc, num2);
    }, invertedAcc);
    return inverted;
  }
  function FpLegendre(Fp, n) {
    validateField(Fp);
    const F = Fp;
    aoddModulus(F.ORDER, "FpLegendre");
    const p1mod2 = (F.ORDER - _1n2) / _2n;
    const powered = F.pow(n, p1mod2);
    const yes = F.eql(powered, F.ONE);
    const zero = F.eql(powered, F.ZERO);
    const no = F.eql(powered, F.neg(F.ONE));
    if (!yes && !zero && !no)
      throw new Error("invalid Legendre symbol result");
    return yes ? 1 : zero ? 0 : -1;
  }
  function nLength(n, nBitLength) {
    if (nBitLength !== void 0)
      anumber2(nBitLength);
    if (n <= _0n2)
      throw new Error("invalid n length: expected positive n, got " + n);
    if (nBitLength !== void 0 && nBitLength < 1)
      throw new Error("invalid n length: expected positive bit length, got " + nBitLength);
    const bits = bitLen(n);
    if (nBitLength !== void 0 && nBitLength < bits)
      throw new Error(`invalid n length: expected nBitLength (${nBitLength}) >= bitLen(n) (${bits})`);
    const _nBitLength = nBitLength !== void 0 ? nBitLength : bits;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
  }
  var FIELD_SQRT = /* @__PURE__ */ new WeakMap();
  var _Field = class {
    constructor(ORDER, opts = {}) {
      __publicField(this, "ORDER");
      __publicField(this, "BITS");
      __publicField(this, "BYTES");
      __publicField(this, "isLE");
      __publicField(this, "ZERO", _0n2);
      __publicField(this, "ONE", _1n2);
      __publicField(this, "_lengths");
      __publicField(this, "_mod");
      if (ORDER <= _1n2)
        throw new Error("invalid field: expected ORDER > 1, got " + ORDER);
      let _nbitLength = void 0;
      this.isLE = false;
      if (opts != null && typeof opts === "object") {
        if (typeof opts.BITS === "number")
          _nbitLength = opts.BITS;
        if (typeof opts.sqrt === "function")
          Object.defineProperty(this, "sqrt", { value: opts.sqrt, enumerable: true });
        if (typeof opts.isLE === "boolean")
          this.isLE = opts.isLE;
        if (opts.allowedLengths)
          this._lengths = Object.freeze(opts.allowedLengths.slice());
        if (typeof opts.modFromBytes === "boolean")
          this._mod = opts.modFromBytes;
      }
      const { nBitLength, nByteLength } = nLength(ORDER, _nbitLength);
      if (nByteLength > 2048)
        throw new Error("invalid field: expected ORDER of <= 2048 bytes");
      this.ORDER = ORDER;
      this.BITS = nBitLength;
      this.BYTES = nByteLength;
      Object.freeze(this);
    }
    create(num2) {
      return mod(num2, this.ORDER);
    }
    isValid(num2) {
      if (typeof num2 !== "bigint")
        throw new TypeError("invalid field element: expected bigint, got " + typeof num2);
      return _0n2 <= num2 && num2 < this.ORDER;
    }
    is0(num2) {
      return num2 === _0n2;
    }
    // is valid and invertible
    isValidNot0(num2) {
      return !this.is0(num2) && this.isValid(num2);
    }
    isOdd(num2) {
      return (num2 & _1n2) === _1n2;
    }
    neg(num2) {
      return mod(-num2, this.ORDER);
    }
    eql(lhs, rhs) {
      return lhs === rhs;
    }
    sqr(num2) {
      return mod(num2 * num2, this.ORDER);
    }
    add(lhs, rhs) {
      return mod(lhs + rhs, this.ORDER);
    }
    sub(lhs, rhs) {
      return mod(lhs - rhs, this.ORDER);
    }
    mul(lhs, rhs) {
      return mod(lhs * rhs, this.ORDER);
    }
    pow(num2, power) {
      return pow(num2, power, this.ORDER);
    }
    div(lhs, rhs) {
      return mod(lhs * invert(rhs, this.ORDER), this.ORDER);
    }
    // Same as above, but doesn't normalize
    sqrN(num2) {
      return num2 * num2;
    }
    addN(lhs, rhs) {
      return lhs + rhs;
    }
    subN(lhs, rhs) {
      return lhs - rhs;
    }
    mulN(lhs, rhs) {
      return lhs * rhs;
    }
    inv(num2) {
      return invert(num2, this.ORDER);
    }
    sqrt(num2) {
      let sqrt = FIELD_SQRT.get(this);
      if (!sqrt)
        FIELD_SQRT.set(this, sqrt = FpSqrt(this.ORDER));
      return sqrt(this, num2);
    }
    toBytes(num2) {
      return this.isLE ? numberToBytesLE(num2, this.BYTES) : numberToBytesBE(num2, this.BYTES);
    }
    fromBytes(bytes, skipValidation = false) {
      abytes2(bytes);
      const { _lengths: allowedLengths, BYTES, isLE, ORDER, _mod: modFromBytes } = this;
      if (allowedLengths) {
        if (bytes.length < 1 || !allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!this.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    }
    // TODO: we don't need it here, move out to separate fn
    invertBatch(lst) {
      return FpInvertBatch(this, lst, true);
    }
    // We can't move this out because Fp6, Fp12 implement it
    // and it's unclear what to return in there.
    cmov(a, b, condition) {
      abool(condition, "condition");
      return condition ? b : a;
    }
  };
  function Field(ORDER, opts = {}) {
    Object.freeze(_Field.prototype);
    return new _Field(ORDER, opts);
  }
  function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== "bigint")
      throw new Error("field order must be bigint");
    if (fieldOrder <= _1n2)
      throw new Error("field order must be greater than 1");
    const bitLength = bitLen(fieldOrder - _1n2);
    return Math.ceil(bitLength / 8);
  }
  function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
  }
  function mapHashToField(key, fieldOrder, isLE = false) {
    abytes2(key);
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = Math.max(getMinHashLength(fieldOrder), 16);
    if (len < minLen || len > 1024)
      throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
    const num2 = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
    const reduced = mod(num2, fieldOrder - _1n2) + _1n2;
    return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
  }

  // node_modules/@noble/curves/abstract/curve.js
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  var _0n3 = /* @__PURE__ */ BigInt(0);
  var _1n3 = /* @__PURE__ */ BigInt(1);
  var _4n2 = /* @__PURE__ */ BigInt(4);
  var BLIND_BYTES = 16;
  var BLIND_BITS = 128;
  var FW_WINDOW = 5;
  var TABLE_BYTES_MAX = /* @__PURE__ */ (() => 2 ** 31)();
  function validatePointCons(Point) {
    const pc = Point;
    if (typeof pc !== "function")
      throw new TypeError('"Point" expected constructor, got type=' + typeof Point);
    afunction(pc.fromAffine, "Point.fromAffine");
    afunction(pc.fromBytes, "Point.fromBytes");
    afunction(pc.fromHex, "Point.fromHex");
    aobject2(pc.BASE, "Point.BASE");
    aobject2(pc.ZERO, "Point.ZERO");
    validateField(pc.Fp);
    validateField(pc.Fn);
  }
  function normalizeZ(c, points) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
    return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
  }
  function validateW(W, bits, min = 1) {
    if (!Number.isSafeInteger(W) || W < min || W > bits)
      throw new Error("invalid window size, expected [" + min + ".." + bits + "], got W=" + W);
  }
  function validateTableBytes(numPoints, fpBytes) {
    const bytes = numPoints * (4 * fpBytes + 128);
    if (bytes > TABLE_BYTES_MAX)
      throw new Error("invalid window size: table would need ~" + Math.ceil(bytes / 2 ** 20) + " MiB, max " + TABLE_BYTES_MAX / 2 ** 20 + " MiB");
  }
  function probeRandomBytes(randomBytes3, length) {
    if (randomBytes3 === void 0)
      return void 0;
    afunction(randomBytes3, "randomBytes");
    try {
      const probe = randomBytes3(length);
      if (!isBytes2(probe) || probe.length !== length)
        return void 0;
    } catch {
      return void 0;
    }
    return randomBytes3;
  }
  function validateMSMPoints(points, c) {
    aarray(points, "points");
    points.forEach((p, i) => {
      if (!(p instanceof c))
        throw new Error("invalid point at index " + i);
    });
  }
  function validateMSMScalars(scalars, field, maxScalar) {
    if (!Array.isArray(scalars))
      throw new Error("array of scalars expected");
    scalars.forEach((s, i) => {
      const ok = maxScalar === void 0 ? field.isValid(s) : isPosBig(s) && s < maxScalar;
      if (!ok)
        throw new Error("invalid scalar at index " + i);
    });
  }
  var pointWindowSizes = /* @__PURE__ */ new WeakMap();
  function getWindowSize(P) {
    return pointWindowSizes.get(P) || 1;
  }
  function oddMultiples(p, size) {
    const dbl = p.double();
    const t = [p];
    for (let j = 1; j < size; j++)
      t.push(t[j - 1].add(dbl));
    return t;
  }
  function wnafDigits(n, W) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const d = [];
    while (n > _0n3) {
      let w = 0;
      if (n & _1n3) {
        w = Number(n & mask);
        if (w >= half)
          w -= size;
        n -= BigInt(w);
      }
      d.push(w);
      n >>= _1n3;
    }
    return d;
  }
  function signedWindowDigits(n, W, windows) {
    const size = 2 ** W;
    const half = size / 2;
    const mask = BigInt(size - 1);
    const shiftBy = BigInt(W);
    const d = [];
    for (let w = 0; w < windows; w++) {
      let v = Number(n & mask);
      n >>= shiftBy;
      if (v > half) {
        v -= size;
        n += _1n3;
      }
      d.push(v);
    }
    if (n !== _0n3)
      throw new Error("invalid wnaf");
    return d;
  }
  function wnafWalk(zero, tables, digits) {
    let max = 0;
    for (const d of digits)
      max = Math.max(max, d.length);
    let acc = zero;
    for (let bit = max - 1; bit >= 0; bit--) {
      if (bit !== max - 1)
        acc = acc.double();
      for (let i = 0; i < digits.length; i++) {
        const w = digits[i][bit];
        if (w) {
          const item = tables[i][Math.abs(w) - 1 >> 1];
          acc = acc.add(w < 0 ? item.negate() : item);
        }
      }
    }
    return acc;
  }
  var ScalarMultiplier = class {
    // Parametrized with a given Point class (not individual point)
    constructor(Point, randomBytes3) {
      __publicField(this, "Point");
      __publicField(this, "BASE");
      __publicField(this, "ZERO");
      __publicField(this, "randomBytes");
      __publicField(this, "wnafPrecomputes", /* @__PURE__ */ new WeakMap());
      __publicField(this, "baseCanBeBlinded");
      __publicField(this, "bits");
      validatePointCons(Point);
      this.randomBytes = probeRandomBytes(randomBytes3, BLIND_BYTES);
      this.Point = Point;
      this.BASE = Point.BASE;
      this.ZERO = Point.ZERO;
      this.bits = Point.Fn.BITS;
    }
    /**
     * Creates a signed fixed-window wNAF precomputation table: for every window w, the
     * multiples `[1..2^(W−1)]⋅2^(w⋅W)⋅P`, flattened. All doublings are baked into the table,
     * so cached multiplication is additions-only. `windows = ceil(bits/W) + 1`: the extra
     * window absorbs the final carry of signed-digit recoding.
     * For a 256-bit curve and W=6, the table is 44⋅32 = 1408 points.
     * @param point - Point instance
     * @param W - window size
     * @param bits - scalar bitlength the table must cover
     */
    buildWnafTable(point, W, bits) {
      const windows = Math.ceil(bits / W) + 1;
      const half = 2 ** (W - 1);
      const comp = [];
      let base = point;
      for (let w = 0; w < windows; w++) {
        let acc = base;
        for (let i = 0; i < half; i++) {
          comp.push(acc);
          acc = acc.add(base);
        }
        base = comp[comp.length - 1].double();
      }
      return { W, bits, windows, comp };
    }
    /**
     * Implements ec multiplication using precomputed signed fixed-window wNAF tables.
     * Constant-time: fixed window count with one table addition per window — zero digits feed
     * the fake accumulator — and no doublings; the lookup scans the whole window slice.
     * Scalar bounds are validated by the public entry points ({@link ScalarMultiplier.mulCT},
     * {@link ScalarMultiplier.mulCTBlinded}, {@link ScalarMultiplier.mulUnsafe});
     * signedWindowDigits throws if `n` exceeds the table.
     * @returns real and fake (for const-time) points
     */
    wnafCachedCT(precomputes, n) {
      const { W, windows, comp } = precomputes;
      const half = 2 ** (W - 1);
      const digits = signedWindowDigits(n, W, windows);
      let p = this.ZERO;
      let f = this.BASE;
      for (let w = 0; w < windows; w++) {
        const digit = digits[w];
        const start2 = w * half;
        const idx = Math.abs(digit) - 1;
        let sel = comp[start2];
        for (let i = 1; i < half; i++)
          sel = i === idx ? comp[start2 + i] : sel;
        const neg = sel.negate();
        if (digit === 0)
          f = f.add(comp[start2]);
        else
          p = p.add(digit < 0 ? neg : sel);
      }
      return { p, f };
    }
    // Cache key is point identity plus (W, bits); at most two entries exist per point (public-width
    // `Fn.BITS` and blinded `Fn.BITS + BLIND_BITS`). Callers must not reuse the same point with
    // incompatible `transform(...)` layouts and expect a separate cache entry.
    getWnafPrecomputes(W, point, bits, transform) {
      let entries = this.wnafPrecomputes.get(point);
      let comp = entries?.find((entry) => entry.W === W && entry.bits === bits);
      if (!comp) {
        comp = this.buildWnafTable(point, W, bits);
        if (typeof transform === "function")
          comp = { ...comp, comp: transform(comp.comp) };
        if (!entries) {
          entries = [];
          this.wnafPrecomputes.set(point, entries);
        }
        entries.push(comp);
      }
      return comp;
    }
    assertPoint(point) {
      if (!(point instanceof this.Point))
        throw new TypeError('"point" expected Point instance, got type=' + typeof point);
    }
    // Shared prologue of the constant-time entry points. Rejects scalar 0: in key/signature-style
    // callers a zero scalar means broken upstream plumbing, and concrete Points already reject it.
    // Uses inRange instead of Fn.isValidNot0: validateField() only certifies the arithmetic subset.
    validateMulInput(point, scalar) {
      this.assertPoint(point);
      if (!inRange(scalar, _1n3, this.Point.Fn.ORDER))
        throw new Error("invalid scalar");
    }
    // Constant-time dispatch shared by mulCT / mulCTBlinded. Un-precomputed points (W===1, e.g.
    // ECDH peer keys) skip building a throwaway cached table in favor of a small fixed-window
    // multiply. `n` must be < 2^bits.
    runCT(point, n, bits, transform) {
      const W = getWindowSize(point);
      if (W === 1)
        return this.fixedWindowCT(point, n, bits);
      return this.wnafCachedCT(this.getWnafPrecomputes(W, point, bits, transform), n);
    }
    mulCT(point, scalar, transform) {
      this.validateMulInput(point, scalar);
      return this.runCT(point, scalar, this.bits, transform);
    }
    mulCTBlinded(point, scalar, transform) {
      this.validateMulInput(point, scalar);
      if (this.randomBytes === void 0)
        throw new Error("randomBytes is required for scalar blinding");
      const bits = this.Point.Fn.BITS + BLIND_BITS;
      const blind = this.randomBytes(BLIND_BYTES);
      if (!isBytes2(blind) || blind.length !== BLIND_BYTES)
        throw new Error("randomBytes returned invalid byte array");
      blind[0] = blind[0] & 63 | 128;
      const n = scalar + bytesToNumberBE(blind) * this.Point.Fn.ORDER;
      return this.runCT(point, n, bits, transform);
    }
    /**
     * Constant-time multiplication `n*point` for an un-precomputed point, via a small fixed window.
     * A cached wNAF table only pays off when reused; a flat 2^FW_WINDOW table (`size-1` adds) is
     * far cheaper to build for a single use. The point-operation sequence is independent of `n`:
     * build the table, then per window exactly FW_WINDOW doublings, a data-oblivious scan over
     * every table entry, and one addition (adds the identity when the window digit is 0 — never
     * skipped).
     *
     * `n` must be `< 2^bits`. Assumes complete addition (adding the identity costs the same as any
     * add), which holds for the Weierstrass/Edwards point types used here. The table is left in
     * projective form (no normalizeZ): normalizing this small a table costs more than the
     * mixed-add savings it would buy for a single multiply.
     * @returns real point `p`; `f` duplicates it only to match {@link wnafCachedCT}'s return shape
     * (this path needs no fake accumulator — its op-count is already scalar-independent).
     */
    fixedWindowCT(point, n, bits) {
      const W = FW_WINDOW;
      const size = 1 << W;
      const mask = bitMask(W);
      const table = new Array(size);
      table[0] = this.ZERO;
      for (let i = 1; i < size; i++)
        table[i] = table[i - 1].add(point);
      const windows = Math.ceil(bits / W);
      let acc = this.ZERO;
      for (let window2 = windows - 1; window2 >= 0; window2--) {
        if (window2 !== windows - 1)
          for (let d = 0; d < W; d++)
            acc = acc.double();
        const digit = Number(n >> BigInt(window2 * W) & mask);
        let sel = table[0];
        for (let i = 1; i < size; i++)
          sel = i === digit ? table[i] : sel;
        acc = acc.add(sel);
      }
      return { p: acc, f: acc };
    }
    shouldBlind(point, cofactor) {
      if (this.randomBytes === void 0)
        return false;
      if (cofactor === _1n3)
        return true;
      if (point !== this.BASE)
        return false;
      if (this.baseCanBeBlinded === void 0)
        this.baseCanBeBlinded = this.mulUnsafe(this.BASE, this.Point.Fn.ORDER).is0();
      return this.baseCanBeBlinded;
    }
    mulSecret(point, scalar, cofactor, transform) {
      return this.shouldBlind(point, cofactor) ? this.mulCTBlinded(point, scalar, transform) : this.mulCT(point, scalar, transform);
    }
    mulUnsafe(point, scalar, transform) {
      this.assertPoint(point);
      if (!isPosBig(scalar))
        throw new Error("invalid scalar");
      const W = getWindowSize(point);
      if (W === 1 || scalar >= this.Point.Fn.ORDER)
        return mulAddUnsafe(this.Point, [point], [scalar], true);
      const precomputes = this.getWnafPrecomputes(W, point, this.bits, transform);
      return this.wnafCachedCT(precomputes, scalar).p;
    }
    // Remembers the window size used for precomputed wNAF multiplication of the given point
    // and drops any previously built tables. Usually only the base point is precomputed.
    // W=1 resets the point to the un-precomputed (table-less) paths.
    // W is additionally capped so tables stay under ~2 GiB ({@link TABLE_BYTES_MAX}).
    setWindowSize(point, W) {
      this.assertPoint(point);
      validateW(W, this.bits);
      const windows = Math.ceil((this.bits + BLIND_BITS) / W) + 1;
      validateTableBytes(windows * 2 ** (W - 1), this.Point.Fp.BYTES);
      pointWindowSizes.set(point, W);
      this.wnafPrecomputes.delete(point);
    }
    // True when a window size is set: tables themselves are built lazily on first multiply.
    hasWindowSize(point) {
      return getWindowSize(point) !== 1;
    }
  };
  function mulAddUnsafe(c, points, scalars, allowOversized = false) {
    validatePointCons(c);
    validateMSMPoints(points, c);
    abool(allowOversized, "allowOversized");
    validateMSMScalars(scalars, c.Fn, allowOversized ? c.Fn.ORDER ** _4n2 : void 0);
    if (points.length !== scalars.length)
      throw new Error("arrays of points and scalars must have equal length");
    const tables = points.map((p) => oddMultiples(p, 4));
    const digits = scalars.map((n) => wnafDigits(n, 4));
    return wnafWalk(c.ZERO, tables, digits);
  }
  function createField(order, field, isLE) {
    if (field) {
      if (field.ORDER !== order)
        throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
      validateField(field);
      return field;
    } else {
      return Field(order, { isLE });
    }
  }
  function createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
    if (type !== "weierstrass" && type !== "edwards")
      throw new Error('expected curve type "weierstrass" or "edwards"');
    if (FpFnLE === void 0)
      FpFnLE = type === "edwards";
    if (!CURVE || typeof CURVE !== "object")
      throw new Error(`expected valid ${type} CURVE object`);
    validateObject(curveOpts);
    for (const p of ["p", "n", "h"]) {
      const val = CURVE[p];
      if (!(isPosBig(val) && val !== _0n3))
        throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
    const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
    const _b = type === "weierstrass" ? "b" : "d";
    const params = ["Gx", "Gy", "a", _b];
    for (const p of params) {
      if (!Fp.isValid(CURVE[p]))
        throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    CURVE = Object.freeze(Object.assign({}, CURVE));
    return { CURVE, Fp, Fn };
  }
  function createKeygen(randomSecretKey, getPublicKey2) {
    return function keygen(seed) {
      const secretKey = randomSecretKey(seed);
      return { secretKey, publicKey: getPublicKey2(secretKey) };
    };
  }

  // node_modules/@noble/curves/abstract/weierstrass.js
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  var divNearest = (num2, den) => (num2 + (num2 >= 0 ? den : -den) / _2n2) / den;
  function _splitEndoScalar(k, basis, n) {
    aInRange("scalar", k, _0n4, n);
    const [[a1, b1], [a2, b2]] = basis;
    const c1 = divNearest(b2 * k, n);
    const c2 = divNearest(-b1 * k, n);
    let k1 = k - c1 * a1 - c2 * a2;
    let k2 = -c1 * b1 - c2 * b2;
    const k1neg = k1 < _0n4;
    const k2neg = k2 < _0n4;
    if (k1neg)
      k1 = -k1;
    if (k2neg)
      k2 = -k2;
    const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
    if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
      throw new Error("splitScalar (endomorphism): failed for k");
    }
    return { k1neg, k1, k2neg, k2 };
  }
  var _0n4 = /* @__PURE__ */ BigInt(0);
  var _1n4 = /* @__PURE__ */ BigInt(1);
  var _2n2 = /* @__PURE__ */ BigInt(2);
  var _3n2 = /* @__PURE__ */ BigInt(3);
  var _4n3 = /* @__PURE__ */ BigInt(4);
  function weierstrass(params, extraOpts = {}) {
    const validated = createCurveFields("weierstrass", params, extraOpts);
    const Fp = validated.Fp;
    const Fn = validated.Fn;
    let CURVE = validated.CURVE;
    const { h: cofactor, n: CURVE_ORDER } = CURVE;
    validateObject(extraOpts, {}, {
      allowInfinityPoint: "boolean",
      clearCofactor: "function",
      isTorsionFree: "function",
      fromBytes: "function",
      toBytes: "function",
      endo: "object",
      randomBytes: "function"
    });
    const { endo: endoOpts, allowInfinityPoint, clearCofactor, isTorsionFree, fromBytes, toBytes } = extraOpts;
    const randomBytes3 = extraOpts.randomBytes === void 0 ? randomBytes2 : extraOpts.randomBytes;
    if (endoOpts) {
      if (!Fp.is0(CURVE.a) || typeof endoOpts.beta !== "bigint" || !Array.isArray(endoOpts.basises)) {
        throw new Error('invalid endo: expected "beta": bigint and "basises": array');
      }
    }
    const endo = endoOpts ? {
      beta: endoOpts.beta,
      basises: endoOpts.basises.map((basis) => [...basis])
    } : void 0;
    const lengths = getWLengths(Fp, Fn);
    function assertCompressionIsSupported() {
      if (!Fp.isOdd)
        throw new Error("compression is not supported: Field does not have .isOdd()");
    }
    function pointToBytes2(_c, point, isCompressed) {
      if (point.is0()) {
        if (!allowInfinityPoint)
          throw new Error("bad point: ZERO");
        return Uint8Array.of(0);
      }
      const { x, y } = point.toAffine();
      const bx = Fp.toBytes(x);
      abool(isCompressed, "isCompressed");
      if (isCompressed) {
        assertCompressionIsSupported();
        const hasEvenY = !Fp.isOdd(y);
        return concatBytes2(pprefix(hasEvenY), bx);
      } else {
        return concatBytes2(Uint8Array.of(4), bx, Fp.toBytes(y));
      }
    }
    function pointFromBytes(bytes) {
      abytes2(bytes, void 0, "Point");
      const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
      const length = bytes.length;
      const head = bytes[0];
      const tail = bytes.subarray(1);
      if (allowInfinityPoint && length === 1 && head === 0)
        return { x: Fp.ZERO, y: Fp.ZERO };
      if (length === comp && (head === 2 || head === 3)) {
        const x = Fp.fromBytes(tail);
        if (!Fp.isValid(x))
          throw new Error("bad point: is not on curve, wrong x");
        const y2 = weierstrassEquation(x);
        let y;
        try {
          y = Fp.sqrt(y2);
        } catch (sqrtError) {
          const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
          throw new Error("bad point: is not on curve, sqrt error" + err);
        }
        assertCompressionIsSupported();
        const evenY = Fp.isOdd(y);
        const evenH = (head & 1) === 1;
        if (evenH !== evenY)
          y = Fp.neg(y);
        return { x, y };
      } else if (length === uncomp && head === 4) {
        const L = Fp.BYTES;
        const x = Fp.fromBytes(tail.subarray(0, L));
        const y = Fp.fromBytes(tail.subarray(L, L * 2));
        if (!isValidXY(x, y))
          throw new Error("bad point: is not on curve");
        return { x, y };
      } else {
        throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
      }
    }
    const encodePoint = toBytes === void 0 ? pointToBytes2 : toBytes;
    const decodePoint = fromBytes === void 0 ? pointFromBytes : fromBytes;
    const b3 = Fp.mul(CURVE.b, _3n2);
    const mulA = Fp.is0(CURVE.a) ? (_) => Fp.ZERO : (x) => Fp.mul(CURVE.a, x);
    function weierstrassEquation(x) {
      const x2 = Fp.sqr(x);
      const x3 = Fp.mul(x2, x);
      return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
    }
    function isValidXY(x, y) {
      const left = Fp.sqr(y);
      const right = weierstrassEquation(x);
      return Fp.eql(left, right);
    }
    if (!isValidXY(CURVE.Gx, CURVE.Gy))
      throw new Error("bad curve params: generator point");
    const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n3);
    const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
    if (Fp.is0(Fp.add(_4a3, _27b2)))
      throw new Error("bad curve params: a or b");
    function acoord(title, n, banZero = false) {
      if (!Fp.isValid(n) || banZero && Fp.is0(n))
        throw new Error(`bad point coordinate ${title}`);
      return typeof n === "object" && n !== null ? Fp.create(n) : n;
    }
    function aprjpoint(other) {
      if (!(other instanceof Point))
        throw new Error("Weierstrass Point expected");
    }
    function splitEndoScalarN(k) {
      if (!endo || !endo.basises)
        throw new Error("no endo");
      return _splitEndoScalar(k, endo.basises, Fn.ORDER);
    }
    function pushWnafPair(points, scalars, p, k) {
      if (!Fn.isValid(k))
        throw new RangeError("invalid scalar: out of range");
      if (endo) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(k);
        const psi = new Point(Fp.mul(p.X, endo.beta), p.Y, p.Z);
        points.push(k1neg ? p.negate() : p, k2neg ? psi.negate() : psi);
        scalars.push(k1, k2);
      } else {
        points.push(p);
        scalars.push(k);
      }
    }
    const validityCache = /* @__PURE__ */ new WeakSet();
    const _Point = class _Point {
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      constructor(X, Y, Z) {
        __publicField(this, "X");
        __publicField(this, "Y");
        __publicField(this, "Z");
        this.X = acoord("x", X);
        this.Y = acoord("y", Y, true);
        this.Z = acoord("z", Z);
        Object.freeze(this);
      }
      static CURVE() {
        return CURVE;
      }
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      static fromAffine(p) {
        const { x, y } = p || {};
        if (!p || !Fp.isValid(x) || !Fp.isValid(y))
          throw new Error("invalid affine point");
        if (p instanceof _Point)
          throw new Error("projective point not allowed");
        if (Fp.is0(x) && Fp.is0(y))
          return _Point.ZERO;
        return new _Point(x, y, Fp.ONE);
      }
      static fromBytes(bytes) {
        const P = _Point.fromAffine(decodePoint(abytes2(bytes, void 0, "point")));
        P.assertValidity();
        return P;
      }
      static fromHex(hex) {
        return _Point.fromBytes(hexToBytes2(hex));
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      /**
       * @param isLazy - true will defer table computation until the first multiplication
       */
      precompute(windowSize = 6, isLazy = true) {
        wnaf.setWindowSize(this, windowSize);
        if (!isLazy)
          this.multiply(_3n2);
        return this;
      }
      // TODO: return `this`
      /** A point on curve is valid if it conforms to equation. */
      assertValidity() {
        const p = this;
        if (p.is0()) {
          if (allowInfinityPoint && Fp.is0(p.X) && Fp.eql(p.Y, Fp.ONE) && Fp.is0(p.Z))
            return;
          throw new Error("bad point: ZERO");
        }
        if (validityCache.has(p))
          return;
        const { x, y } = p.toAffine();
        if (!Fp.isValid(x) || !Fp.isValid(y))
          throw new Error("bad point: x or y not field elements");
        if (!isValidXY(x, y))
          throw new Error("bad point: equation left != right");
        if (!p.isTorsionFree())
          throw new Error("bad point: not in prime-order subgroup");
        validityCache.add(p);
      }
      hasEvenY() {
        const { y } = this.toAffine();
        if (!Fp.isOdd)
          throw new Error("Field doesn't support isOdd");
        return !Fp.isOdd(y);
      }
      /** Compare one point to another. */
      equals(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
        const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
        return U1 && U2;
      }
      /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
      negate() {
        return new _Point(this.X, Fp.neg(this.Y), this.Z);
      }
      // Renes-Costello-Batina exception-free doubling formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 3
      // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
      double() {
        const { X: X1, Y: Y1, Z: Z1 } = this;
        let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
        let t0 = Fp.mul(X1, X1);
        let t1 = Fp.mul(Y1, Y1);
        let t2 = Fp.mul(Z1, Z1);
        let t3 = Fp.mul(X1, Y1);
        t3 = Fp.add(t3, t3);
        Z3 = Fp.mul(X1, Z1);
        Z3 = Fp.add(Z3, Z3);
        X3 = mulA(Z3);
        Y3 = Fp.mul(b3, t2);
        Y3 = Fp.add(X3, Y3);
        X3 = Fp.sub(t1, Y3);
        Y3 = Fp.add(t1, Y3);
        Y3 = Fp.mul(X3, Y3);
        X3 = Fp.mul(t3, X3);
        Z3 = Fp.mul(b3, Z3);
        t2 = mulA(t2);
        t3 = Fp.sub(t0, t2);
        t3 = mulA(t3);
        t3 = Fp.add(t3, Z3);
        Z3 = Fp.add(t0, t0);
        t0 = Fp.add(Z3, t0);
        t0 = Fp.add(t0, t2);
        t0 = Fp.mul(t0, t3);
        Y3 = Fp.add(Y3, t0);
        t2 = Fp.mul(Y1, Z1);
        t2 = Fp.add(t2, t2);
        t0 = Fp.mul(t2, t3);
        X3 = Fp.sub(X3, t0);
        Z3 = Fp.mul(t2, t1);
        Z3 = Fp.add(Z3, Z3);
        Z3 = Fp.add(Z3, Z3);
        return new _Point(X3, Y3, Z3);
      }
      // Renes-Costello-Batina exception-free addition formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 1
      // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
      add(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        let X3 = Fp.ZERO, Y3 = Fp.ZERO, Z3 = Fp.ZERO;
        let t0 = Fp.mul(X1, X2);
        let t1 = Fp.mul(Y1, Y2);
        let t2 = Fp.mul(Z1, Z2);
        let t3 = Fp.add(X1, Y1);
        let t4 = Fp.add(X2, Y2);
        t3 = Fp.mul(t3, t4);
        t4 = Fp.add(t0, t1);
        t3 = Fp.sub(t3, t4);
        t4 = Fp.add(X1, Z1);
        let t5 = Fp.add(X2, Z2);
        t4 = Fp.mul(t4, t5);
        t5 = Fp.add(t0, t2);
        t4 = Fp.sub(t4, t5);
        t5 = Fp.add(Y1, Z1);
        X3 = Fp.add(Y2, Z2);
        t5 = Fp.mul(t5, X3);
        X3 = Fp.add(t1, t2);
        t5 = Fp.sub(t5, X3);
        Z3 = mulA(t4);
        X3 = Fp.mul(b3, t2);
        Z3 = Fp.add(X3, Z3);
        X3 = Fp.sub(t1, Z3);
        Z3 = Fp.add(t1, Z3);
        Y3 = Fp.mul(X3, Z3);
        t1 = Fp.add(t0, t0);
        t1 = Fp.add(t1, t0);
        t2 = mulA(t2);
        t4 = Fp.mul(b3, t4);
        t1 = Fp.add(t1, t2);
        t2 = Fp.sub(t0, t2);
        t2 = mulA(t2);
        t4 = Fp.add(t4, t2);
        t0 = Fp.mul(t1, t4);
        Y3 = Fp.add(Y3, t0);
        t0 = Fp.mul(t5, t4);
        X3 = Fp.mul(t3, X3);
        X3 = Fp.sub(X3, t0);
        t0 = Fp.mul(t3, t1);
        Z3 = Fp.mul(t5, Z3);
        Z3 = Fp.add(Z3, t0);
        return new _Point(X3, Y3, Z3);
      }
      subtract(other) {
        aprjpoint(other);
        return this.add(other.negate());
      }
      is0() {
        return this.equals(_Point.ZERO);
      }
      /**
       * Constant time multiplication.
       * Uses precomputed tables (signed fixed-window wNAF) when available.
       * Uses scalar blinding and avoids endomorphism splitting in the secret-scalar path.
       * @param scalar - by which the point would be multiplied
       * @returns New point
       */
      multiply(scalar) {
        if (!Fn.isValidNot0(scalar))
          throw new RangeError("invalid scalar: out of range");
        const { p, f } = wnaf.mulSecret(this, scalar, cofactor, normalize);
        return normalize([p, f])[0];
      }
      /**
       * Non-constant-time multiplication. Uses width-4 wNAF with GLV endomorphism splitting
       * when available (two half-width scalars sharing one halved doubling chain).
       * It's faster, but should only be used when you don't care about
       * an exposed secret key e.g. sig verification, which works over *public* keys.
       */
      multiplyUnsafe(scalar) {
        const p = this;
        const sc = scalar;
        if (!Fn.isValid(sc))
          throw new RangeError("invalid scalar: out of range");
        if (sc === _0n4 || p.is0())
          return _Point.ZERO;
        if (sc === _1n4)
          return p;
        if (wnaf.hasWindowSize(this))
          return wnaf.mulUnsafe(p, sc, normalize);
        const points = [];
        const scalars = [];
        pushWnafPair(points, scalars, p, sc);
        return mulAddUnsafe(_Point, points, scalars);
      }
      /**
       * Non-constant-time double-scalar multiplication `a⋅this + b⋅other` (Strauss–Shamir).
       * Both walks share one doubling chain via {@link mulAddUnsafe}, and GLV endomorphism
       * (when available) halves the chain again by splitting each scalar into two half-width
       * parts. Used by ECDSA verification and public-key recovery for `R = u1⋅G + u2⋅P`.
       * Only for public scalars.
       */
      mulAddUnsafe(a, other, b) {
        aprjpoint(other);
        const points = [];
        const scalars = [];
        pushWnafPair(points, scalars, this, a);
        pushWnafPair(points, scalars, other, b);
        return mulAddUnsafe(_Point, points, scalars);
      }
      /**
       * Converts Projective point to affine (x, y) coordinates.
       * (X, Y, Z) ∋ (x=X/Z, y=Y/Z).
       * @param invertedZ - Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
       */
      toAffine(invertedZ) {
        const p = this;
        let iz = invertedZ;
        if (iz != null && !Fp.isValid(iz))
          throw new RangeError('"invertedZ" expected valid field element');
        const { X, Y, Z } = p;
        if (Fp.eql(Z, Fp.ONE))
          return { x: X, y: Y };
        const is0 = p.is0();
        if (iz == null)
          iz = is0 ? Fp.ONE : Fp.inv(Z);
        const x = Fp.mul(X, iz);
        const y = Fp.mul(Y, iz);
        const zz = Fp.mul(Z, iz);
        if (is0)
          return { x: Fp.ZERO, y: Fp.ZERO };
        if (!Fp.eql(zz, Fp.ONE))
          throw new Error("invZ was invalid");
        return { x, y };
      }
      /**
       * Checks whether Point is free of torsion elements (is in prime subgroup).
       * Always torsion-free for cofactor=1 curves.
       */
      isTorsionFree() {
        if (cofactor === _1n4)
          return true;
        if (isTorsionFree)
          return isTorsionFree(_Point, this);
        return wnaf.mulUnsafe(this, CURVE_ORDER).is0();
      }
      clearCofactor() {
        if (cofactor === _1n4)
          return this;
        if (clearCofactor)
          return clearCofactor(_Point, this);
        return this.multiplyUnsafe(cofactor);
      }
      isSmallOrder() {
        if (cofactor === _1n4)
          return this.is0();
        return this.clearCofactor().is0();
      }
      toBytes(isCompressed = true) {
        abool(isCompressed, "isCompressed");
        this.assertValidity();
        return encodePoint(_Point, this, isCompressed);
      }
      toHex(isCompressed = true) {
        return bytesToHex2(this.toBytes(isCompressed));
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
    };
    __publicField(_Point, "BASE", new _Point(CURVE.Gx, CURVE.Gy, Fp.ONE));
    __publicField(_Point, "ZERO", new _Point(Fp.ZERO, Fp.ONE, Fp.ZERO));
    __publicField(_Point, "Fp", Fp);
    __publicField(_Point, "Fn", Fn);
    let Point = _Point;
    const normalize = (points) => normalizeZ(Point, points);
    const wnaf = new ScalarMultiplier(Point, randomBytes3);
    if (wnaf.bits >= 6)
      Point.BASE.precompute(6);
    Object.freeze(Point.prototype);
    Object.freeze(Point);
    return Point;
  }
  function pprefix(hasEvenY) {
    return Uint8Array.of(hasEvenY ? 2 : 3);
  }
  function getWLengths(Fp, Fn) {
    return {
      secretKey: Fn.BYTES,
      publicKey: 1 + Fp.BYTES,
      publicKeyUncompressed: 1 + 2 * Fp.BYTES,
      publicKeyHasPrefix: true,
      // Raw compact `(r || s)` signature width; DER and recovered signatures use
      // different lengths outside this helper.
      signature: 2 * Fn.BYTES
    };
  }

  // node_modules/@noble/curves/secp256k1.js
  /*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  var secp256k1_CURVE = {
    p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
    n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
    h: BigInt(1),
    a: BigInt(0),
    b: BigInt(7),
    Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
    Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
  };
  var secp256k1_ENDO = {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    basises: [
      [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
      [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
    ]
  };
  var _0n5 = /* @__PURE__ */ BigInt(0);
  var _2n3 = /* @__PURE__ */ BigInt(2);
  function sqrtMod(y) {
    const P = secp256k1_CURVE.p;
    const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = y * y * y % P;
    const b3 = b2 * b2 * y % P;
    const b6 = pow2(b3, _3n3, P) * b3 % P;
    const b9 = pow2(b6, _3n3, P) * b3 % P;
    const b11 = pow2(b9, _2n3, P) * b2 % P;
    const b22 = pow2(b11, _11n, P) * b11 % P;
    const b44 = pow2(b22, _22n, P) * b22 % P;
    const b88 = pow2(b44, _44n, P) * b44 % P;
    const b176 = pow2(b88, _88n, P) * b88 % P;
    const b220 = pow2(b176, _44n, P) * b44 % P;
    const b223 = pow2(b220, _3n3, P) * b3 % P;
    const t1 = pow2(b223, _23n, P) * b22 % P;
    const t2 = pow2(t1, _6n, P) * b2 % P;
    const root = pow2(t2, _2n3, P);
    if (!Fpk1.eql(Fpk1.sqr(root), y))
      throw new Error("Cannot find square root");
    return root;
  }
  var Fpk1 = /* @__PURE__ */ Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
  var Pointk1 = /* @__PURE__ */ weierstrass(secp256k1_CURVE, {
    Fp: Fpk1,
    endo: secp256k1_ENDO
  });
  var TAGGED_HASH_PREFIXES = /* @__PURE__ */ Object.create(null);
  function taggedHash(tag, ...messages) {
    let tagP = TAGGED_HASH_PREFIXES[tag];
    if (tagP === void 0) {
      const tagH = sha256(asciiToBytes(tag));
      tagP = concatBytes2(tagH, tagH);
      TAGGED_HASH_PREFIXES[tag] = tagP;
    }
    return sha256(concatBytes2(tagP, ...messages));
  }
  var pointToBytes = (point) => point.toBytes(true).slice(1);
  var affineXToBytes = ({ x }) => Fpk1.toBytes(x);
  var hasEven = (y) => !Fpk1.isOdd(y);
  function schnorrGetExtPubKey(priv) {
    const { Fn, BASE } = Pointk1;
    const d_ = Fn.fromBytes(abytes2(priv, 32, "secretKey"));
    const p = BASE.multiply(d_);
    const affine = p.toAffine();
    const scalar = hasEven(affine.y) ? d_ : Fn.neg(d_);
    return { scalar, bytes: affineXToBytes(affine) };
  }
  function lift_x(x) {
    const Fp = Fpk1;
    if (!Fp.isValidNot0(x))
      throw new Error("invalid x: Fail if x \u2265 p");
    const xx = Fp.sqr(x);
    const c = Fp.add(Fp.mulN(xx, x), BigInt(7));
    let y = Fp.sqrt(c);
    if (!hasEven(y))
      y = Fp.neg(y);
    const p = Pointk1.fromAffine({ x, y });
    p.assertValidity();
    return p;
  }
  var num = bytesToNumberBE;
  function challenge(...args) {
    return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
  }
  function schnorrGetPublicKey(secretKey) {
    return schnorrGetExtPubKey(secretKey).bytes;
  }
  function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
    const { Fn, BASE } = Pointk1;
    const m = copyBytes(abytes2(message, void 0, "message"));
    const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
    const a = abytes2(auxRand, 32, "auxRand");
    const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
    const rand = taggedHash("BIP0340/nonce", t, px, m);
    const k_ = Fn.create(num(rand));
    if (k_ === _0n5)
      throw new Error("sign failed: k is zero");
    const p = BASE.multiply(k_);
    const affine = p.toAffine();
    const k = hasEven(affine.y) ? k_ : Fn.neg(k_);
    const rx = affineXToBytes(affine);
    const e = challenge(rx, px, m);
    const sig = new Uint8Array(64);
    sig.set(rx, 0);
    sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
    if (!schnorrVerify(sig, m, px))
      throw new Error("sign: Invalid signature produced");
    return sig;
  }
  function schnorrVerify(signature, message, publicKey) {
    const { Fp, Fn, BASE } = Pointk1;
    const sig = abytes2(signature, 64, "signature");
    const m = abytes2(message, void 0, "message");
    const pub = abytes2(publicKey, 32, "publicKey");
    try {
      const P = lift_x(num(pub));
      const rBytes = sig.subarray(0, 32);
      const r = num(rBytes);
      if (!Fp.isValidNot0(r))
        return false;
      const s = num(sig.subarray(32, 64));
      if (!Fn.isValidNot0(s))
        return false;
      const e = challenge(rBytes, pointToBytes(P), m);
      const R = BASE.mulAddUnsafe(s, P, Fn.neg(e));
      const { x, y } = R.toAffine();
      if (R.is0() || !hasEven(y) || !Fp.eql(x, r))
        return false;
      return true;
    } catch (error) {
      return false;
    }
  }
  var schnorr = /* @__PURE__ */ (() => {
    const size = 32;
    const seedLength = 48;
    const randomSecretKey = (seed) => {
      seed = seed === void 0 ? randomBytes(seedLength) : seed;
      return mapHashToField(abytes2(seed, seedLength, "seed"), secp256k1_CURVE.n);
    };
    return Object.freeze({
      keygen: createKeygen(randomSecretKey, schnorrGetPublicKey),
      getPublicKey: schnorrGetPublicKey,
      sign: schnorrSign,
      verify: schnorrVerify,
      Point: Pointk1,
      utils: Object.freeze({
        randomSecretKey,
        taggedHash,
        lift_x,
        pointToBytes
      }),
      lengths: Object.freeze({
        secretKey: size,
        publicKey: size,
        publicKeyHasPrefix: false,
        signature: size * 2,
        seed: seedLength
      })
    });
  })();

  // packages/core/dist/event.js
  var HEX64 = /^[0-9a-f]{64}$/;
  var HEX128 = /^[0-9a-f]{128}$/;
  function isHex64(v) {
    return typeof v === "string" && HEX64.test(v);
  }
  function nowSeconds() {
    return Math.floor(Date.now() / 1e3);
  }
  function serializeEvent(e) {
    return JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]);
  }
  function getEventHash(e) {
    return bytesToHex(sha256(utf8ToBytes(serializeEvent(e))));
  }
  function getPublicKey(secretKey) {
    return bytesToHex(schnorr.getPublicKey(secretKey));
  }
  function hasEventShape(v) {
    if (typeof v !== "object" || v === null)
      return false;
    const e = v;
    return Number.isInteger(e.kind) && e.kind >= 0 && Number.isInteger(e.created_at) && typeof e.content === "string" && Array.isArray(e.tags) && e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === "string")) && isHex64(e.pubkey) && isHex64(e.id) && typeof e.sig === "string" && HEX128.test(e.sig);
  }
  function verifyEvent(v) {
    if (!hasEventShape(v))
      return false;
    if (getEventHash(v) !== v.id)
      return false;
    try {
      return schnorr.verify(hexToBytes(v.sig), hexToBytes(v.id), hexToBytes(v.pubkey));
    } catch {
      return false;
    }
  }
  function getTags(e, name) {
    return e.tags.filter((t) => t[0] === name);
  }
  function getTagValue(e, name) {
    return e.tags.find((t) => t[0] === name)?.[1];
  }

  // node_modules/@scure/base/index.js
  /*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  var freeze = (fn) => Object.freeze(fn());
  function isBytes3(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  function abytes3(b) {
    if (!isBytes3(b))
      throw new TypeError("Uint8Array expected");
  }
  function isArrayOf(isString, arr) {
    if (!Array.isArray(arr))
      return false;
    if (arr.length === 0)
      return true;
    if (isString) {
      return arr.every((item) => typeof item === "string");
    } else {
      return arr.every((item) => Number.isSafeInteger(item));
    }
  }
  function afn(input) {
    if (typeof input !== "function")
      throw new TypeError("function expected");
    return true;
  }
  function astr(label, input) {
    if (typeof input !== "string")
      throw new TypeError(`${label}: string expected`);
    return true;
  }
  function anumber3(n, title = "number") {
    if (typeof n !== "number")
      throw new TypeError(`${title}: expected number, got ${typeof n}`);
    if (!Number.isSafeInteger(n))
      throw new RangeError(`${title}: expected safe integer, got ${n}`);
  }
  function anumArr(label, input) {
    if (!isArrayOf(false, input))
      throw new TypeError(`${label}: array of numbers expected`);
  }
  function chain(...args) {
    const id = (a) => a;
    const wrap = (a, b) => (c) => a(b(c));
    const encode = args.map((x) => x.encode).reduceRight(wrap, id);
    const decode = args.map((x) => x.decode).reduce(wrap, id);
    return { encode, decode };
  }
  var powers = /* @__PURE__ */ (() => {
    let res = [];
    for (let i = 0; i < 40; i++)
      res.push(2 ** i);
    return res;
  })();
  function u8ToNumArr(u8, len = u8.length) {
    const res = new Array(len);
    for (let i = 0; i < len; i++)
      res[i] = u8[i];
    return res;
  }
  var asciiDecoder = /* @__PURE__ */ (() => {
    try {
      const decoder4 = new TextDecoder();
      return decoder4.decode(Uint8Array.of(65, 48, 43, 127)) === "A0+\x7F" ? decoder4 : void 0;
    } catch (e) {
      return void 0;
    }
  })();
  var B2S_CHUNK = 8192;
  function charcodesToString(codes) {
    const len = codes.length;
    if (asciiDecoder !== void 0 && len >= 12)
      return asciiDecoder.decode(codes);
    if (len <= B2S_CHUNK)
      return String.fromCharCode.apply(null, codes);
    let res = "";
    for (let i = 0; i < len; i += B2S_CHUNK)
      res += String.fromCharCode.apply(null, codes.subarray(i, i + B2S_CHUNK));
    return res;
  }
  function radix2(bits) {
    anumber3(bits);
    if (bits <= 0 || bits > 8)
      throw new RangeError("radix2: bits should be in (0..8]");
    const mask = powers[bits] - 1;
    return {
      encode: (bytes) => {
        abytes3(bytes);
        const len = bytes.length;
        const res = new Uint8Array(Math.ceil(len * 8 / bits));
        let carry = 0;
        let pos = 0;
        let j = 0;
        for (let i = 0; i < len; ) {
          if (i + 2 < len) {
            carry = carry << 24 | bytes[i] << 16 | bytes[i + 1] << 8 | bytes[i + 2];
            pos += 24;
            i += 3;
          } else {
            carry = (carry << 8 | bytes[i]) & 65535;
            pos += 8;
            i++;
          }
          for (; ; ) {
            pos -= bits;
            res[j++] = carry >> pos & mask;
            if (pos < bits)
              break;
          }
        }
        if (pos > 0)
          res[j] = carry << bits - pos & mask;
        return res;
      },
      decode: (digits) => {
        const len = digits.length;
        const res = new Uint8Array(Math.floor(len * bits / 8));
        let carry = 0;
        let pos = 0;
        let j = 0;
        for (let i = 0; i < len; i++) {
          carry = (carry << bits | digits[i]) & 65535;
          pos += bits;
          for (; pos >= 8; pos -= 8)
            res[j++] = carry >> pos - 8 & 255;
        }
        carry = carry << 8 - pos & 255;
        if (pos >= bits)
          throw new Error("Excess padding");
        if (carry > 0)
          throw new Error(`Non-zero padding: ${carry}`);
        return res;
      }
    };
  }
  function alphabet(letters, aliases) {
    const len = letters.length;
    if (len > 128)
      throw new Error("alphabet: max 128 letters");
    const encTable = new Uint8Array(len);
    const decTable = new Int8Array(128).fill(-1);
    for (let i = 0; i < len; i++) {
      const code = letters.charCodeAt(i);
      if (letters.codePointAt(i) !== code || code > 127)
        throw new Error("alphabet: single-char ASCII letters only");
      encTable[i] = code;
      decTable[code] = i;
    }
    if (aliases !== void 0) {
      for (const alias of Object.keys(aliases)) {
        const code = alias.charCodeAt(0);
        const target2 = decTable[aliases[alias].charCodeAt(0)];
        if (alias.length !== 1 || code > 127 || target2 === void 0 || target2 === -1)
          throw new Error(`alphabet: invalid alias ${alias}`);
        decTable[code] = target2;
      }
    }
    return {
      encode: (digits) => {
        const codes = new Uint8Array(digits.length);
        for (let i = 0; i < digits.length; i++) {
          const d = digits[i];
          const code = encTable[d];
          if (code === void 0)
            throw new Error(`alphabet.encode: invalid digit ${d}`);
          codes[i] = code;
        }
        return charcodesToString(codes);
      },
      decode: (input) => {
        astr("decode", input);
        const slen = input.length;
        const digits = new Uint8Array(slen);
        for (let i = 0; i < slen; i++) {
          const code = input.charCodeAt(i);
          const digit = code < 128 ? decTable[code] : -1;
          if (digit === -1)
            throw new Error(`Unknown letter "${input[i]}". Allowed: ${letters}`);
          digits[i] = digit;
        }
        return digits;
      }
    };
  }
  function unsafeWrapper(fn) {
    afn(fn);
    return function(...args) {
      try {
        return fn.apply(null, args);
      } catch (e) {
      }
    };
  }
  var base64urlnopad = /* @__PURE__ */ freeze(() => chain(radix2(6), alphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")));
  var BECH_ALPHABET = /* @__PURE__ */ alphabet("qpzry9x8gf2tvdw0s3jn54khce6mua7l");
  var BECH_UPPERCASE_PRINTABLE = /^[\x21-\x60\x7b-\x7e]+$/;
  function assertBech32Printable(label, value) {
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      if (c < 33 || c > 126)
        throw new Error(`${label}: printable ASCII expected`);
    }
  }
  function wordsToU8(words2) {
    const len = words2.length;
    const res = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const w = words2[i];
      if (w < 0 || w >= 32)
        throw new Error(`alphabet.encode: invalid digit ${w}`);
      res[i] = w;
    }
    return res;
  }
  var POLYMOD_GENERATORS = [996825010, 642813549, 513874426, 1027748829, 705979059];
  function bech32Polymod(pre) {
    const b = pre >> 25;
    let chk = (pre & 33554431) << 5;
    for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
      if ((b >> i & 1) === 1)
        chk ^= POLYMOD_GENERATORS[i];
    }
    return chk;
  }
  function bechChecksum(prefix, words2, encodingConst = 1) {
    const len = prefix.length;
    let chk = 1;
    for (let i = 0; i < len; i++) {
      const c = prefix.charCodeAt(i);
      if (c < 33 || c > 126)
        throw new Error(`Invalid prefix (${prefix})`);
      chk = bech32Polymod(chk) ^ c >> 5;
    }
    chk = bech32Polymod(chk);
    for (let i = 0; i < len; i++)
      chk = bech32Polymod(chk) ^ prefix.charCodeAt(i) & 31;
    for (let v of words2)
      chk = bech32Polymod(chk) ^ v;
    for (let i = 0; i < 6; i++)
      chk = bech32Polymod(chk);
    chk ^= encodingConst;
    const sum = new Uint8Array(6);
    for (let i = 0; i < 6; i++)
      sum[i] = chk >>> 5 * (5 - i) & 31;
    return BECH_ALPHABET.encode(sum);
  }
  function genBech32(encoding) {
    const ENCODING_CONST = encoding === "bech32" ? 1 : 734539939;
    const _words = radix2(5);
    const toWords = (from) => {
      abytes3(from);
      const len = from.length;
      const res = new Array(Math.ceil(len * 8 / 5));
      let carry = 0;
      let pos = 0;
      let j = 0;
      for (let i = 0; i < len; i++) {
        carry = carry << 8 | from[i];
        pos += 8;
        for (; pos >= 5; pos -= 5)
          res[j++] = carry >> pos - 5 & 31;
      }
      if (pos > 0)
        res[j] = carry << 5 - pos & 31;
      return res;
    };
    const fromWords = (to) => {
      anumArr("radix2.decode", to);
      const len = to.length;
      const digits = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        const w = to[i];
        if (w < 0 || w >= 32)
          throw new Error(`convertRadix2: invalid word=${w}`);
        digits[i] = w;
      }
      return _words.decode(digits);
    };
    const fromWordsUnsafe = unsafeWrapper(fromWords);
    function encode(prefix, words2, limit = 90) {
      astr("bech32.encode prefix", prefix);
      if (limit !== false)
        anumber3(limit, "limit");
      if (isBytes3(words2))
        words2 = u8ToNumArr(words2);
      anumArr("bech32.encode", words2);
      const plen = prefix.length;
      if (plen === 0)
        throw new TypeError(`Invalid prefix length ${plen}`);
      const actualLength = plen + 7 + words2.length;
      if (limit !== false && actualLength > limit)
        throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
      assertBech32Printable("bech32.encode prefix", prefix);
      const lowered = prefix.toLowerCase();
      const sum = bechChecksum(lowered, words2, ENCODING_CONST);
      return `${lowered}1${BECH_ALPHABET.encode(wordsToU8(words2))}${sum}`;
    }
    function decode(str, limit = 90) {
      astr("bech32.decode input", str);
      if (limit !== false)
        anumber3(limit, "limit");
      const slen = str.length;
      if (slen < 8 || limit !== false && slen > limit)
        throw new TypeError(`invalid string length ${slen}, expected (8..${limit})`);
      const lowered = str.toLowerCase();
      if (str !== lowered) {
        if (!BECH_UPPERCASE_PRINTABLE.test(str)) {
          assertBech32Printable("bech32.decode input", str);
          throw new Error(`mixed-case string not allowed`);
        }
      }
      const sepIndex = lowered.lastIndexOf("1");
      if (sepIndex === 0 || sepIndex === -1)
        throw new Error(`invalid separator "1"`);
      const prefix = lowered.slice(0, sepIndex);
      const data = lowered.slice(sepIndex + 1);
      if (data.length < 6)
        throw new Error("invalid data length");
      const digits = BECH_ALPHABET.decode(data);
      const words2 = u8ToNumArr(digits, digits.length - 6);
      const sum = bechChecksum(prefix, words2, ENCODING_CONST);
      if (!data.endsWith(sum))
        throw new Error(`Invalid checksum in ${str}`);
      return { prefix, words: words2 };
    }
    const decodeUnsafe = unsafeWrapper(decode);
    function decodeToBytes(str, limit = 90) {
      const { prefix, words: words2 } = decode(str, limit);
      return {
        prefix,
        words: words2,
        bytes: fromWords(words2)
      };
    }
    function encodeFromBytes(prefix, bytes) {
      return encode(prefix, toWords(bytes));
    }
    return {
      encode,
      decode,
      encodeFromBytes,
      decodeToBytes,
      decodeUnsafe,
      fromWords,
      fromWordsUnsafe,
      toWords
    };
  }
  var bech32 = /* @__PURE__ */ freeze(() => genBech32("bech32"));

  // packages/core/dist/nip19.js
  var BECH32_LIMIT = 5e3;
  var decoder = new TextDecoder();
  function encodeNaddr(p) {
    if (!isHex64(p.pubkey))
      throw new NswpError("invalid_pubkey", "pubkey must be 64 lowercase hex characters");
    if (!Number.isInteger(p.kind) || p.kind < 0 || p.kind > 4294967295)
      throw new NswpError("invalid_kind", "kind out of range");
    const parts2 = [];
    const tlv = (type, value) => {
      if (value.length > 255)
        throw new NswpError("tlv_too_long", `TLV value for type ${type} exceeds 255 bytes`);
      parts2.push(Uint8Array.of(type, value.length), value);
    };
    tlv(0, utf8ToBytes(p.identifier));
    for (const r of p.relays ?? [])
      tlv(1, utf8ToBytes(r));
    tlv(2, hexToBytes(p.pubkey));
    const kind = new Uint8Array(4);
    new DataView(kind.buffer).setUint32(0, p.kind, false);
    tlv(3, kind);
    const bytes = new Uint8Array(parts2.reduce((n, a) => n + a.length, 0));
    let off = 0;
    for (const a of parts2) {
      bytes.set(a, off);
      off += a.length;
    }
    return bech32.encode("naddr", bech32.toWords(bytes), BECH32_LIMIT);
  }
  function decodeNaddr(s) {
    let decoded;
    try {
      decoded = bech32.decode(s, BECH32_LIMIT);
    } catch (cause) {
      throw new NswpError("naddr_invalid", "not a valid bech32 string", { cause });
    }
    if (decoded.prefix !== "naddr")
      throw new NswpError("naddr_invalid", `expected naddr, got ${decoded.prefix}`);
    const bytes = bech32.fromWords(decoded.words);
    let identifier;
    let pubkey;
    let kind;
    const relays = [];
    for (let i = 0; i < bytes.length; ) {
      const type = bytes[i];
      const len = bytes[i + 1];
      if (len === void 0 || i + 2 + len > bytes.length)
        throw new NswpError("naddr_invalid", "truncated TLV");
      const value = bytes.slice(i + 2, i + 2 + len);
      if (type === 0)
        identifier = decoder.decode(value);
      else if (type === 1)
        relays.push(decoder.decode(value));
      else if (type === 2 && len === 32)
        pubkey = bytesToHex(value);
      else if (type === 3 && len === 4)
        kind = new DataView(value.buffer, value.byteOffset, 4).getUint32(0, false);
      i += 2 + len;
    }
    if (identifier === void 0 || pubkey === void 0 || kind === void 0) {
      throw new NswpError("naddr_invalid", "naddr is missing identifier, author or kind");
    }
    return relays.length ? { kind, pubkey, identifier, relays } : { kind, pubkey, identifier };
  }
  function encodeNpub(pubkey) {
    return bech32.encode("npub", bech32.toWords(hexToBytes(pubkey)), BECH32_LIMIT);
  }
  function shortNpub(pubkey) {
    const npub = encodeNpub(pubkey);
    return `${npub.slice(0, 10)}\u2026${npub.slice(-4)}`;
  }

  // node_modules/tldts-core/dist/es6/src/domain.js
  function shareSameDomainSuffix(hostname, vhost) {
    if (hostname.endsWith(vhost)) {
      return hostname.length === vhost.length || hostname[hostname.length - vhost.length - 1] === ".";
    }
    return false;
  }
  function extractDomainWithSuffix(hostname, publicSuffix) {
    const publicSuffixIndex = hostname.length - publicSuffix.length - 2;
    const lastDotBeforeSuffixIndex = hostname.lastIndexOf(".", publicSuffixIndex);
    if (lastDotBeforeSuffixIndex === -1) {
      return hostname;
    }
    return hostname.slice(lastDotBeforeSuffixIndex + 1);
  }
  function getDomain(suffix, hostname, options) {
    if (options.validHosts !== null) {
      const validHosts = options.validHosts;
      for (const vhost of validHosts) {
        if (
          /*@__INLINE__*/
          shareSameDomainSuffix(hostname, vhost)
        ) {
          return vhost;
        }
      }
    }
    let numberOfLeadingDots = 0;
    if (hostname.startsWith(".")) {
      while (numberOfLeadingDots < hostname.length && hostname[numberOfLeadingDots] === ".") {
        numberOfLeadingDots += 1;
      }
    }
    if (suffix.length === hostname.length - numberOfLeadingDots) {
      return null;
    }
    return (
      /*@__INLINE__*/
      extractDomainWithSuffix(hostname, suffix)
    );
  }

  // node_modules/tldts-core/dist/es6/src/domain-without-suffix.js
  function getDomainWithoutSuffix(domain, suffix) {
    return domain.slice(0, -suffix.length - 1);
  }

  // node_modules/tldts-core/dist/es6/src/extract-hostname.js
  var CONTROL_CHARS = /[\t\n\r]/g;
  var extractedHostnameValidated = false;
  function isValidHostnameChar(code) {
    return code >= 97 && code <= 122 || // a-z
    code >= 48 && code <= 57 || // 0-9
    code > 127 || // non-ASCII (accepted, not punycode-checked)
    code >= 65 && code <= 90 || // A-Z (becomes valid once lowercased)
    code === 45 || // '-'
    code === 95;
  }
  function getSpecialScheme(url, schemeStart, colonIndex) {
    const length = colonIndex - schemeStart;
    const c0 = url.charCodeAt(schemeStart) | 32;
    if (length === 2) {
      return c0 === 119 && (url.charCodeAt(schemeStart + 1) | 32) === 115 ? 1 : 0;
    } else if (length === 3) {
      const c1 = url.charCodeAt(schemeStart + 1) | 32;
      const c2 = url.charCodeAt(schemeStart + 2) | 32;
      if (c0 === 119 && c1 === 115 && c2 === 115)
        return 1;
      if (c0 === 102 && c1 === 116 && c2 === 112)
        return 1;
      return 0;
    } else if (length === 4) {
      const c1 = url.charCodeAt(schemeStart + 1) | 32;
      const c2 = url.charCodeAt(schemeStart + 2) | 32;
      const c3 = url.charCodeAt(schemeStart + 3) | 32;
      if (c0 === 104 && c1 === 116 && c2 === 116 && c3 === 112)
        return 1;
      if (c0 === 102 && c1 === 105 && c2 === 108 && c3 === 101)
        return 2;
      return 0;
    } else if (length === 5) {
      return c0 === 104 && (url.charCodeAt(schemeStart + 1) | 32) === 116 && (url.charCodeAt(schemeStart + 2) | 32) === 116 && (url.charCodeAt(schemeStart + 3) | 32) === 112 && (url.charCodeAt(schemeStart + 4) | 32) === 115 ? 1 : 0;
    }
    return 0;
  }
  function extractHostname(url, urlIsValidHostname, validate = false) {
    let start2 = 0;
    let end = url.length;
    let hasUpper = false;
    let isSpecial = true;
    extractedHostnameValidated = false;
    if (!urlIsValidHostname) {
      while (start2 < url.length && url.charCodeAt(start2) <= 32) {
        start2 += 1;
      }
      if (url.charCodeAt(start2 + 4) === 58 && (url.charCodeAt(start2) | 32) === 100 && (url.charCodeAt(start2 + 1) | 32) === 97 && (url.charCodeAt(start2 + 2) | 32) === 116 && (url.charCodeAt(start2 + 3) | 32) === 97 || url.charCodeAt(start2 + 10) === 58 && (url.charCodeAt(start2) | 32) === 106 && (url.charCodeAt(start2 + 1) | 32) === 97 && (url.charCodeAt(start2 + 2) | 32) === 118 && (url.charCodeAt(start2 + 3) | 32) === 97 && (url.charCodeAt(start2 + 4) | 32) === 115 && (url.charCodeAt(start2 + 5) | 32) === 99 && (url.charCodeAt(start2 + 6) | 32) === 114 && (url.charCodeAt(start2 + 7) | 32) === 105 && (url.charCodeAt(start2 + 8) | 32) === 112 && (url.charCodeAt(start2 + 9) | 32) === 116) {
        return null;
      }
      while (end > start2 + 1 && url.charCodeAt(end - 1) <= 32) {
        end -= 1;
      }
      if ((url.charCodeAt(start2) === 47 || url.charCodeAt(start2) === 92) && (url.charCodeAt(start2 + 1) === 47 || url.charCodeAt(start2 + 1) === 92)) {
        start2 += 2;
      } else {
        let indexOfProtocol = url.indexOf(":/", start2);
        if (indexOfProtocol !== -1) {
          const special = getSpecialScheme(url, start2, indexOfProtocol);
          if (special === 1) {
            start2 = indexOfProtocol + 2;
            while (url.charCodeAt(start2) === 47 || url.charCodeAt(start2) === 92) {
              start2 += 1;
            }
          } else if (special === 2) {
            start2 = indexOfProtocol + 1;
            let slashes = 0;
            while ((url.charCodeAt(start2) === 47 || url.charCodeAt(start2) === 92) && slashes < 2) {
              start2 += 1;
              slashes += 1;
            }
            if (slashes < 2) {
              return null;
            }
          } else {
            for (let i = start2; i < indexOfProtocol; i += 1) {
              const code = url.charCodeAt(i);
              if (!((code | 32) >= 97 && (code | 32) <= 122 || // [a-zA-Z] (fold letters only)
              code >= 48 && code <= 57 || // [0, 9]
              code === 46 || // '.'
              code === 45 || // '-'
              code === 43)) {
                if (code === 9 || code === 10 || code === 13) {
                  return extractHostname(url.replace(CONTROL_CHARS, ""), urlIsValidHostname, validate);
                }
                for (let j = i; j < indexOfProtocol; j += 1) {
                  const c = url.charCodeAt(j);
                  if (c === 47 || c === 92 || c === 63 || c === 35) {
                    indexOfProtocol = -1;
                    break;
                  }
                }
                if (indexOfProtocol !== -1) {
                  return null;
                }
                break;
              }
            }
            if (indexOfProtocol !== -1) {
              if (url.charCodeAt(indexOfProtocol + 2) === 47) {
                isSpecial = false;
                start2 = indexOfProtocol + 3;
              } else {
                return null;
              }
            }
          }
        }
        if (indexOfProtocol === -1 && url.charCodeAt(start2) !== 91) {
          let indexOfColon = -1;
          for (let i = start2; i < end; i += 1) {
            const code = url.charCodeAt(i);
            if (code === 9 || code === 10 || code === 13) {
              return extractHostname(url.replace(CONTROL_CHARS, ""), urlIsValidHostname, validate);
            }
            if (code === 58) {
              indexOfColon = i;
              break;
            }
            if (code === 47 || code === 92 || code === 63 || code === 35) {
              break;
            }
          }
          if (indexOfColon !== -1) {
            let hasIdentifier = false;
            for (let i = indexOfColon + 1; i < end; i += 1) {
              const code = url.charCodeAt(i);
              if (code === 47 || code === 92 || code === 63 || code === 35) {
                break;
              }
              if (code === 64) {
                hasIdentifier = true;
                break;
              }
            }
            if (!hasIdentifier) {
              let allDigits = true;
              let i = indexOfColon + 1;
              for (; i < end; i += 1) {
                const code = url.charCodeAt(i);
                if (code === 47 || code === 92 || code === 63 || code === 35) {
                  break;
                }
                if (code < 48 || code > 57) {
                  allDigits = false;
                  break;
                }
              }
              if (i === indexOfColon + 1) {
                allDigits = false;
              }
              if (!allDigits) {
                const special = getSpecialScheme(url, start2, indexOfColon);
                if (special === 0) {
                  let isBareIpv6 = false;
                  for (let j = indexOfColon + 1; j < end; j += 1) {
                    const code = url.charCodeAt(j);
                    if (code === 47 || code === 92 || code === 63 || code === 35) {
                      break;
                    }
                    if (code === 58) {
                      isBareIpv6 = true;
                      break;
                    }
                  }
                  if (!isBareIpv6) {
                    return null;
                  }
                } else {
                  start2 = indexOfColon + 1;
                  if (special === 2) {
                    let slashes = 0;
                    while ((url.charCodeAt(start2) === 47 || url.charCodeAt(start2) === 92) && slashes < 2) {
                      start2 += 1;
                      slashes += 1;
                    }
                    if (slashes < 2) {
                      return null;
                    }
                  } else {
                    while (url.charCodeAt(start2) === 47 || url.charCodeAt(start2) === 92) {
                      start2 += 1;
                    }
                  }
                }
              }
            }
          }
        }
      }
      let indexOfIdentifier = -1;
      let indexOfClosingBracket = -1;
      let indexOfPort = -1;
      let indexOfFirstColon = -1;
      let hasControl = false;
      let vValid = validate;
      let vLastDot = start2 - 1;
      let vLastCode = -1;
      if (validate && start2 < end) {
        const c0 = url.charCodeAt(start2);
        if (
          // Keep these parens: they scope /*@__INLINE__*/ for terser.
          // prettier-ignore
          !/*@__INLINE__*/
          (isValidHostnameChar(c0) || c0 === 46 || c0 === 95) || c0 === 45
        ) {
          vValid = false;
        }
      }
      for (let i = start2; i < end; i += 1) {
        const code = url.charCodeAt(i);
        if (code < 64) {
          if (code === 47 || code === 35 || code === 63) {
            end = i;
            break;
          } else if (code === 58) {
            if (indexOfFirstColon === -1) {
              indexOfFirstColon = i;
            }
            indexOfPort = i;
          } else if (code === 9 || code === 10 || code === 13) {
            hasControl = true;
          } else if (validate) {
            if (code === 46) {
              if (i - vLastDot > 64 || vLastCode === 46 || vLastCode === 45) {
                vValid = false;
              }
              vLastDot = i;
            } else if (code < 48 || code > 57) {
              if (code !== 45 || vLastCode === 46) {
                vValid = false;
              }
            }
          }
        } else if (isSpecial && code === 92) {
          end = i;
          break;
        } else if (code === 64) {
          indexOfIdentifier = i;
          indexOfFirstColon = -1;
        } else if (code === 93) {
          indexOfClosingBracket = i;
        } else if (code >= 65 && code <= 90) {
          hasUpper = true;
        } else if (validate && !/*@__INLINE__*/
        isValidHostnameChar(code)) {
          vValid = false;
        }
        if (validate) {
          vLastCode = code;
        }
      }
      if (hasControl) {
        return extractHostname(url.replace(CONTROL_CHARS, ""), urlIsValidHostname, validate);
      }
      if (indexOfIdentifier !== -1 && indexOfIdentifier >= start2 && indexOfIdentifier < end) {
        start2 = indexOfIdentifier + 1;
      }
      if (url.charCodeAt(start2) === 91) {
        if (indexOfClosingBracket !== -1) {
          return url.slice(start2 + 1, indexOfClosingBracket).toLowerCase();
        }
        return null;
      } else if (indexOfPort !== -1 && indexOfPort > start2 && indexOfPort < end && // A host:port has exactly one ':' in the host (so its first ':' is its
      // last); a bare, unbracketed IPv6 literal ("2a01:e35::1") has >= 2, so
      // its first ':' precedes the last. Only the former has a ':port' to trim.
      indexOfFirstColon === indexOfPort) {
        end = indexOfPort;
      }
      if (start2 >= end) {
        return null;
      }
      if (validate && vValid && indexOfIdentifier === -1 && indexOfPort === -1 && indexOfClosingBracket === -1 && url.charCodeAt(end - 1) !== 46 && end - start2 <= 255 && // total length
      end - vLastDot - 1 <= 63 && // last label length
      vLastCode !== 45) {
        extractedHostnameValidated = true;
      }
    }
    while (end > start2 + 1 && url.charCodeAt(end - 1) === 46) {
      end -= 1;
    }
    const hostname = start2 !== 0 || end !== url.length ? url.slice(start2, end) : url;
    if (hasUpper) {
      return hostname.toLowerCase();
    }
    return hostname;
  }

  // node_modules/tldts-core/dist/es6/src/is-ip.js
  function isProbablyIpv4(hostname) {
    if (hostname.length < 7) {
      return false;
    }
    if (hostname.length > 15) {
      return false;
    }
    let numberOfDots = 0;
    for (let i = 0; i < hostname.length; i += 1) {
      const code = hostname.charCodeAt(i);
      if (code === 46) {
        numberOfDots += 1;
      } else if (code < 48 || code > 57) {
        return false;
      }
    }
    return numberOfDots === 3 && hostname.charCodeAt(0) !== 46 && hostname.charCodeAt(hostname.length - 1) !== 46;
  }
  function isProbablyIpv6(hostname) {
    if (hostname.length < 3) {
      return hostname === "::";
    }
    let start2 = hostname.startsWith("[") ? 1 : 0;
    let end = hostname.length;
    if (hostname[end - 1] === "]") {
      end -= 1;
    }
    if (end - start2 > 39) {
      return false;
    }
    let hasColon = false;
    for (; start2 < end; start2 += 1) {
      const code = hostname.charCodeAt(start2);
      if (code === 58) {
        hasColon = true;
      } else if (!(code >= 48 && code <= 57 || // 0-9
      code >= 97 && code <= 102 || // a-f
      code >= 65 && code <= 70)) {
        return false;
      }
    }
    return hasColon;
  }
  function isIp(hostname) {
    return isProbablyIpv6(hostname) || isProbablyIpv4(hostname);
  }

  // node_modules/tldts-core/dist/es6/src/is-special-use.js
  var SPECIAL_USE_DOMAINS = [
    "test",
    // RFC 6761
    "localhost",
    // RFC 6761
    "invalid",
    // RFC 6761
    "example",
    // RFC 6761
    "example.com",
    // RFC 6761
    "example.net",
    // RFC 6761
    "example.org",
    // RFC 6761
    "local",
    // RFC 6762 (mDNS)
    "onion",
    // RFC 7686 (Tor)
    "alt",
    // RFC 9476
    "home.arpa",
    // RFC 8375
    "ipv4only.arpa",
    // RFC 8880
    "resolver.arpa",
    // RFC 9462
    "service.arpa",
    // RFC 9665
    "6tisch.arpa",
    // RFC 9031
    "eap.arpa"
    // RFC 9965
  ];
  function isSpecialUse(hostname) {
    for (const name of SPECIAL_USE_DOMAINS) {
      if (hostname.endsWith(name) && (hostname.length === name.length || hostname.charCodeAt(hostname.length - name.length - 1) === 46)) {
        return true;
      }
    }
    return false;
  }

  // node_modules/tldts-core/dist/es6/src/is-valid.js
  function isValidAscii(code) {
    return code >= 97 && code <= 122 || code >= 48 && code <= 57 || code > 127;
  }
  function is_valid_default(hostname) {
    if (hostname.length > 255) {
      return false;
    }
    if (hostname.length === 0) {
      return false;
    }
    if (
      /*@__INLINE__*/
      !isValidAscii(hostname.charCodeAt(0)) && hostname.charCodeAt(0) !== 46 && // '.' (dot)
      hostname.charCodeAt(0) !== 95
    ) {
      return false;
    }
    let lastDotIndex = -1;
    let lastCharCode = -1;
    const len = hostname.length;
    for (let i = 0; i < len; i += 1) {
      const code = hostname.charCodeAt(i);
      if (code === 46) {
        if (
          // Check that previous label is < 63 bytes long (64 = 63 + '.')
          i - lastDotIndex > 64 || // Check that previous character was not already a '.'
          lastCharCode === 46 || // Check that the previous label does not end with '-' (RFC 1035 §2.3.1 LDH).
          // '_' is intentionally NOT restricted: DNS allows any octet (RFC 2181 §11) and
          // WHATWG URL does not treat '_' as a forbidden host code point.
          lastCharCode === 45
        ) {
          return false;
        }
        lastDotIndex = i;
      } else if (
        // A forbidden character in the label...
        // Keep these parens: they scope /*@__INLINE__*/ for terser.
        // prettier-ignore
        !/*@__INLINE__*/
        (isValidAscii(code) || code === 45 || code === 95) || // ...or a '-' starting a label (the byte right after a '.'). A label must
        // not begin with a hyphen (RFC 1034 §3.5 / RFC 1035 §2.3.1 LDH, as amended
        // by RFC 1123 §2.1; cf. UTS #46 CheckHyphens). The first label is covered by
        // the leading-character guard above; mirrors the trailing-'-' rule below.
        code === 45 && lastCharCode === 46
      ) {
        return false;
      }
      lastCharCode = code;
    }
    return (
      // Check that last label is shorter than 63 chars
      len - lastDotIndex - 1 <= 63 && // Check that the last character is an allowed trailing label character.
      // Since we already checked that the char is a valid hostname character,
      // we only need to check that it's different from '-'.
      lastCharCode !== 45
    );
  }

  // node_modules/tldts-core/dist/es6/src/lookup/extra-suffixes.js
  function extraSuffixLookup(hostname, options, isException, out) {
    const suffix = out.publicSuffix;
    if (suffix === null) {
      return;
    }
    const none = hostname.length + 1;
    let exception = none;
    let exceptionIsIcann = false;
    let rule = none;
    let ruleIsIcann = false;
    const extra = options.extraSuffixes;
    for (let section = 0; section < 2; section += 1) {
      const isIcann = section === 0;
      const rules = isIcann ? options.allowIcannDomains && extra.icann : options.allowPrivateDomains && extra.private;
      if (!Array.isArray(rules)) {
        continue;
      }
      for (const r of rules) {
        if (typeof r !== "string") {
          continue;
        }
        const exceptionRule = r.startsWith("!");
        const wildcard = r.startsWith("*.");
        const body = exceptionRule ? r.slice(1) : wildcard ? r.slice(2) : r;
        if (body === "" || exceptionRule && !body.includes(".") || !shareSameDomainSuffix(hostname, body)) {
          continue;
        }
        let start2 = hostname.length - body.length;
        if (exceptionRule) {
          if (start2 < exception) {
            exception = start2;
            exceptionIsIcann = isIcann;
          }
          continue;
        }
        if (wildcard && start2 > 1 && hostname.charCodeAt(start2 - 2) !== 46) {
          start2 = hostname.lastIndexOf(".", start2 - 2) + 1;
        }
        if (start2 < rule) {
          rule = start2;
          ruleIsIcann = isIcann;
        }
      }
    }
    const suffixStart = hostname.length - suffix.length;
    const builtin = isException ? hostname.lastIndexOf(".", suffixStart - 2) + 1 : suffixStart;
    if (exception <= rule && (isException ? exception < builtin : exception <= builtin)) {
      out.publicSuffix = hostname.slice(hostname.indexOf(".", exception) + 1);
      out.isIcann = exceptionIsIcann;
      out.isPrivate = !exceptionIsIcann;
    } else if (rule < builtin || rule === builtin && !out.isIcann && !out.isPrivate) {
      out.publicSuffix = hostname.slice(rule);
      out.isIcann = ruleIsIcann;
      out.isPrivate = !ruleIsIcann;
    }
  }

  // node_modules/tldts-core/dist/es6/src/options.js
  function setDefaultsImpl({ allowIcannDomains = true, allowPrivateDomains = false, detectIp = true, detectSpecialUse = false, extraSuffixes = null, extractHostname: extractHostname2 = true, mixedInputs = true, validHosts = null, validateHostname = true }) {
    return {
      allowIcannDomains,
      allowPrivateDomains,
      detectIp,
      detectSpecialUse,
      extraSuffixes,
      extractHostname: extractHostname2,
      mixedInputs,
      validHosts,
      validateHostname
    };
  }
  var DEFAULT_OPTIONS = (
    /*@__INLINE__*/
    setDefaultsImpl({})
  );
  function setDefaults(options) {
    if (options === void 0) {
      return DEFAULT_OPTIONS;
    }
    return (
      /*@__INLINE__*/
      setDefaultsImpl(options)
    );
  }

  // node_modules/tldts-core/dist/es6/src/subdomain.js
  function getSubdomain(hostname, domain) {
    if (domain.length === hostname.length) {
      return "";
    }
    return hostname.slice(0, -domain.length - 1);
  }

  // node_modules/tldts-core/dist/es6/src/factory.js
  function getEmptyResult() {
    return {
      domain: null,
      domainWithoutSuffix: null,
      hostname: null,
      isIcann: null,
      isIp: null,
      isPrivate: null,
      isSpecialUse: null,
      publicSuffix: null,
      subdomain: null
    };
  }
  function parseImpl(url, step, suffixLookup2, partialOptions, result) {
    const options = (
      /*@__INLINE__*/
      setDefaults(partialOptions)
    );
    if (typeof url !== "string") {
      return result;
    }
    let urlIsValid = false;
    if (!options.extractHostname) {
      let end = url.length;
      while (end > 1 && url.charCodeAt(end - 1) === 46) {
        end -= 1;
      }
      result.hostname = end === url.length ? url : url.slice(0, end);
    } else if (options.mixedInputs) {
      urlIsValid = is_valid_default(url);
      result.hostname = extractHostname(url, urlIsValid, options.validateHostname);
    } else {
      result.hostname = extractHostname(url, false, options.validateHostname);
    }
    if (options.detectIp && result.hostname !== null) {
      result.isIp = isIp(result.hostname);
      if (result.isIp) {
        return result;
      }
    }
    if (options.validateHostname && options.extractHostname && result.hostname !== null && // Skip the re-scan when `url` was already validated and extractHostname
    // returned it unchanged (same reference => identical string, still valid).
    !(urlIsValid && result.hostname === url) && // Skip the re-scan when extractHostname already validated the host inline
    // (a confirmed-valid simple authority — see extract-hostname.ts).
    !extractedHostnameValidated && !is_valid_default(result.hostname)) {
      result.hostname = null;
      return result;
    }
    if (step === 0 || result.hostname === null) {
      return result;
    }
    if (step === 5 && options.detectSpecialUse) {
      result.isSpecialUse = isSpecialUse(result.hostname);
    }
    const isException = suffixLookup2(result.hostname, options, result);
    if (options.extraSuffixes !== null) {
      extraSuffixLookup(result.hostname, options, isException === true, result);
    }
    if (step === 2 || result.publicSuffix === null) {
      return result;
    }
    result.domain = getDomain(result.publicSuffix, result.hostname, options);
    if (step === 3 || result.domain === null) {
      return result;
    }
    result.subdomain = getSubdomain(result.hostname, result.domain);
    if (step === 4) {
      return result;
    }
    result.domainWithoutSuffix = getDomainWithoutSuffix(result.domain, result.publicSuffix);
    return result;
  }

  // node_modules/tldts-core/dist/es6/src/lookup/fast-path.js
  function fast_path_default(hostname, options, out) {
    if (!options.allowPrivateDomains && options.allowIcannDomains && hostname.length > 3) {
      const last = hostname.length - 1;
      const c3 = hostname.charCodeAt(last);
      const c2 = hostname.charCodeAt(last - 1);
      const c1 = hostname.charCodeAt(last - 2);
      const c0 = hostname.charCodeAt(last - 3);
      if (c3 === 109 && c2 === 111 && c1 === 99 && c0 === 46) {
        out.isIcann = true;
        out.isPrivate = false;
        out.publicSuffix = "com";
        return true;
      } else if (c3 === 103 && c2 === 114 && c1 === 111 && c0 === 46) {
        out.isIcann = true;
        out.isPrivate = false;
        out.publicSuffix = "org";
        return true;
      } else if (c3 === 117 && c2 === 100 && c1 === 101 && c0 === 46) {
        out.isIcann = true;
        out.isPrivate = false;
        out.publicSuffix = "edu";
        return true;
      } else if (c3 === 118 && c2 === 111 && c1 === 103 && c0 === 46) {
        out.isIcann = true;
        out.isPrivate = false;
        out.publicSuffix = "gov";
        return true;
      } else if (c3 === 116 && c2 === 101 && c1 === 110 && c0 === 46) {
        out.isIcann = true;
        out.isPrivate = false;
        out.publicSuffix = "net";
        return true;
      } else if (c3 === 101 && c2 === 100 && c1 === 46) {
        out.isIcann = true;
        out.isPrivate = false;
        out.publicSuffix = "de";
        return true;
      }
    }
    return false;
  }

  // node_modules/tldts/dist/es6/src/data/trie.js
  var nodeFlags = /* @__PURE__ */ new Uint8Array([1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 0, 2, 2, 2, 2, 0, 2, 2, 2, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 0, 2, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 2, 0, 0, 0, 1, 1, 1, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 2, 1, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 2, 2, 0, 0, 0, 2, 0, 1, 1, 0, 2, 0, 2, 2, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 2, 2, 0, 2, 2, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 2, 2, 0, 2, 2, 2, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 2, 2, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 2, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  var edgeStart = /* @__PURE__ */ new Uint16Array([0, 0, 0, 10, 11, 18, 106, 111, 117, 124, 130, 136, 145, 146, 147, 148, 149, 150, 151, 153, 154, 156, 157, 158, 160, 162, 236, 249, 251, 252, 253, 268, 270, 277, 278, 281, 282, 283, 286, 288, 307, 308, 310, 319, 324, 341, 342, 345, 346, 348, 350, 386, 387, 389, 392, 393, 397, 399, 403, 406, 438, 441, 454, 455, 463, 464, 466, 476, 490, 491, 492, 493, 502, 503, 540, 545, 561, 581, 587, 629, 631, 632, 633, 634, 661, 688, 689, 837, 843, 846, 847, 848, 853, 858, 867, 889, 890, 891, 892, 893, 894, 895, 913, 915, 916, 919, 921, 922, 924, 926, 941, 956, 961, 962, 964, 965, 966, 967, 968, 970, 973, 978, 979, 980, 982, 983, 986, 989, 990, 991, 1004, 1006, 1018, 1029, 1037, 1039, 1079, 1082, 1086, 1087, 1089, 1092, 1103, 1105, 1115, 1117, 1123, 1125, 1126, 1128, 1131, 1132, 1133, 1186, 1188, 1190, 1210, 1211, 1212, 1213, 1215, 1226, 1257, 1268, 1269, 1282, 1292, 1301, 1309, 1310, 1315, 1329, 1340, 1352, 1364, 1378, 1379, 1390, 1424, 1425, 1426, 1442, 1458, 1470, 1543, 1544, 1546, 1547, 1583, 1602, 1603, 1604, 1605, 1606, 1609, 1613, 1616, 1618, 1652, 1653, 1661, 1662, 1663, 1664, 1665, 1666, 1668, 1670, 1672, 1673, 1677, 1678, 1679, 1681, 1683, 1684, 1686, 1687, 1688, 1699, 1701, 1702, 1706, 1707, 1710, 1717, 1718, 1723, 1727, 1728, 1730, 1731, 1732, 1733, 1734, 1735, 1736, 1737, 1738, 1739, 1740, 1741, 1742, 1743, 1745, 1746, 1747, 2209, 2212, 2213, 2215, 2222, 2229, 2239, 2243, 2254, 2255, 2256, 2268, 2269, 2271, 2273, 2274, 2281, 2282, 2284, 2285, 2287, 2288, 2289, 2290, 2291, 2366, 2368, 2389, 2390, 2391, 2393, 2394, 2396, 2397, 2452, 2453, 2454, 2461, 2467, 2477, 2487, 2540, 2541, 2542, 2552, 2566, 2567, 2570, 2577, 2578, 2586, 2588, 2589, 2590, 2591, 2602, 2603, 2604, 2606, 2607, 2609, 2610, 2619, 2631, 2637, 2639, 2671, 2675, 2677, 2678, 2680, 2681, 2693, 2694, 2696, 2704, 2711, 2717, 2722, 2723, 2729, 2732, 2738, 2745, 2752, 2760, 2761, 2762, 2800, 2806, 2810, 2827, 2828, 2833, 2851, 2882, 2900, 2902, 2905, 2913, 2915, 2922, 2974, 2998, 2999, 3e3, 3001, 3002, 3003, 3004, 3011, 3012, 3013, 3014, 3015, 3016, 3018, 3019, 3023, 3105, 3118, 3119, 3556, 3560, 3574, 3626, 3654, 3676, 3734, 3756, 3771, 3834, 3885, 3923, 3959, 3984, 4126, 4172, 4223, 4242, 4276, 4291, 4311, 4341, 4372, 4395, 4426, 4456, 4488, 4515, 4590, 4612, 4650, 4660, 4694, 4713, 4739, 4781, 4831, 4857, 4926, 4927, 4929, 4952, 4975, 5011, 5042, 5059, 5116, 5129, 5153, 5182, 5184, 5218, 5234, 5262, 5567, 5576, 5585, 5592, 5609, 5613, 5619, 5658, 5660, 5667, 5674, 5683, 5690, 5691, 5692, 5704, 5707, 5722, 5723, 5732, 5733, 5742, 5751, 5757, 5759, 5760, 5761, 5799, 5800, 5802, 5810, 5817, 5830, 5834, 5836, 5837, 5843, 5850, 5864, 5874, 5879, 5887, 5895, 5901, 5902, 5906, 5908, 5909, 5921, 5993, 5994, 5995, 5996, 5998, 5999, 6002, 6004, 6007, 6011, 6012, 6013, 6019, 6020, 6021, 6023, 6025, 6027, 6028, 6029, 6032, 6034, 6037, 6038, 6040, 6238, 6245, 6246, 6247, 6257, 6262, 6279, 6293, 6302, 6303, 6304, 6308, 6309, 6311, 6313, 6319, 6320, 6323, 6324, 6326, 6327, 6328, 7228, 7231, 7235, 7253, 7262, 7265, 7272, 7273, 7275, 7276, 7277, 7279, 7331, 7332, 7335, 7336, 7454, 7455, 7466, 7482, 7489, 7492, 7501, 7502, 7503, 7518, 7573, 7765, 7767, 7769, 7770, 7772, 7777, 7790, 7805, 7812, 7821, 7824, 7827, 7834, 7842, 7846, 7847, 7848, 7862, 7867, 7876, 7877, 7878, 7882, 7917, 7918, 7939, 7946, 7954, 7955, 7960, 7968, 8012, 8013, 8019, 8022, 8035, 8040, 8041, 8043, 8045, 8082, 8083, 8089, 8096, 8097, 8107, 8116, 8131, 8135, 8137, 8189, 8190, 8195, 8196, 8199, 8201, 8202, 8203, 8212, 8226, 8234, 8248, 8259, 8260, 8262, 8264, 8286, 8297, 8303, 8304, 8316, 8328, 8415, 8427, 8435, 8438, 8444, 8469, 8472, 8473, 8474, 8475, 8477, 8480, 8483, 8494, 8496, 8498, 8526, 8601, 8608, 8612, 8613, 8622, 8644, 8645, 8650, 8651, 8733, 8735, 8736, 8745, 8749, 8755, 8761, 8767, 8777, 8782, 8783, 8801, 8812, 8817, 8822, 8832, 8838, 8842, 8848, 8854, 10461, 10462, 10463, 10470, 10472]);
  var edgeLength = /* @__PURE__ */ new Uint8Array([3, 3, 3, 3, 3, 3, 3, 3, 5, 8, 8, 2, 2, 3, 3, 3, 3, 3, 8, 5, 5, 5, 5, 5, 3, 3, 5, 5, 9, 12, 19, 8, 19, 8, 11, 9, 9, 8, 7, 7, 6, 8, 9, 16, 10, 7, 7, 11, 8, 6, 6, 9, 7, 11, 7, 14, 4, 4, 4, 4, 4, 4, 10, 7, 6, 6, 6, 6, 10, 10, 6, 10, 10, 22, 11, 9, 10, 10, 10, 9, 10, 8, 7, 7, 7, 8, 21, 13, 11, 11, 9, 10, 9, 13, 10, 8, 8, 9, 12, 9, 7, 10, 7, 7, 13, 7, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 6, 3, 3, 3, 3, 3, 3, 2, 5, 3, 3, 3, 7, 2, 2, 2, 2, 2, 2, 3, 3, 3, 1, 1, 7, 8, 5, 2, 2, 7, 4, 5, 7, 2, 2, 1, 4, 1, 11, 9, 9, 5, 5, 8, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 5, 5, 11, 9, 9, 8, 9, 9, 13, 7, 14, 7, 6, 6, 6, 7, 6, 6, 6, 6, 6, 6, 10, 7, 11, 9, 4, 4, 4, 4, 4, 6, 6, 6, 6, 13, 6, 8, 7, 10, 10, 9, 9, 7, 9, 8, 9, 8, 7, 10, 6, 9, 8, 10, 10, 7, 8, 1, 9, 10, 12, 12, 12, 10, 9, 9, 10, 10, 9, 9, 1, 1, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 6, 4, 2, 3, 3, 3, 3, 7, 4, 4, 4, 3, 3, 6, 7, 3, 4, 1, 2, 2, 2, 6, 1, 2, 2, 2, 2, 2, 12, 5, 3, 8, 9, 13, 4, 4, 13, 9, 9, 11, 7, 3, 12, 9, 2, 2, 2, 3, 3, 3, 3, 3, 8, 2, 2, 3, 3, 3, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 7, 10, 15, 15, 7, 15, 20, 15, 9, 10, 10, 12, 14, 14, 14, 12, 12, 12, 12, 12, 14, 14, 10, 10, 10, 10, 14, 9, 9, 9, 9, 10, 14, 14, 14, 13, 13, 14, 9, 9, 9, 9, 9, 9, 7, 8, 6, 8, 8, 6, 8, 13, 8, 8, 6, 13, 8, 11, 13, 8, 6, 13, 8, 6, 9, 10, 10, 12, 14, 14, 14, 12, 12, 12, 12, 14, 14, 10, 10, 10, 10, 9, 9, 9, 10, 14, 14, 11, 13, 13, 9, 9, 9, 9, 9, 9, 2, 6, 9, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 2, 3, 3, 3, 3, 3, 3, 7, 7, 2, 3, 2, 2, 5, 3, 3, 3, 3, 3, 3, 4, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 5, 7, 4, 2, 2, 12, 8, 10, 8, 10, 7, 18, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 2, 2, 3, 3, 3, 5, 5, 3, 8, 8, 6, 8, 6, 6, 4, 6, 7, 7, 7, 10, 11, 2, 5, 5, 3, 3, 3, 3, 3, 3, 5, 5, 6, 11, 10, 7, 7, 7, 4, 4, 4, 2, 3, 3, 3, 3, 3, 2, 2, 7, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 11, 7, 6, 9, 6, 6, 8, 10, 8, 6, 8, 13, 4, 4, 4, 4, 4, 10, 8, 11, 8, 8, 8, 10, 10, 7, 5, 4, 4, 4, 10, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 7, 10, 13, 7, 8, 7, 11, 8, 8, 6, 9, 8, 8, 6, 6, 6, 8, 8, 6, 6, 6, 6, 6, 9, 7, 6, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 9, 7, 8, 10, 8, 8, 2, 3, 3, 3, 3, 3, 2, 8, 9, 9, 2, 2, 2, 3, 3, 3, 2, 3, 3, 3, 9, 2, 2, 3, 3, 3, 3, 3, 3, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 12, 5, 5, 3, 5, 4, 2, 3, 2, 4, 3, 9, 2, 2, 2, 2, 2, 5, 5, 3, 8, 8, 13, 6, 10, 9, 4, 7, 9, 11, 2, 3, 7, 3, 3, 4, 1, 3, 4, 2, 9, 3, 3, 12, 5, 3, 7, 10, 10, 7, 4, 4, 6, 14, 7, 9, 7, 13, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 8, 15, 4, 4, 2, 3, 3, 3, 7, 4, 9, 9, 2, 3, 3, 3, 5, 3, 2, 2, 7, 2, 7, 6, 6, 7, 2, 4, 2, 2, 2, 2, 2, 2, 8, 8, 8, 9, 5, 2, 3, 3, 3, 3, 3, 3, 10, 7, 4, 4, 4, 4, 3, 4, 2, 3, 3, 3, 3, 3, 10, 7, 4, 4, 4, 4, 2, 3, 3, 3, 3, 10, 7, 4, 4, 4, 4, 3, 9, 6, 6, 6, 9, 13, 9, 2, 2, 2, 8, 7, 9, 5, 3, 3, 3, 5, 5, 13, 12, 9, 10, 7, 8, 7, 6, 8, 6, 11, 12, 7, 10, 4, 4, 7, 8, 11, 6, 7, 9, 8, 7, 10, 8, 9, 15, 7, 8, 5, 4, 7, 2, 3, 3, 3, 2, 14, 10, 2, 14, 10, 2, 14, 3, 9, 13, 13, 10, 14, 16, 17, 11, 2, 14, 2, 14, 3, 9, 13, 10, 14, 16, 17, 11, 14, 10, 14, 2, 7, 3, 10, 7, 14, 10, 2, 14, 10, 9, 9, 17, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 10, 10, 10, 12, 9, 4, 10, 10, 11, 8, 8, 8, 7, 9, 5, 3, 3, 3, 3, 3, 3, 3, 3, 5, 8, 4, 4, 4, 4, 4, 4, 6, 16, 3, 3, 14, 3, 14, 2, 14, 9, 13, 10, 10, 14, 16, 17, 11, 6, 9, 10, 10, 12, 14, 14, 14, 12, 12, 12, 12, 14, 14, 10, 10, 10, 10, 14, 9, 9, 9, 10, 14, 14, 14, 9, 9, 9, 9, 9, 9, 2, 14, 9, 13, 10, 10, 14, 16, 17, 11, 6, 14, 2, 14, 9, 17, 13, 10, 10, 14, 17, 16, 17, 11, 6, 2, 14, 9, 13, 10, 14, 17, 16, 17, 11, 2, 14, 9, 13, 10, 14, 16, 17, 11, 2, 14, 9, 13, 10, 17, 16, 11, 17, 2, 14, 10, 19, 7, 2, 14, 9, 13, 10, 19, 10, 7, 14, 17, 16, 17, 11, 6, 2, 14, 9, 13, 10, 19, 7, 14, 16, 17, 11, 2, 14, 9, 13, 10, 10, 14, 17, 16, 17, 11, 6, 2, 14, 9, 13, 10, 10, 14, 17, 16, 17, 11, 6, 2, 14, 9, 13, 17, 13, 10, 10, 14, 17, 16, 17, 11, 6, 3, 2, 14, 9, 13, 10, 10, 14, 16, 17, 11, 6, 9, 10, 12, 14, 14, 14, 12, 12, 12, 12, 12, 14, 14, 14, 10, 10, 10, 14, 9, 9, 9, 9, 14, 14, 14, 13, 13, 14, 9, 9, 9, 9, 9, 9, 4, 11, 2, 14, 9, 13, 17, 13, 10, 19, 10, 7, 14, 17, 16, 17, 11, 6, 2, 14, 9, 13, 17, 13, 10, 19, 10, 7, 14, 17, 16, 17, 11, 6, 2, 14, 9, 13, 10, 19, 7, 14, 17, 16, 17, 11, 2, 9, 10, 10, 7, 17, 3, 3, 12, 12, 16, 15, 15, 12, 14, 14, 14, 20, 20, 13, 12, 12, 12, 12, 12, 12, 20, 25, 14, 14, 12, 12, 10, 10, 10, 10, 14, 9, 9, 9, 25, 4, 9, 17, 10, 7, 14, 16, 21, 13, 13, 14, 20, 14, 13, 17, 24, 9, 12, 13, 25, 13, 21, 20, 17, 9, 9, 9, 9, 9, 9, 12, 17, 4, 4, 9, 9, 9, 10, 10, 12, 14, 14, 14, 12, 12, 12, 12, 12, 14, 14, 10, 10, 10, 10, 14, 9, 9, 9, 9, 10, 14, 14, 14, 13, 13, 14, 9, 9, 9, 9, 9, 9, 9, 10, 14, 12, 12, 14, 14, 10, 9, 9, 9, 10, 14, 14, 14, 9, 9, 9, 9, 2, 1, 5, 8, 7, 11, 11, 1, 3, 3, 3, 5, 3, 3, 4, 8, 9, 10, 10, 12, 14, 14, 14, 12, 12, 12, 12, 14, 14, 10, 10, 10, 10, 14, 9, 9, 9, 10, 14, 14, 14, 13, 13, 14, 9, 9, 9, 9, 9, 9, 7, 4, 4, 4, 4, 4, 4, 4, 4, 4, 10, 2, 2, 6, 7, 6, 2, 3, 2, 3, 6, 2, 7, 6, 10, 7, 4, 9, 12, 6, 14, 4, 12, 7, 2, 2, 1, 2, 7, 6, 4, 4, 4, 6, 8, 8, 7, 2, 2, 13, 2, 2, 2, 2, 6, 2, 8, 12, 2, 7, 7, 6, 8, 10, 12, 2, 2, 2, 3, 3, 13, 2, 2, 3, 3, 6, 7, 6, 4, 5, 6, 3, 3, 3, 3, 4, 16, 8, 5, 4, 3, 3, 3, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 11, 12, 7, 7, 13, 9, 10, 17, 12, 8, 9, 7, 17, 17, 8, 5, 12, 10, 13, 14, 5, 5, 5, 13, 5, 5, 5, 3, 3, 3, 5, 16, 5, 5, 5, 5, 7, 12, 14, 8, 12, 8, 10, 12, 9, 11, 7, 9, 7, 10, 7, 13, 13, 9, 7, 12, 8, 17, 7, 7, 16, 10, 13, 13, 8, 10, 10, 14, 17, 7, 16, 16, 15, 8, 10, 10, 12, 17, 17, 7, 17, 14, 7, 10, 17, 8, 7, 7, 7, 8, 15, 15, 7, 14, 10, 10, 10, 11, 11, 7, 7, 13, 8, 10, 7, 16, 7, 8, 7, 14, 17, 12, 10, 11, 21, 8, 9, 7, 13, 9, 8, 6, 13, 6, 12, 7, 6, 13, 10, 10, 10, 8, 18, 9, 17, 13, 10, 12, 6, 13, 6, 11, 8, 13, 10, 13, 18, 13, 11, 13, 8, 16, 7, 10, 8, 16, 12, 10, 8, 8, 14, 11, 8, 15, 8, 8, 7, 7, 12, 7, 8, 9, 14, 15, 8, 9, 10, 9, 15, 7, 8, 8, 12, 13, 9, 10, 15, 13, 7, 10, 10, 20, 7, 6, 9, 6, 6, 14, 11, 14, 11, 12, 9, 10, 16, 16, 12, 7, 11, 28, 8, 11, 10, 7, 21, 8, 7, 9, 4, 4, 4, 17, 7, 8, 6, 9, 6, 6, 13, 6, 6, 6, 6, 18, 20, 14, 8, 11, 12, 9, 10, 13, 15, 15, 19, 8, 9, 12, 7, 10, 16, 12, 9, 9, 9, 14, 12, 11, 10, 9, 12, 11, 18, 9, 9, 9, 10, 7, 7, 16, 8, 9, 7, 13, 12, 10, 14, 18, 7, 8, 11, 10, 7, 7, 8, 8, 13, 7, 7, 7, 11, 15, 13, 11, 7, 8, 15, 11, 7, 8, 18, 14, 13, 18, 15, 10, 12, 12, 9, 7, 11, 11, 8, 7, 10, 8, 14, 12, 10, 18, 7, 10, 9, 7, 8, 13, 10, 14, 10, 8, 8, 23, 7, 7, 11, 12, 12, 17, 7, 7, 11, 11, 17, 16, 16, 7, 8, 11, 14, 14, 8, 10, 7, 15, 7, 16, 16, 13, 9, 11, 9, 15, 15, 11, 11, 7, 7, 14, 7, 9, 7, 7, 16, 10, 13, 10, 11, 14, 7, 11, 10, 11, 7, 11, 10, 11, 15, 11, 15, 10, 12, 10, 14, 13, 11, 11, 12, 13, 10, 7, 13, 16, 12, 21, 15, 9, 10, 10, 7, 11, 14, 17, 7, 7, 8, 11, 13, 12, 8, 15, 14, 14, 8, 17, 12, 10, 10, 7, 9, 11, 7, 10, 7, 11, 18, 7, 11, 7, 12, 11, 8, 8, 14, 12, 7, 8, 15, 3, 7, 7, 5, 2, 9, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 2, 5, 3, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 3, 5, 11, 6, 4, 7, 10, 7, 7, 11, 1, 10, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 5, 7, 3, 5, 6, 3, 3, 5, 2, 2, 5, 3, 4, 13, 11, 3, 3, 6, 3, 5, 14, 2, 2, 3, 8, 2, 2, 12, 5, 18, 5, 3, 3, 3, 3, 16, 5, 5, 5, 10, 7, 13, 12, 13, 9, 12, 14, 19, 9, 9, 21, 9, 9, 10, 6, 9, 6, 15, 10, 6, 12, 8, 6, 10, 15, 4, 4, 6, 6, 9, 9, 12, 16, 14, 23, 7, 7, 7, 14, 9, 7, 7, 11, 14, 10, 7, 10, 10, 10, 12, 6, 11, 10, 13, 11, 15, 11, 7, 12, 10, 3, 7, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4, 3, 7, 5, 1, 5, 2, 2, 2, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 5, 5, 10, 9, 11, 8, 7, 12, 8, 9, 7, 6, 13, 11, 6, 13, 7, 9, 9, 4, 4, 4, 4, 4, 6, 10, 7, 8, 13, 11, 8, 8, 9, 14, 7, 14, 8, 10, 7, 9, 7, 7, 9, 6, 9, 2, 12, 5, 3, 3, 13, 4, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 2, 2, 5, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 1, 7, 6, 4, 12, 3, 3, 3, 3, 3, 8, 7, 3, 3, 3, 3, 3, 3, 4, 4, 11, 15, 14, 2, 8, 3, 5, 5, 8, 10, 8, 6, 4, 7, 17, 7, 4, 5, 2, 6, 3, 5, 4, 2, 2, 12, 5, 5, 3, 15, 13, 8, 11, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 5, 3, 3, 3, 3, 4, 2, 3, 18, 2, 12, 5, 3, 3, 3, 3, 3, 5, 16, 8, 8, 9, 6, 6, 4, 4, 4, 4, 31, 6, 6, 10, 11, 21, 10, 9, 7, 10, 7, 7, 2, 4, 4, 4, 4, 6, 5, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 4, 6, 2, 2, 2, 5, 3, 3, 3, 7, 7, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 8, 2, 3, 3, 3, 3, 3, 5, 9, 11, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3, 5, 10, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 2, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 11, 10, 10, 10, 10, 10, 11, 10, 11, 10, 11, 10, 9, 9, 11, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3, 5, 5, 3, 7, 8, 8, 7, 6, 6, 11, 4, 4, 4, 4, 7, 8, 9, 9, 2, 3, 7, 4, 4, 2, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 2, 2, 5, 5, 5, 5, 5, 3, 3, 5, 5, 5, 7, 7, 6, 6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 8, 8, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 6, 9, 12, 3, 7, 10, 7, 2, 2, 3, 3, 3, 3, 3, 4, 3, 3, 2, 2, 2, 2, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 8, 8, 6, 6, 8, 6, 7, 4, 4, 4, 4, 4, 4, 6, 7, 5, 5, 20, 19, 8, 10, 9, 7, 10, 6, 8, 11, 6, 6, 6, 6, 13, 12, 8, 6, 7, 14, 11, 9, 2, 5, 3, 6, 2, 3, 2, 2, 2, 2, 2, 2, 2, 5, 4, 3, 7, 6, 4, 7, 4, 3, 6, 4, 7, 2, 2, 7, 7, 7, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 9, 10, 10, 11, 7, 8, 20, 7, 9, 8, 9, 8, 12, 6, 6, 6, 8, 9, 8, 12, 6, 6, 8, 13, 10, 12, 6, 6, 7, 7, 9, 6, 4, 4, 4, 4, 4, 4, 10, 6, 6, 6, 7, 14, 11, 10, 7, 8, 10, 8, 11, 14, 11, 11, 9, 7, 9, 8, 11, 9, 17, 10, 9, 2, 2, 2, 9, 3, 3, 3, 3, 15, 14, 9, 5, 5, 2, 8, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 15, 12, 22, 19, 17, 18, 18, 19, 21, 7, 16, 16, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 7, 16, 11, 11, 7, 7, 7, 7, 17, 7, 8, 12, 15, 9, 19, 7, 19, 8, 21, 11, 12, 19, 14, 22, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 16, 16, 19, 24, 12, 7, 14, 7, 12, 7, 8, 10, 10, 13, 7, 12, 12, 7, 7, 10, 18, 15, 12, 16, 7, 14, 12, 17, 10, 16, 17, 12, 17, 25, 7, 7, 7, 13, 6, 9, 6, 9, 18, 6, 6, 11, 20, 10, 6, 6, 6, 6, 6, 6, 17, 6, 6, 6, 15, 6, 6, 6, 6, 6, 8, 14, 11, 12, 11, 15, 13, 19, 17, 21, 7, 18, 8, 13, 13, 8, 12, 8, 6, 6, 13, 6, 15, 15, 16, 6, 6, 16, 6, 6, 6, 14, 6, 18, 6, 6, 6, 17, 18, 9, 13, 15, 8, 19, 8, 15, 15, 18, 14, 16, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 11, 10, 11, 6, 21, 23, 12, 17, 12, 11, 14, 13, 22, 15, 15, 11, 12, 14, 12, 7, 12, 8, 12, 14, 12, 18, 10, 8, 16, 19, 17, 12, 14, 15, 8, 19, 17, 12, 13, 13, 15, 18, 13, 23, 24, 23, 21, 17, 24, 8, 21, 8, 14, 14, 16, 20, 14, 8, 8, 15, 20, 8, 19, 21, 9, 8, 13, 12, 13, 15, 11, 8, 11, 9, 9, 8, 11, 8, 21, 14, 21, 15, 15, 13, 7, 19, 7, 7, 7, 7, 7, 7, 16, 12, 17, 18, 7, 7, 11, 11, 7, 9, 9, 2, 2, 3, 3, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 10, 10, 7, 9, 7, 7, 7, 6, 8, 6, 6, 6, 6, 6, 6, 6, 7, 6, 8, 6, 6, 9, 7, 7, 7, 4, 4, 4, 4, 4, 4, 4, 4, 8, 9, 8, 7, 8, 7, 8, 10, 7, 5, 5, 5, 5, 5, 5, 3, 9, 7, 7, 8, 6, 6, 6, 6, 6, 6, 6, 6, 9, 6, 6, 9, 11, 13, 7, 8, 9, 9, 5, 5, 5, 7, 8, 6, 6, 6, 6, 6, 6, 6, 7, 8, 9, 7, 10, 9, 10, 7, 8, 5, 5, 5, 5, 5, 5, 7, 7, 9, 8, 7, 7, 6, 6, 6, 6, 6, 6, 10, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 10, 4, 4, 4, 4, 8, 7, 7, 10, 10, 9, 8, 8, 15, 9, 8, 8, 8, 8, 8, 9, 10, 9, 10, 7, 8, 13, 5, 5, 5, 5, 5, 3, 3, 7, 7, 8, 6, 6, 6, 4, 4, 11, 9, 7, 8, 9, 10, 7, 5, 5, 5, 5, 5, 3, 3, 7, 6, 6, 13, 7, 9, 8, 7, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 7, 8, 7, 8, 13, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8, 8, 6, 6, 6, 6, 7, 6, 7, 6, 6, 9, 7, 4, 4, 4, 4, 4, 4, 4, 7, 8, 7, 8, 9, 8, 8, 8, 7, 10, 7, 8, 5, 5, 5, 5, 5, 5, 5, 5, 3, 7, 7, 7, 7, 9, 7, 10, 9, 6, 6, 6, 6, 6, 8, 8, 6, 6, 6, 7, 6, 6, 6, 9, 9, 4, 4, 13, 7, 10, 9, 9, 12, 7, 8, 8, 10, 8, 8, 8, 8, 8, 8, 5, 5, 5, 5, 3, 7, 7, 11, 7, 9, 8, 8, 6, 6, 10, 6, 8, 8, 8, 6, 7, 6, 6, 12, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 8, 8, 16, 8, 9, 8, 7, 5, 5, 5, 5, 5, 3, 3, 7, 7, 7, 10, 15, 8, 9, 8, 9, 9, 6, 6, 6, 6, 6, 6, 7, 4, 8, 7, 8, 8, 7, 8, 11, 8, 5, 5, 5, 5, 5, 3, 7, 7, 6, 11, 16, 7, 6, 4, 4, 4, 4, 9, 9, 8, 8, 8, 13, 12, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 11, 7, 8, 8, 9, 13, 7, 7, 7, 9, 8, 8, 9, 12, 7, 12, 7, 12, 8, 7, 10, 12, 9, 9, 6, 6, 8, 8, 6, 6, 6, 6, 6, 6, 6, 9, 8, 9, 11, 8, 6, 6, 6, 6, 6, 12, 7, 6, 6, 6, 9, 7, 7, 6, 6, 6, 6, 6, 11, 9, 6, 6, 6, 6, 6, 7, 9, 4, 4, 4, 4, 4, 4, 4, 4, 9, 9, 9, 9, 7, 7, 7, 7, 7, 11, 7, 7, 8, 8, 8, 8, 8, 8, 9, 8, 9, 9, 7, 7, 11, 11, 7, 12, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8, 8, 13, 12, 8, 8, 8, 8, 7, 7, 7, 9, 5, 5, 5, 5, 5, 5, 5, 3, 3, 7, 7, 11, 7, 8, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 10, 11, 6, 7, 9, 4, 4, 4, 4, 4, 4, 9, 9, 8, 9, 8, 8, 8, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 11, 7, 7, 7, 9, 6, 6, 11, 8, 10, 6, 6, 6, 12, 8, 8, 7, 6, 6, 8, 7, 4, 4, 4, 4, 4, 4, 4, 4, 9, 10, 9, 9, 8, 10, 9, 11, 8, 5, 5, 5, 7, 6, 6, 8, 7, 4, 4, 4, 4, 8, 7, 7, 8, 7, 8, 8, 5, 5, 5, 5, 7, 7, 8, 8, 8, 6, 6, 6, 6, 6, 10, 8, 9, 13, 6, 7, 6, 6, 8, 7, 8, 4, 4, 4, 4, 11, 8, 8, 8, 10, 5, 5, 8, 7, 8, 13, 8, 7, 6, 8, 6, 9, 7, 8, 7, 5, 5, 5, 5, 5, 5, 3, 3, 7, 8, 9, 6, 4, 8, 10, 10, 8, 12, 9, 13, 2, 7, 5, 5, 5, 5, 5, 7, 7, 10, 6, 6, 6, 6, 6, 6, 6, 8, 4, 4, 9, 8, 8, 8, 14, 8, 8, 8, 9, 8, 5, 5, 5, 5, 5, 3, 3, 9, 6, 6, 6, 6, 10, 12, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4, 4, 11, 8, 7, 8, 8, 8, 5, 5, 3, 3, 3, 3, 7, 7, 6, 8, 6, 8, 11, 7, 6, 6, 6, 7, 4, 8, 11, 9, 10, 5, 5, 5, 3, 3, 3, 7, 7, 8, 9, 8, 15, 9, 6, 6, 6, 6, 6, 6, 11, 11, 4, 4, 4, 4, 4, 7, 9, 9, 10, 8, 7, 5, 5, 5, 5, 5, 5, 3, 3, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 7, 4, 4, 4, 4, 4, 9, 9, 8, 8, 10, 13, 5, 5, 5, 3, 17, 7, 7, 7, 7, 7, 8, 6, 8, 13, 6, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4, 9, 10, 8, 8, 8, 5, 5, 5, 5, 3, 7, 7, 7, 8, 8, 6, 6, 6, 8, 8, 8, 9, 10, 8, 4, 8, 10, 9, 8, 8, 8, 9, 13, 10, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 7, 8, 9, 9, 7, 7, 7, 10, 9, 9, 8, 9, 8, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8, 12, 6, 6, 6, 6, 6, 6, 6, 6, 6, 12, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 11, 8, 8, 9, 9, 10, 8, 9, 7, 7, 5, 5, 5, 5, 5, 5, 3, 7, 8, 7, 6, 6, 8, 6, 6, 10, 4, 7, 8, 9, 12, 8, 7, 7, 5, 5, 5, 5, 5, 5, 3, 3, 7, 14, 7, 9, 8, 8, 6, 6, 8, 12, 12, 6, 6, 7, 7, 10, 4, 4, 4, 4, 4, 9, 9, 14, 9, 13, 8, 7, 5, 5, 5, 6, 6, 6, 7, 4, 8, 7, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 7, 7, 7, 8, 6, 6, 6, 6, 6, 6, 12, 6, 6, 6, 6, 4, 4, 9, 9, 8, 8, 11, 7, 7, 7, 5, 5, 5, 3, 9, 8, 6, 6, 7, 4, 4, 4, 4, 4, 4, 8, 8, 11, 5, 5, 5, 7, 7, 7, 9, 6, 6, 6, 6, 6, 6, 9, 8, 4, 4, 4, 4, 7, 12, 9, 8, 8, 8, 7, 10, 10, 5, 5, 5, 5, 5, 5, 5, 3, 11, 14, 8, 7, 8, 8, 6, 6, 6, 6, 6, 8, 7, 6, 6, 6, 7, 6, 8, 9, 4, 4, 4, 7, 8, 9, 7, 9, 7, 7, 9, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 11, 3, 9, 7, 7, 12, 14, 8, 6, 6, 12, 11, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 15, 7, 4, 4, 4, 16, 9, 9, 9, 8, 9, 9, 9, 9, 9, 8, 8, 8, 13, 11, 8, 5, 5, 5, 5, 3, 7, 6, 6, 8, 8, 8, 6, 6, 7, 10, 7, 4, 4, 4, 4, 9, 7, 8, 7, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 7, 7, 7, 9, 6, 6, 6, 6, 6, 8, 8, 7, 7, 9, 6, 6, 6, 7, 6, 6, 6, 6, 6, 15, 4, 4, 4, 4, 4, 8, 8, 7, 8, 12, 9, 8, 8, 8, 8, 8, 9, 8, 8, 10, 8, 8, 8, 8, 16, 9, 10, 2, 5, 5, 5, 5, 5, 5, 5, 9, 7, 6, 8, 9, 4, 4, 4, 4, 4, 7, 8, 8, 8, 9, 8, 11, 10, 5, 5, 5, 5, 3, 7, 8, 6, 6, 6, 6, 6, 8, 6, 6, 6, 6, 4, 12, 10, 12, 7, 7, 7, 7, 7, 7, 7, 5, 5, 5, 5, 3, 3, 7, 7, 10, 8, 9, 7, 6, 10, 7, 6, 6, 4, 4, 8, 9, 7, 9, 9, 9, 9, 8, 8, 8, 8, 10, 5, 5, 5, 5, 5, 5, 8, 7, 6, 6, 6, 10, 6, 7, 10, 7, 4, 4, 4, 4, 4, 4, 4, 12, 9, 10, 7, 7, 10, 8, 10, 5, 12, 9, 6, 6, 6, 6, 6, 7, 6, 4, 4, 4, 10, 9, 9, 8, 7, 7, 5, 5, 5, 5, 5, 5, 3, 3, 13, 7, 7, 9, 7, 7, 7, 8, 9, 9, 7, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 13, 9, 15, 15, 4, 4, 4, 4, 4, 10, 10, 9, 8, 9, 8, 8, 9, 7, 8, 7, 8, 5, 5, 7, 6, 6, 6, 4, 4, 4, 7, 8, 11, 8, 5, 5, 5, 5, 5, 5, 5, 7, 6, 6, 6, 6, 6, 6, 9, 11, 10, 7, 4, 4, 4, 9, 8, 8, 5, 5, 5, 5, 5, 9, 9, 6, 6, 6, 6, 6, 6, 6, 9, 9, 4, 4, 4, 4, 8, 8, 8, 9, 9, 8, 8, 8, 13, 2, 4, 2, 7, 5, 5, 5, 5, 5, 5, 9, 9, 6, 6, 6, 6, 10, 8, 8, 8, 6, 6, 6, 4, 4, 9, 8, 10, 8, 9, 8, 8, 8, 9, 8, 8, 5, 3, 3, 3, 11, 6, 6, 6, 7, 6, 6, 6, 4, 4, 9, 8, 5, 5, 5, 5, 5, 3, 11, 8, 6, 6, 6, 6, 6, 9, 7, 4, 4, 14, 10, 9, 8, 12, 8, 8, 8, 11, 15, 8, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 11, 11, 11, 10, 10, 7, 7, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 7, 11, 7, 7, 11, 11, 7, 8, 9, 10, 7, 7, 9, 9, 9, 9, 7, 7, 10, 8, 13, 8, 8, 8, 8, 11, 10, 6, 6, 8, 10, 11, 14, 14, 6, 6, 6, 6, 6, 6, 9, 11, 7, 7, 6, 8, 12, 11, 11, 6, 6, 10, 6, 6, 6, 6, 6, 10, 7, 7, 6, 6, 11, 6, 6, 6, 11, 8, 9, 7, 6, 10, 11, 9, 10, 11, 7, 11, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 6, 6, 8, 9, 10, 9, 6, 6, 6, 10, 6, 6, 6, 6, 11, 10, 11, 10, 9, 8, 7, 7, 7, 7, 11, 14, 8, 10, 9, 9, 8, 8, 7, 11, 8, 8, 8, 11, 11, 10, 10, 9, 10, 8, 11, 10, 8, 11, 9, 12, 8, 10, 8, 11, 8, 9, 9, 11, 11, 10, 11, 13, 8, 7, 8, 8, 9, 7, 8, 8, 8, 8, 7, 8, 2, 2, 2, 2, 2, 2, 2, 4, 4, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 3, 3, 3, 3, 3, 3, 3, 3, 8, 6, 4, 4, 4, 11, 7, 11, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 3, 3, 3, 3, 8, 7, 7, 8, 8, 4, 8, 7, 7, 7, 9, 7, 8, 9, 8, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 2, 3, 3, 3, 3, 3, 3, 4, 5, 5, 3, 3, 8, 8, 6, 9, 4, 4, 10, 7, 3, 3, 3, 2, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 2, 2, 2, 3, 3, 3, 3, 3, 4, 10, 2, 3, 3, 3, 3, 3, 3, 3, 4, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3, 5, 2, 4, 2, 6, 2, 2, 9, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 9, 8, 7, 9, 6, 6, 11, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 7, 7, 11, 8, 8, 6, 5, 11, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 2, 3, 3, 3, 3, 3, 3, 6, 4, 4, 4, 4, 3, 3, 3, 3, 5, 7, 2, 3, 3, 3, 3, 3, 8, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 4, 4, 4, 4, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 2, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 6, 3, 3, 8, 10, 3, 4, 4, 1, 1, 1, 1, 1, 1, 1, 8, 9, 10, 7, 7, 1, 14, 18, 13, 18, 13, 10, 10, 16, 13, 18, 16, 13, 16, 18, 13, 22, 16, 16, 16, 14, 21, 16, 9, 14, 16, 9, 9, 14, 10, 10, 14, 12, 14, 19, 12, 11, 18, 13, 17, 15, 15, 15, 15, 16, 14, 13, 19, 18, 15, 19, 18, 12, 18, 12, 11, 20, 14, 15, 10, 17, 17, 16, 19, 20, 21, 15, 13, 16, 15, 15, 15, 1, 1, 3, 8, 7, 7, 8, 8, 8, 1, 6, 1, 1, 6, 3, 3, 4, 7, 3, 3, 5, 5, 4, 4, 4, 4, 4, 2, 7, 7, 8, 12, 3, 4, 5, 1, 3, 4, 4, 10, 4, 3, 3, 3, 8, 7, 7, 2, 2, 2, 2, 2, 2, 2, 2, 2, 12, 9, 20, 7, 5, 5, 5, 9, 13, 5, 5, 5, 5, 5, 3, 3, 3, 16, 5, 5, 5, 13, 7, 8, 8, 11, 8, 7, 9, 7, 11, 12, 9, 9, 8, 8, 11, 10, 14, 7, 12, 10, 11, 13, 7, 9, 11, 17, 17, 14, 13, 7, 8, 7, 10, 10, 7, 16, 13, 7, 8, 17, 12, 9, 8, 6, 7, 10, 6, 6, 12, 6, 8, 10, 8, 8, 8, 6, 8, 6, 14, 6, 6, 6, 13, 6, 10, 6, 6, 7, 14, 8, 6, 6, 10, 11, 10, 9, 9, 7, 7, 6, 6, 6, 9, 9, 7, 9, 10, 9, 13, 12, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 6, 6, 8, 8, 6, 8, 9, 10, 9, 7, 10, 10, 8, 7, 8, 7, 10, 12, 9, 8, 15, 8, 7, 8, 8, 7, 7, 15, 13, 7, 10, 9, 14, 18, 16, 7, 24, 7, 8, 10, 11, 16, 8, 14, 7, 9, 9, 9, 13, 19, 14, 15, 14, 11, 7, 13, 9, 10, 7, 13, 9, 10, 11, 12, 8, 9, 2, 3, 5, 8, 7, 4, 4, 15, 10, 5, 3, 3, 3, 3, 3, 5, 4, 4, 4, 2, 2, 2, 2, 2, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 2, 12, 5, 3, 8, 10, 15, 6, 7, 2, 3, 2, 5, 5, 12, 2, 5, 5, 5, 5, 2, 2, 5, 5, 12, 9, 5, 2, 2, 9, 5, 5, 12, 12, 5, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 9, 12, 5, 8, 8, 9, 5, 5, 5, 8, 19, 7, 16, 15, 14, 9, 9, 9, 9, 7, 11, 11, 11, 7, 14, 10, 10, 5, 5, 5, 5, 5, 5, 5, 5, 5, 15, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9, 9, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 14, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 15, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 12, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9, 9, 12, 9, 9, 12, 12, 12, 15, 7, 11, 7, 14, 11, 18, 13, 8, 18, 15, 18, 12, 14, 12, 8, 8, 8, 8, 9, 9, 9, 12, 7, 10, 10, 8, 8, 12, 12, 12, 7, 12, 12, 9, 7, 7, 7, 7, 7, 8, 15, 12, 9, 10, 10, 7, 10, 10, 13, 11, 10, 9, 22, 11, 9, 8, 8, 8, 8, 8, 13, 18, 13, 9, 15, 19, 9, 7, 7, 10, 7, 7, 7, 11, 8, 13, 17, 7, 7, 10, 10, 10, 7, 20, 16, 7, 7, 7, 7, 7, 7, 11, 21, 12, 12, 13, 11, 14, 16, 8, 8, 13, 11, 7, 7, 13, 7, 7, 14, 15, 15, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 13, 10, 18, 6, 6, 6, 6, 6, 6, 6, 6, 6, 11, 8, 8, 12, 12, 11, 11, 8, 12, 9, 9, 9, 13, 13, 9, 9, 9, 9, 9, 9, 6, 10, 12, 6, 6, 6, 6, 17, 11, 7, 7, 7, 7, 14, 14, 12, 6, 7, 7, 6, 6, 15, 10, 13, 10, 6, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 13, 9, 9, 15, 13, 6, 12, 12, 6, 19, 11, 10, 7, 7, 16, 8, 19, 17, 9, 9, 9, 9, 9, 6, 6, 6, 10, 8, 16, 8, 6, 6, 9, 6, 6, 6, 6, 6, 6, 6, 6, 8, 8, 8, 6, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 14, 6, 6, 6, 6, 20, 6, 9, 6, 14, 9, 9, 9, 6, 9, 8, 8, 12, 9, 8, 8, 8, 8, 7, 8, 12, 7, 8, 8, 8, 6, 8, 6, 6, 6, 6, 6, 6, 6, 9, 8, 8, 6, 6, 13, 9, 12, 13, 12, 14, 13, 12, 11, 11, 6, 8, 8, 8, 6, 13, 12, 11, 11, 12, 6, 11, 12, 11, 13, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 15, 6, 6, 6, 6, 6, 6, 6, 13, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8, 8, 8, 8, 6, 18, 6, 12, 13, 13, 13, 9, 10, 15, 9, 12, 6, 6, 6, 6, 6, 6, 6, 6, 9, 15, 10, 9, 10, 13, 9, 19, 8, 18, 17, 10, 10, 8, 8, 6, 6, 6, 6, 6, 6, 10, 14, 8, 16, 16, 9, 8, 15, 8, 8, 10, 12, 14, 7, 7, 8, 8, 7, 7, 7, 7, 8, 13, 13, 11, 9, 9, 9, 12, 10, 17, 8, 11, 9, 7, 7, 14, 8, 14, 14, 7, 7, 7, 7, 7, 7, 14, 7, 7, 7, 7, 7, 10, 10, 8, 14, 7, 7, 7, 7, 8, 8, 8, 8, 8, 17, 9, 7, 15, 7, 8, 12, 7, 9, 14, 7, 7, 7, 9, 13, 8, 14, 7, 16, 18, 13, 15, 14, 12, 13, 10, 15, 9, 7, 7, 7, 10, 13, 15, 15, 9, 9, 9, 9, 19, 11, 7, 11, 11, 13, 8, 8, 8, 8, 7, 12, 19, 17, 9, 9, 13, 7, 7, 7, 9, 7, 7, 7, 12, 13, 15, 10, 8, 8, 14, 15, 12, 13, 13, 8, 12, 14, 7, 11, 7, 14, 15, 13, 12, 8, 8, 8, 8, 11, 13, 15, 15, 8, 13, 12, 8, 8, 8, 13, 10, 16, 14, 11, 8, 8, 12, 12, 9, 15, 15, 12, 12, 13, 8, 8, 9, 12, 13, 9, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 11, 12, 11, 7, 14, 7, 13, 13, 13, 12, 18, 16, 7, 12, 11, 10, 10, 15, 9, 9, 9, 21, 7, 7, 7, 11, 16, 8, 8, 11, 11, 7, 7, 7, 7, 7, 19, 7, 7, 7, 7, 7, 7, 7, 7, 7, 12, 8, 9, 12, 14, 11, 9, 9, 9, 22, 12, 3, 3, 4, 8, 8, 15, 4, 2, 2, 5, 5, 3, 3, 3, 3, 3, 3, 6, 6, 4, 4, 4, 12, 7, 10, 2, 3, 3, 3, 3, 3, 3, 3, 6, 7, 3, 7, 5, 14, 4, 4, 7, 8, 10, 4, 1, 3, 3, 6, 2, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 2, 2, 5, 3, 4, 2, 2, 2, 2, 2, 2, 2, 11, 5, 5, 5, 11, 5, 5, 3, 5, 5, 5, 5, 11, 14, 13, 9, 11, 9, 12, 8, 11, 11, 8, 11, 16, 9, 9, 7, 10, 9, 12, 8, 15, 6, 7, 6, 6, 13, 10, 8, 11, 8, 6, 6, 6, 12, 16, 6, 11, 7, 8, 9, 18, 6, 6, 9, 4, 4, 6, 13, 6, 6, 6, 6, 8, 8, 9, 16, 7, 7, 14, 7, 8, 8, 8, 7, 7, 7, 7, 7, 7, 15, 13, 7, 10, 7, 7, 10, 12, 16, 15, 7, 9, 9, 14, 11, 11, 10, 9, 10, 8, 12, 7, 8, 7, 7, 10, 12, 7, 12, 8, 7, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 5, 5, 5, 10, 7, 4, 4, 4, 8, 7, 10, 9, 7, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 3, 7, 4, 5, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 9, 8, 2, 2, 2, 8, 12, 7, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 7, 11, 9, 8, 8, 8, 7, 8, 9, 7, 7, 9, 7, 7, 7, 10, 7, 7, 10, 9, 10, 6, 6, 6, 6, 6, 6, 15, 7, 8, 9, 9, 8, 6, 6, 10, 9, 6, 8, 13, 9, 7, 6, 6, 6, 6, 6, 6, 12, 6, 6, 7, 6, 7, 6, 6, 6, 10, 10, 7, 6, 6, 6, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 6, 14, 6, 6, 7, 7, 9, 6, 6, 6, 6, 9, 9, 8, 9, 10, 9, 8, 9, 12, 7, 7, 7, 8, 7, 10, 12, 11, 9, 10, 7, 7, 7, 9, 10, 10, 8, 12, 9, 7, 7, 9, 8, 8, 8, 10, 7, 7, 8, 9, 9, 7, 7, 7, 8, 2, 4, 2, 4, 6, 3, 4, 2, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 5, 8, 6, 4, 7, 3, 3, 3, 3, 3, 3, 3, 12, 3, 3, 3, 3, 3, 3, 4, 4, 2, 3, 5, 3, 4, 7, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 6, 4, 3, 4, 2, 2, 2, 5, 3, 3, 3, 3, 3, 5, 4, 4, 4, 4, 2, 7, 6, 8, 9, 2, 2, 2, 2, 3, 3, 3, 5, 7, 2, 3, 3, 8, 7, 7, 2, 2, 8, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 8, 8, 7, 7, 6, 10, 6, 9, 7, 11, 4, 6, 8, 8, 7, 8, 4, 2, 5, 5, 5, 5, 3, 3, 3, 11, 8, 9, 6, 6, 8, 7, 4, 4, 7, 6, 8, 7, 2, 2, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 3, 7, 2, 2, 5, 3, 3, 2, 3, 3, 3, 3, 3, 3, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 12, 5, 5, 3, 3, 3, 5, 10, 12, 6, 15, 4, 6, 6, 7, 14, 9, 3, 3, 3, 3, 3, 8, 2, 2, 3, 5, 5, 3, 3, 3, 3, 3, 3, 8, 8, 6, 8, 7, 5, 8, 4, 6, 11, 2, 2, 7, 3, 3, 2, 9, 8, 5, 5, 3, 3, 3, 5, 5, 7, 7, 6, 6, 10, 6, 8, 6, 8, 9, 7, 4, 4, 4, 4, 7, 6, 6, 8, 7, 7, 10, 9, 9, 8, 11, 8, 3, 3, 3, 3, 3, 4, 4, 2, 3, 3, 3, 3, 3, 7, 6, 2, 5, 5, 6, 7, 6, 4, 8, 9, 11, 2, 2, 3, 3, 3, 3, 3, 3, 3, 2, 2, 5, 3, 3, 3, 3, 3, 9, 9, 6, 4, 8, 7, 7, 5, 9, 8, 6, 2, 6, 8, 7, 8, 5, 5, 5, 5, 5, 3, 3, 3, 16, 8, 7, 7, 7, 8, 7, 7, 7, 7, 9, 6, 9, 6, 10, 7, 7, 7, 6, 10, 8, 9, 11, 11, 8, 4, 4, 10, 8, 8, 6, 9, 6, 11, 8, 8, 8, 15, 7, 8, 9, 5, 3, 3, 3, 3, 3, 5, 2, 2, 3, 8, 9, 10, 3, 2, 2, 2, 2, 2, 2, 3, 6, 4, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 2, 3, 3, 3, 3, 3, 3, 3, 11, 5, 3, 3, 3, 3, 3, 3, 3, 3, 6, 7, 4, 4, 2, 3, 3, 3, 3, 3, 3, 3, 12, 7, 4, 12, 4, 6, 5, 4, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 11, 10, 6, 4, 6, 10, 8, 3, 3, 3, 3, 3, 3, 3, 3, 5, 4, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 5, 3, 4, 4, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10, 5, 5, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 7, 8, 8, 7, 13, 12, 10, 10, 8, 8, 7, 7, 9, 12, 11, 6, 6, 8, 8, 9, 7, 7, 7, 10, 15, 10, 4, 4, 4, 4, 4, 11, 8, 8, 9, 7, 9, 14, 14, 12, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 12, 5, 5, 5, 11, 10, 7, 9, 3, 8, 7, 3, 15, 13, 11, 4, 4, 2, 2, 2, 19, 7, 5, 5, 3, 3, 3, 3, 3, 3, 3, 5, 22, 18, 6, 14, 17, 4, 4, 19, 16, 18, 2, 3, 3, 7, 2, 3, 2, 3, 3, 6, 4, 2, 3, 3, 2, 5, 3, 3, 3, 3, 3, 3, 3, 9, 9, 2, 3, 2, 2, 2, 3, 3, 3, 5, 7, 14, 7, 7, 12, 9, 13, 6, 11, 6, 10, 9, 7, 7, 8, 12, 12, 8, 8, 8, 10, 7, 7, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 5, 8, 10, 7, 8, 11, 8, 12, 9, 4, 14, 7, 7, 9, 13, 2, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 1, 2, 2, 3, 3, 3, 3, 3, 3, 5, 2, 2, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 4, 4, 4, 3, 2, 3, 3, 3, 3, 5, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 12, 9, 8, 8, 9, 8, 6, 17, 6, 6, 6, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 4, 4, 8, 8, 9, 9, 9, 7, 7, 7, 7, 7, 7, 7, 9, 9, 9, 7, 8, 8, 8, 10, 7, 13, 10, 8, 9, 3, 3, 5, 3, 3, 3, 3, 3, 7, 7, 6, 6, 10, 13, 11, 11, 8, 8, 9, 8, 9, 9, 10, 10, 10, 11, 10, 10, 13, 13, 16, 15, 11, 12, 9, 9, 10, 9, 11, 10, 9, 9, 14, 7, 8, 3, 10, 7, 7, 3, 2, 2, 2, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 7, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 11, 6, 7, 4, 6, 2, 2, 3, 3, 3, 1, 3, 3, 3, 3, 3, 3, 6, 4, 4, 2, 2, 2, 3, 3, 3, 3, 4, 4, 6, 6, 6, 6, 5, 4, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 9, 11, 6, 10, 9, 12, 7, 7, 11, 14, 9, 7, 12, 3, 3, 7, 12, 11, 12, 7, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 9, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 11, 5, 5, 5, 5, 5, 5, 5, 5, 11, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 10, 3, 3, 3, 11, 3, 5, 9, 11, 8, 12, 14, 9, 7, 8, 7, 7, 11, 11, 7, 7, 10, 9, 8, 10, 9, 7, 7, 7, 7, 7, 7, 8, 8, 7, 11, 8, 8, 8, 7, 7, 10, 8, 7, 13, 12, 7, 17, 10, 8, 8, 11, 7, 11, 11, 14, 7, 11, 7, 8, 6, 9, 20, 8, 7, 9, 16, 7, 10, 6, 11, 10, 8, 9, 7, 16, 11, 11, 9, 8, 9, 8, 8, 8, 11, 8, 15, 8, 8, 9, 7, 8, 8, 11, 10, 7, 5, 7, 10, 10, 15, 7, 7, 7, 8, 7, 8, 8, 10, 11, 10, 10, 10, 11, 11, 7, 8, 6, 8, 8, 10, 6, 8, 6, 6, 7, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 16, 6, 15, 6, 7, 11, 11, 7, 9, 10, 11, 13, 10, 6, 16, 8, 10, 12, 11, 6, 6, 6, 6, 6, 6, 6, 10, 6, 10, 7, 7, 7, 11, 7, 11, 6, 6, 6, 6, 6, 6, 17, 7, 7, 6, 6, 12, 22, 6, 6, 6, 6, 6, 8, 6, 6, 6, 6, 7, 6, 6, 5, 6, 6, 8, 11, 6, 9, 14, 11, 9, 11, 7, 7, 8, 6, 6, 6, 8, 10, 9, 6, 6, 6, 6, 9, 7, 6, 6, 6, 6, 6, 15, 6, 4, 4, 4, 6, 4, 17, 8, 11, 6, 6, 9, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 6, 6, 6, 6, 10, 6, 10, 6, 6, 6, 6, 12, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 9, 6, 6, 6, 6, 18, 6, 6, 6, 8, 9, 10, 7, 8, 9, 10, 11, 7, 13, 6, 8, 8, 6, 6, 14, 7, 7, 7, 7, 10, 7, 14, 9, 6, 6, 9, 15, 9, 7, 14, 6, 11, 14, 13, 7, 12, 8, 7, 7, 7, 7, 7, 12, 7, 10, 9, 16, 6, 8, 6, 5, 17, 6, 8, 10, 4, 6, 4, 10, 15, 17, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 4, 4, 11, 7, 4, 4, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 19, 17, 6, 10, 11, 6, 6, 6, 6, 18, 6, 6, 11, 4, 4, 4, 5, 6, 6, 6, 9, 5, 6, 4, 6, 6, 4, 6, 6, 6, 6, 10, 6, 6, 4, 6, 6, 10, 6, 10, 6, 6, 6, 6, 11, 6, 6, 10, 6, 6, 8, 6, 6, 6, 8, 6, 11, 4, 11, 9, 10, 9, 11, 4, 8, 4, 11, 12, 7, 9, 8, 6, 7, 7, 8, 12, 12, 11, 13, 10, 11, 7, 7, 7, 9, 7, 11, 10, 7, 7, 7, 16, 11, 10, 11, 17, 9, 9, 8, 8, 7, 7, 7, 9, 7, 7, 7, 14, 7, 13, 9, 11, 10, 14, 10, 10, 12, 11, 10, 7, 10, 5, 14, 8, 8, 8, 9, 7, 8, 7, 7, 9, 8, 7, 8, 7, 7, 7, 7, 7, 7, 7, 11, 8, 10, 8, 7, 8, 14, 11, 8, 9, 9, 9, 8, 24, 10, 10, 12, 7, 7, 15, 11, 8, 8, 12, 11, 8, 9, 9, 7, 8, 9, 10, 11, 10, 11, 7, 12, 7, 7, 11, 9, 8, 14, 13, 12, 8, 11, 10, 8, 8, 7, 7, 14, 9, 10, 8, 9, 11, 7, 14, 8, 8, 13, 8, 8, 12, 7, 10, 14, 14, 11, 9, 10, 9, 9, 7, 7, 11, 11, 13, 9, 13, 5, 5, 5, 7, 9, 5, 11, 12, 14, 8, 7, 7, 11, 10, 9, 7, 8, 8, 7, 10, 11, 11, 5, 5, 7, 5, 5, 5, 7, 7, 15, 7, 7, 8, 7, 15, 12, 12, 10, 7, 8, 7, 11, 7, 7, 7, 23, 11, 8, 8, 11, 10, 7, 8, 11, 7, 19, 7, 7, 6, 9, 9, 9, 11, 3, 4, 7, 8, 6, 6, 4, 10, 8, 2, 2]);
  var edgeChild = /* @__PURE__ */ new Uint16Array([0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 12, 1, 1, 1, 1, 1, 17, 1, 1, 1, 1, 1, 1, 12, 1, 12, 1, 12, 13, 1, 1, 1, 1, 12, 1, 12, 1, 1, 1, 1, 1, 14, 23, 1, 1, 1, 1, 1, 1, 20, 1, 1, 1, 1, 21, 12, 1, 1, 1, 1, 1, 1, 1, 1, 22, 1, 1, 1, 16, 18, 1, 1, 15, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 24, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 19, 1, 1, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 1, 26, 27, 28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 12, 12, 12, 12, 1, 35, 0, 0, 0, 1, 1, 1, 1, 38, 37, 1, 1, 1, 1, 1, 36, 1, 1, 1, 1, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 42, 43, 0, 0, 0, 0, 12, 1, 1, 1, 12, 1, 1, 1, 46, 48, 48, 48, 46, 48, 46, 46, 47, 48, 46, 48, 46, 46, 46, 46, 46, 46, 48, 46, 46, 47, 46, 46, 46, 46, 48, 49, 49, 47, 48, 46, 46, 46, 46, 46, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 52, 54, 52, 52, 52, 54, 52, 53, 52, 55, 52, 53, 53, 52, 52, 52, 53, 55, 53, 55, 52, 53, 53, 12, 57, 57, 56, 58, 53, 55, 52, 52, 50, 51, 59, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 62, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 69, 70, 12, 1, 1, 68, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, 79, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 84, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 82, 85, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 83, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 12, 1, 1, 1, 1, 95, 1, 97, 1, 1, 1, 1, 1, 1, 1, 1, 100, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 103, 103, 1, 1, 12, 1, 106, 1, 1, 1, 1, 1, 1, 1, 104, 1, 105, 1, 107, 1, 1, 1, 1, 1, 108, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 116, 117, 1, 1, 1, 1, 1, 1, 119, 119, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 127, 128, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 128, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 128, 1, 1, 1, 1, 1, 1, 1, 1, 1, 132, 129, 131, 126, 1, 130, 1, 1, 120, 1, 1, 1, 1, 123, 1, 133, 1, 1, 1, 1, 1, 1, 125, 1, 114, 1, 115, 1, 12, 134, 112, 118, 1, 1, 1, 1, 1, 113, 121, 1, 12, 12, 12, 124, 122, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 12, 12, 1, 1, 1, 1, 1, 12, 140, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 142, 1, 1, 1, 1, 1, 1, 1, 1, 143, 144, 12, 12, 141, 139, 48, 48, 146, 52, 52, 145, 148, 147, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 151, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 149, 0, 0, 0, 0, 1, 0, 150, 138, 1, 0, 1, 1, 12, 12, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 154, 153, 22, 1, 1, 12, 12, 1, 22, 12, 12, 1, 1, 1, 1, 1, 140, 1, 1, 158, 1, 1, 1, 1, 159, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 1, 1, 142, 1, 1, 158, 1, 1, 1, 1, 159, 1, 1, 1, 140, 1, 1, 1, 158, 1, 163, 1, 1, 1, 159, 1, 1, 140, 1, 1, 1, 163, 1, 1, 1, 1, 1, 140, 1, 1, 1, 1, 1, 1, 1, 1, 140, 1, 1, 163, 1, 1, 163, 1, 1, 1, 1, 1, 1, 1, 169, 1, 1, 1, 158, 1, 1, 163, 1, 1, 1, 159, 1, 1, 169, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 142, 1, 1, 158, 1, 163, 1, 1, 1, 159, 1, 1, 140, 1, 1, 158, 1, 163, 1, 1, 1, 159, 1, 1, 140, 1, 1, 1, 1, 158, 1, 163, 1, 1, 1, 159, 1, 1, 1, 140, 1, 1, 158, 1, 1, 1, 1, 175, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 1, 178, 1, 1, 169, 1, 1, 1, 1, 1, 158, 1, 1, 163, 1, 1, 1, 159, 1, 1, 169, 1, 1, 1, 1, 1, 158, 1, 1, 163, 1, 1, 1, 159, 1, 1, 169, 1, 1, 1, 1, 1, 163, 1, 1, 1, 1, 173, 165, 165, 12, 1, 12, 177, 1, 1, 1, 1, 1, 166, 166, 166, 160, 1, 1, 1, 164, 166, 170, 176, 1, 1, 1, 1, 164, 164, 1, 1, 162, 160, 173, 164, 168, 181, 172, 181, 1, 1, 179, 1, 172, 161, 164, 1, 1, 1, 1, 164, 1, 167, 1, 1, 1, 12, 1, 182, 1, 171, 1, 1, 1, 171, 170, 174, 180, 162, 173, 1, 1, 1, 1, 1, 1, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 184, 185, 184, 184, 185, 184, 184, 184, 184, 186, 186, 184, 184, 185, 184, 185, 184, 184, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 188, 12, 1, 12, 12, 12, 12, 1, 12, 12, 12, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 201, 1, 203, 204, 202, 201, 201, 1, 1, 207, 1, 208, 206, 1, 12, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 219, 201, 201, 201, 201, 219, 1, 1, 1, 1, 222, 223, 221, 1, 1, 1, 1, 1, 1, 225, 225, 1, 1, 1, 225, 225, 227, 228, 226, 1, 230, 1, 1, 1, 1, 12, 236, 237, 238, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 205, 209, 1, 1, 1, 1, 157, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 233, 1, 1, 1, 200, 1, 1, 1, 1, 244, 1, 1, 241, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 191, 216, 1, 1, 1, 212, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 198, 1, 1, 1, 1, 1, 1, 1, 217, 1, 1, 1, 1, 232, 1, 1, 1, 1, 183, 1, 220, 1, 215, 1, 1, 1, 218, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 196, 1, 12, 1, 1, 12, 1, 1, 1, 1, 199, 1, 1, 1, 214, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 245, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 231, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 190, 12, 1, 1, 1, 193, 12, 1, 1, 1, 1, 1, 1, 1, 235, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 192, 1, 1, 1, 1, 1, 1, 1, 240, 1, 1, 1, 197, 1, 1, 1, 213, 1, 12, 1, 229, 210, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 217, 1, 1, 1, 1, 195, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 187, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 211, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 242, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 243, 1, 1, 12, 1, 1, 1, 1, 194, 1, 1, 1, 211, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 234, 1, 1, 1, 189, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 224, 1, 1, 1, 12, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 239, 1, 1, 12, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 255, 0, 0, 0, 0, 0, 256, 0, 0, 0, 0, 0, 0, 1, 12, 1, 1, 1, 260, 1, 1, 1, 0, 261, 258, 259, 1, 1, 1, 1, 1, 1, 266, 1, 268, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 264, 1, 1, 1, 1, 1, 270, 1, 1, 12, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 269, 1, 1, 1, 12, 1, 1, 1, 1, 265, 1, 1, 1, 263, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 267, 1, 1, 1, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 1, 12, 1, 1, 1, 1, 12, 1, 1, 276, 1, 13, 1, 1, 1, 12, 12, 273, 274, 1, 1, 1, 1, 275, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 278, 1, 1, 12, 16, 1, 1, 1, 1, 1, 1, 279, 1, 1, 1, 277, 12, 12, 1, 1, 1, 1, 1, 1, 1, 1, 279, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 288, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 292, 292, 1, 0, 0, 0, 0, 0, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 184, 1, 297, 298, 1, 12, 1, 1, 1, 1, 12, 300, 1, 1, 299, 1, 1, 302, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 307, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 12, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 12, 0, 319, 0, 0, 320, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 336, 1, 1, 1, 1, 1, 1, 0, 0, 62, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 344, 0, 0, 0, 0, 0, 0, 0, 0, 0, 346, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 362, 362, 363, 362, 0, 1, 211, 1, 1, 13, 358, 1, 356, 0, 0, 0, 0, 0, 0, 0, 359, 1, 1, 364, 1, 241, 1, 1, 1, 1, 357, 1, 1, 354, 1, 360, 1, 352, 1, 361, 1, 353, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 12, 355, 355, 1, 1, 1, 200, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 12, 1, 1, 1, 1, 351, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 367, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 302, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 407, 407, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 399, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 375, 386, 1, 1, 374, 409, 1, 380, 1, 1, 372, 404, 1, 1, 390, 371, 376, 1, 1, 1, 383, 414, 392, 1, 1, 1, 1, 1, 1, 393, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 402, 406, 0, 0, 85, 1, 1, 0, 400, 377, 413, 378, 381, 388, 1, 403, 0, 1, 0, 85, 397, 395, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 416, 1, 1, 387, 1, 85, 1, 0, 1, 1, 1, 419, 1, 0, 0, 85, 394, 0, 1, 373, 1, 1, 1, 0, 1, 1, 396, 1, 0, 1, 1, 1, 0, 1, 421, 384, 1, 1, 0, 1, 0, 0, 412, 0, 1, 1, 1, 85, 405, 1, 1, 401, 398, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 379, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 411, 0, 85, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 415, 1, 1, 1, 0, 0, 418, 0, 0, 0, 1, 391, 1, 0, 85, 417, 1, 0, 0, 0, 0, 420, 1, 1, 0, 0, 1, 0, 1, 0, 389, 0, 385, 0, 1, 1, 1, 0, 1, 1, 0, 408, 382, 410, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 12, 1, 1, 1, 12, 436, 436, 1, 1, 12, 12, 1, 436, 1, 1, 12, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 448, 1, 1, 0, 1, 1, 1, 1, 241, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 466, 466, 1, 1, 0, 0, 352, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 479, 1, 478, 1, 1, 1, 1, 1, 1, 1, 1, 1, 483, 1, 12, 12, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 491, 1, 1, 1, 493, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 490, 1, 485, 1, 1, 1, 1, 472, 1, 1, 1, 1, 1, 1, 1, 1, 486, 12, 1, 1, 1, 1, 492, 1, 1, 1, 487, 481, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 352, 1, 469, 1, 1, 12, 489, 1, 1, 352, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 474, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 492, 1, 1, 1, 1, 352, 1, 488, 1, 1, 1, 482, 476, 1, 1, 1, 1, 1, 477, 1, 494, 480, 1, 1, 1, 1, 1, 475, 1, 1, 1, 1, 1, 1, 1, 1, 1, 470, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 484, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 473, 1, 1, 1, 1, 1, 471, 1, 255, 495, 1, 1, 1, 1, 1, 12, 1, 1, 1, 1, 12, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 501, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 12, 1, 70, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 505, 0, 505, 505, 505, 505, 505, 505, 505, 0, 505, 505, 505, 505, 505, 1, 505, 505, 505, 0, 505, 505, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 510, 509, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 514, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 507, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 508, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 516, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 505, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 513, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 506, 0, 0, 517, 512, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 511, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 505, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 506, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 505, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 515, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 527, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 235, 235, 1, 531, 1, 1, 1, 530, 1, 1, 1, 1, 1, 526, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 528, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 532, 1, 1, 529, 1, 1, 1, 1, 1, 1, 1, 1, 407, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 533, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 544, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 12, 1, 547, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 62, 1, 1, 12, 12, 12, 12, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 566, 1, 1, 1, 1, 1, 1, 1, 567, 1, 1, 1, 1, 1, 1, 1, 565, 1, 1, 1, 12, 1, 1, 569, 274, 1, 1, 1, 12, 12, 1, 1, 12, 1, 12, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 573, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 579, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 138, 1, 12, 584, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 113, 1, 1, 1, 12, 1, 1, 1, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 589, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 150, 1, 1, 1, 263, 1, 1, 12, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 614, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 255, 1, 363, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 619, 1, 1, 1, 1, 0, 621, 0, 85, 0, 620, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 12, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 628, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 623, 623, 0, 627, 625, 623, 623, 623, 623, 623, 629, 623, 623, 633, 623, 623, 623, 623, 623, 623, 623, 623, 623, 623, 630, 627, 623, 623, 627, 623, 623, 623, 623, 623, 623, 623, 623, 623, 623, 623, 623, 623, 625, 623, 623, 623, 623, 623, 631, 623, 623, 623, 623, 623, 623, 0, 0, 0, 1, 632, 1, 1, 1, 1, 626, 1, 1, 1, 1, 1, 624, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 12, 637, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 12, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 12, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 12, 1, 1, 12, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 102, 67, 316, 342, 447, 575, 0, 4, 71, 271, 290, 318, 343, 369, 423, 449, 0, 538, 559, 576, 639, 9, 0, 63, 94, 433, 445, 465, 617, 0, 536, 558, 572, 654, 0, 33, 6, 0, 500, 539, 644, 602, 73, 0, 7, 321, 291, 424, 502, 452, 578, 85, 640, 0, 618, 345, 454, 504, 9, 111, 324, 545, 6, 33, 0, 347, 85, 426, 85, 522, 10, 6, 137, 284, 310, 0, 655, 549, 0, 605, 0, 66, 6, 6, 287, 101, 2, 468, 434, 446, 638, 0, 6, 0, 6, 322, 109, 6, 603, 540, 580, 0, 503, 425, 308, 323, 8, 74, 110, 641, 583, 427, 348, 335, 455, 152, 77, 326, 587, 550, 643, 606, 370, 365, 518, 6, 78, 155, 11, 311, 285, 562, 588, 607, 554, 592, 612, 653, 39, 6, 296, 330, 368, 340, 253, 33, 568, 595, 253, 44, 251, 301, 331, 341, 442, 459, 520, 309, 0, 76, 604, 0, 439, 453, 334, 85, 283, 85, 0, 622, 586, 543, 328, 457, 85, 428, 422, 0, 0, 0, 9, 597, 613, 252, 0, 460, 443, 571, 556, 615, 657, 91, 253, 45, 332, 431, 461, 611, 0, 551, 329, 312, 85, 250, 86, 30, 425, 33, 6, 429, 366, 339, 646, 634, 564, 591, 553, 0, 294, 87, 33, 441, 458, 0, 33, 462, 0, 254, 635, 557, 9, 444, 463, 253, 284, 92, 257, 636, 616, 599, 521, 464, 432, 286, 262, 93, 61, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 662, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 450, 0, 0, 0, 0, 0, 0, 0, 0, 88, 0, 135, 0, 0, 546, 590, 0, 0, 0, 0, 0, 0, 0, 29, 0, 593, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 450, 0, 0, 0, 0, 542, 0, 293, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 282, 0, 0, 0, 0, 0, 0, 0, 659, 0, 0, 0, 0, 0, 658, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 430, 0, 0, 0, 523, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 534, 0, 0, 0, 0, 0, 0, 440, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 246, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 555, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 535, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 305, 317, 0, 0, 0, 0, 0, 570, 313, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 552, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 496, 0, 0, 0, 350, 0, 0, 0, 0, 80, 0, 289, 0, 0, 0, 0, 0, 0, 25, 0, 0, 0, 0, 610, 0, 0, 0, 0, 642, 561, 0, 0, 0, 0, 280, 0, 0, 0, 0, 0, 0, 498, 0, 0, 519, 0, 0, 0, 0, 0, 64, 0, 0, 0, 303, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 81, 0, 0, 0, 0, 0, 0, 0, 282, 0, 0, 0, 0, 0, 315, 652, 0, 75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 661, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 156, 0, 314, 0, 0, 0, 0, 0, 0, 609, 0, 0, 0, 0, 0, 0, 563, 0, 0, 0, 0, 0, 0, 0, 0, 0, 608, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 65, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 248, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90, 0, 541, 0, 0, 0, 0, 0, 596, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90, 89, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 525, 0, 524, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 295, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 497, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 325, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 577, 0, 0, 0, 0, 0, 0, 0, 0, 333, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 72, 272, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 90, 0, 648, 0, 0, 594, 0, 0, 0, 0, 0, 0, 0, 0, 0, 281, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 651, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 560, 0, 0, 0, 90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 537, 0, 656, 0, 0, 467, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 438, 0, 0, 0, 585, 0, 99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 34, 0, 0, 0, 0, 0, 0, 32, 98, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 327, 0, 0, 0, 249, 0, 0, 0, 0, 0, 0, 600, 0, 0, 0, 0, 136, 0, 0, 0, 0, 0, 601, 0, 0, 0, 0, 0, 0, 0, 450, 456, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 435, 0, 349, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 306, 0, 0, 337, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 574, 0, 0, 0, 451, 0, 0, 437, 0, 0, 0, 0, 0, 0, 645, 0, 0, 0, 581, 0, 0, 96, 0, 582, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 548, 499, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 31, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 304, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 450, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 650, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 649, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 660, 0, 0, 0, 0, 0, 598, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 338, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 647, 0, 0, 247, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 665, 665, 665, 665, 665, 665, 665, 664, 666]);
  var labelText = "orgmilcomschnetedugovdrrformsfeedbackofficialaccoorgmilschnetgovmagazinemediaunioncargopilotgroupcaarespressworksaerodromeworkinggroupair-traffic-controlaircraftaccident-preventioneducatormarketplaceambulanceinsurancecateringairportrepbodyenginesoftwaremodellingair-surveillanceconsultingchartertrainermaintenanceservicesdesignflightskydivingfreightassociationstudentgroundhandlingdgcafuelclubtaxicrewshowballooningexpresstraderbrokerauthoragentsairtrafficjournalistsafetyconsultantmicrolightaccident-investigationparachutingequipmentproductionfederationrecreationscientistnavigationengineertradingglidingleasingresearchpassenger-associationentertainmentparaglidinghangglidingaerobaticrotorcraftemergencycertificationgovernmentaeroclubexchangelogisticschampionshiphomebuiltcouncilconferencecontrolairlinecivilaviationjournalorgcomnetedugovcoorgcomnomnetobjofforgcomnetuwukiloappsframerorgmilcomnetedugovcoradioorgcomnetcommuneedogpbcoitgvorgedugov*spreviewfrontendrelayononstagingauthcloudsandboxupid*mtls*privatelinktypedreamdeveloperbravemochawindsurfaivenmirenupsunwnextbegetngrokclerkwale2bwebcsbrunputercrbtsflutterflowcloudzyrospawnbasesliplanemodelenceshiptodaymagicpatternsnetlifyondigitaloceanrailwayhostedclaudehasurabotdashretoolvercelgithubluyanigadgetreplitcloudflaretelebitedgecomputeevervaultexponyatnoopencrpplxzeaburwasmerframerzeropsrocketpreviewconvexmedusajsspritesagilevibesonherculeseasypanelstreamlitglideossnowflakemesserliloginlinehackclubcodepennorthflankbase44corespeedleapcellngrok-freeclerkstagelovableon-fleek*us-west-3ap-south-2us-central-2us-central-1eu-central-1ap-south-1us-west-2us-east-2eu-north-1ap-north-1us-west-1us-east-1*rcloudintsegorgmilcomgobbetnetintedugovturmusicasenasamutualcoopv6dnsip6uriurnin-addre164homeirisgovdixdaemoncloudnssthwien*inexexkunden4accogvormymyspreadshop4lima2ixortsinfofuturecmsfuturehosting12hpprivfuturemailinglima-cityfunkfeuer123webseitednshomemelmyspreadshopcloudletswasantqldvicactnswtascatholicwasaqldvictasidwasantozqldorgcomvicasnactnetedugovnswtasconfcomairflowlambda-urltransfer-webapptransfer-webappairflowtransfer-webapptransfer-webapp-fipstransfer-webappeu-west-3ap-south-2eu-south-2eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3eu-central-1mx-central-1me-central-1ca-central-1il-central-1ap-northeast-1ap-southeast-1me-south-1af-south-1eu-south-1ap-south-1ap-southeast-7us-west-2eu-west-2ap-east-2us-east-2eu-north-1ap-southeast-2ap-northeast-2ap-southeast-5us-gov-west-1us-gov-east-1ap-southeast-6ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1privatenotebookstudiolabelingnotebookstudionotebooknotebook-fipslabelingnotebookstudionotebook-fipsnotebookstudio-fipsnotebook-fipsnotebookstudionotebook-fipsnotebookstudioeu-west-3ap-south-2eu-south-2eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3eu-central-1me-central-1ca-central-1il-central-1ap-northeast-1ap-southeast-1me-south-1af-south-1eu-south-1ap-south-1us-west-2eu-west-2us-east-2eu-north-1ap-southeast-2ap-northeast-2experimentsus-gov-west-1us-gov-east-1ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1onrepostsagemakercopporgmilcompronetintedugovbiznameinfoshoprsorgmilcomnetedugovbrendlyresolvenzauscotvstoreorgcomnetedugovbizinfoidacaicoittvorgmilcomschnetedugovinfocloudezproxysiteacmymyspreadshopkuleuvenwebhostingtransurl123websitecloudnsinterhostsolutionsddns5476103298edgfacbmlonihkjutwvqpsryxzbarsycoororgcomedumyftpno-iporxcloud-ipfor-somemmafanfor-morewebhopselfipjozidyndnscloudnsdscloudfor-thefor-betteractivetrailcoeconorestooteorgcomeconeteduassurmoneyafricaarchitectesrestaurantloisirstourismavocatsinfoagrounivcoorgcomnetedugoviatvdeportesaludtksatorgmilcomwebgobnetinteducienciaboliviarevistacooperativaempresanombreindustriamusicapatriamedicinademocraciapoliticapuebloindigenaplurinacionalarteblogwikiinfoagrotransportenoticiasprofesionalacademiaeconomiaecologiamovimientotecnologianaturalpagesappsgroksailsimplesitecepesebamapadfmgalampbacscpirngorotomtrjspaprrprrsesmscepesebamapadfmgalampbacscpirngorotomtrjspaprrprrsesms*biaamfmtcmptvfeirasampajampanatalbelemananiradiog12medindfndbmdtrdthepoaggfjdfdefinfenflegsegongengcngorgzlgslglogppgmillelqslcimcomnomadmjabimbbibbsbabcrectecsjcetcpscpvhudieticriapipsiecnbiorioecogeoteoodoproatoartfstmatvetdetbetnetcntnotfotgrueduajuespappreptmpemparqsrvadvdevgovntrturagrjorfarjusmusdesvixxyzcozfozslzbhzmaringasantamariacampinagrandegoianiasorocabafloripasaobernardocuritibaboavistarecifeaparecidasaogoncasalvadorcuiabamorenamacapalondrinacontagemsocialfortalmaceioleilaoosascoriobranconiteroi9guacutcheblogflogvlogwikitaxicoopmanauspalmascaxiasjoinvillebaruericampinassantoandreribeiraoriopretoweorgcomnetedugovv0windsurfshiptodaycloudsitecoaccoorgnetgovofmilcomgovmediatechzacoorgcomnetedugsjgovmydnspenfnlabnbmbgcbcqconcontnuyksknsmyspreadshopno-ipawdevboxbarsyonidatemfuinabusavinstanceseceuguukussryzespawncsxcloud-ipmyphotosfantasyleaguetwmailcleverappsscrappingccwucloudnsftpaccessgame-serverccgovobjectsrmalpgcust*svcalp1aeappenginermalpgmyspreadshop4lima2ixsquare7cloudscale123websitefirenet12hpflowgotdnslinkyard-cloudcloudnslima-citydnskingobjectstorageedaccogoorusorgcomnetintedua\xE9roportxn--aroport-byaassogouvcomilgobgovcloudnses-1eu-west-1us-east-1euvipit1eurarubait1s3lbwebsites3websiteru-spbru-mskelasticcsrunstnukukcaukusnl-ams-1fr-par-1fr-par-2functionsnodess3ddlwhmrdbfnck8sifrs3-websitecockpitscblmgdbdtwhkafkpubprivs3ddlwhmrdbk8sifrs3-websitecockpitscblmgdbdtwhkafks3ddlrdbk8sifrs3-websitecockpitscblmgdbdtwhkafkk8sscalebookpl-wawfr-parnl-amsbaremetalsmartlabelinginstancesdechk2kuleuvenlaravelvoorloperurownoxazapscwhstgrvaporonline-serverobservablehqelementorantagonistreclaimjoteluluencowaydiademjelasticmatlabmagentositetrendhostingaxarnetjenv-arubajelejoteravendbemergenttrafficplexconvexkeliwebserveboltbegetcdnstaticson-rancherprimetelonstackitunison-servicesdnshomelinkyardbarsyjelecloudnscocomnetgovmycn-northwest-1cn-north-1s3s3-accesspoints3-websites3s3-accesspointrdsdualstacks3-deprecatedemrappui-prods3-websiteemrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apis3s3-accesspoints3s3-accesspointrdsdualstackemrappui-prods3-websiteemrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apicn-northwest-1cn-north-1cn-northwest-1ebcomputeelbcn-north-1airflowcn-northwest-1cn-north-1oncn-northwest-1cn-north-1amazonawssagemakeramazonwebservicesdirectasgdsdhehahljlnmhbacscahqhshhihnlnynsnmofjbjzjxjtjhkcqtwgsjssxnxjxgxxzgz\u7DB2\u7D61\u7F51\u7EDC\u516C\u53F8orgmilcomnetedugovxn--55qx5dcanva-appsxn--io0a7iquickconnectcanvasitekhsjxn--od0algcanva-codemyqnapcloudsrvrlessclustersrealtimestorageleadpagescarrdcrdorgmilcomnomnetedugovhidnssupabaserdpareplmypiumsoxmitotaplpagesfirewalledreplitowodevwebview-assetsvfswebview-assetss3s3-accesspointdualstackemrappui-prods3-websiteaws-cloud9emrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apicloud9eu-west-3ap-south-2eu-south-2eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3eu-central-1me-central-1ca-central-1il-central-1ap-northeast-1ap-southeast-1me-south-1af-south-1eu-south-1ap-south-1ap-southeast-7us-west-2eu-west-2us-east-2eu-north-1ap-southeast-2ap-northeast-2ap-southeast-5ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1s3s3-accesspointdualstackemrappui-prods3-websiteaws-cloud9emrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apicloud9consent-portals3s3-accesspointdualstackanalytics-gatewayemrappui-prods3-websiteaws-cloud9emrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9s3s3-accesspointdualstackemrappui-prods3-websiteemrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apis3s3-accesspointdualstackemrappui-prods3-websiteemrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apis3s3-accesspointdualstacks3-deprecateds3-websitebedrock-agentcores3-object-lambdaexecute-apibedrock-agentcores3s3-accesspoints3-websites3-accesspoint-fipss3-fipss3s3-accesspointdualstackemrappui-prods3-websites3-accesspoint-fipsaws-cloud9s3-fipsemrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9s3s3-accesspointdualstackemrappui-prods3-websites3-accesspoint-fipss3-fipsemrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apis3s3-accesspointdualstackemrappui-prods3-websiteaws-cloud9emrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9s3s3-accesspointdualstackemrappui-prods3-websiteaws-cloud9emrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9s3s3-accesspointdualstacks3-deprecatedanalytics-gatewayemrappui-prods3-websiteaws-cloud9emrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9vfss3s3-accesspointdualstackemrappui-prods3-websiteaws-cloud9emrstudio-prods3-object-lambdaemrnotebooks-prodexecute-apicloud9eu-west-3ap-south-2eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3eu-central-1mx-central-1me-central-1ca-central-1il-central-1ap-northeast-1us-northeast-1ap-southeast-1me-south-1af-south-1ap-south-1ap-southeast-7us-west-2eu-west-2ap-east-2us-east-2ap-southeast-2ap-northeast-2ap-southeast-5us-gov-west-1us-gov-east-1ap-southeast-6ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1mrapaccesspoints3s3-accesspointdualstacks3-deprecatedanalytics-gatewayemrappui-prods3-websites3-accesspoint-fipsaws-cloud9s3-fipsemrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9s3s3-accesspointdualstacks3-deprecatedanalytics-gatewayemrappui-prods3-websites3-accesspoint-fipsaws-cloud9s3-fipsemrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apicloud9s3s3-accesspointdualstackemrappui-prods3-websites3-accesspoint-fipss3-fipsemrstudio-prodbedrock-agentcores3-object-lambdaemrnotebooks-prodexecute-apis3eu-west-3ap-south-2eu-south-2computes3-ap-northeast-2elbrdss3-ap-east-1s3-sa-east-1s3-us-gov-west-1s3-eu-central-1s3-ca-central-1eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3s3-website-us-west-2s3-website-eu-west-1s3-external-1eu-central-1me-central-1ca-central-1il-central-1s3-us-west-1s3-eu-west-1s3-website-sa-east-1s3-website-ap-southeast-2ap-northeast-1ap-southeast-1s3-us-west-2s3-eu-west-2me-south-1af-south-1eu-south-1ap-south-1ap-southeast-7us-west-2eu-west-2us-east-2s3-website-ap-southeast-1s3-1s3-globals3-ap-northeast-3eu-north-1airflowap-southeast-2s3-us-gov-east-1s3-fips-us-gov-east-1s3-me-south-1s3-ap-south-1ap-northeast-2s3-website-us-west-1ap-southeast-5s3-eu-north-1s3-ap-southeast-1s3-website-us-gov-west-1compute-1s3-eu-west-3us-gov-west-1s3-website-ap-northeast-1us-gov-east-1s3-fips-us-gov-west-1s3-website-us-east-1s3-ap-southeast-2ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1s3-us-east-2s3-ap-northeast-1authauthauth-fipsauth-fipseu-west-3ap-south-2eu-south-2eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3eu-central-1mx-central-1me-central-1ca-central-1il-central-1ap-northeast-1ap-southeast-1me-south-1af-south-1eu-south-1ap-south-1ap-southeast-7us-west-2eu-west-2ap-east-2us-east-2eu-north-1ap-southeast-2ap-northeast-2ap-southeast-5us-gov-west-1us-gov-east-1ap-southeast-6ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1eu-west-3eu-south-2ap-southeast-3eu-central-1ca-central-1ap-northeast-1ap-southeast-1ap-south-1us-west-2eu-west-2us-east-2eu-north-1ap-southeast-2ap-northeast-2ap-southeast-5eu-west-1us-east-1ap-east-1sa-east-1csrframeservicesbuilderstg-builderdev-builder*ociocpocsazuregcpawsdemoinstanceeu-west-3ap-south-2eu-south-2eu-central-2ap-southeast-3ap-southeast-4ap-northeast-3eu-central-1me-central-1ca-central-1il-central-1ap-northeast-1ap-southeast-1me-south-1af-south-1eu-south-1ap-south-1ap-southeast-7us-west-2eu-west-2us-east-2eu-north-1ap-southeast-2ap-northeast-2ap-southeast-5us-gov-west-1us-gov-east-1ap-southeast-6ca-west-1us-west-1eu-west-1us-east-1ap-east-1sa-east-1previeweu-4us-4us-1eu-1us-2eu-2us-3eu-3appss3-websitekrkrobjectprivateobjectkrkrskrkrsobjectkrprivateobjectkr-privatecomputepaasrag-cloudrag-cloud-chjcloudjcloud-ver-jpcdemonodebalancermembersipeuxvsoncillaocelotonzayalilynxsphinxfentigercustomercaracalsgkrobjectstoragedesgkrusobjectkrkr-naverkr-naver-devkrprivatewebsiteobjectkr-naverkr-privatekr-naver-devjpjpkrjp4jp5s3-website-jpjpkrjp4jp5objectprivateobjecto365cloudstaticxendevapp001testcode-builder-stgplatformmediasiteprojedrydpagesjsx0desazacncoitrueu4uhkukgrbrushatenadiarymyspreadshopfrom-flfrom-wvwebspace-hosttheworkpchatenablogcursorusercontentservesarcasmapplinzisakuratanwixsitefin-ncloudstoragegov-ncloudstorageappchizigiizeis-into-carsdnsiskinkyadobeaemcloudis-a-therapistpgfogmyvncdojinis-an-actress1kappfldrvkozowqa2jpnmexprgmrfirewall-gatewaydynnscafjsfbsbxooguyfrom-gawoltlab-demois-a-anarchistwiardwebteaches-yogadattowebtb-hostinglive-websiteservegamegotpantheonfrom-nhsubsc-payfrom-ohvipsinaappfrom-cadyndns-officeztna-dingtalkhomelinuxfrom-mahercules-appservebbsstreakusercontentfrom-okfrom-wyfastly-terrariumis-a-llamaqualyhqportalserveexchangeon-vaporvivenushopciscofreakgrayjayleaguesmetaaiusercontentfrom-iais-a-libertariansaves-the-whalestaveusercontentyolasiteoperaunitepoint2thisis-a-catererclaudeusercontentlinodeusercontentfrom-vagithubusercontentsells-for-lesshosteurcanva-appsplaystation-cloudddnsfreefrom-pafrom-prfrom-waddnskingoutsystemscloudhotelwithflightmydattois-a-nascarfanmydbserverminiserverdamnserverservehumouris-a-playerfrom-nvfrom-nmemergentagentgentappsamplifyappfrom-kyis-an-accountantnfshostserveircfrom-akpythonanywherestackhero-networkpostman-echolikescandydyndns-mailobservableusercontentserveftpfreeboxosfrom-utcdn77-storageamazonawsneat-urlnclouddyndns-serverlinodeis-a-teacherfrom-vtgleezemythic-beastsus1-pleniteu1-plenitla1-plenitpaywhirlservecounterstrikejdevcloudhealth-carereformis-into-animegoogleapisis-a-painterafricaisa-hockeynutatmetais-an-actora2hostedis-a-democratdatadetectest-le-patrondigitaloceanspacesis-a-designeris-a-hunterlinodeobjectstemp-dnsissmarterthanyoufrom-arsimplesiteevennodetownnews-stagingis-a-liberalgooglecodejelasticservemp3qualyhqpartnerdyndns-free1cooldnsest-a-la-masiondrayddnsdynuddnsfrom-orfrom-miis-a-bloggerfrom-himydobisscanvacodeis-an-engineerest-a-la-maisonupsunappdevinappswafflecellmyasustorwpenginepoweredfrom-ctservep2psame-appmyshopblocksthingdustdatalikes-piediscordsezis-with-thebandlpusercontentis-leetshopitsite3utilitiesis-a-personaltrainersinaappladeskis-a-cheflogoipselfipbase44-sandboxnospamproxyalibabacloudcsmesswithdnsauthgearappsiamallamawithgooglelutrausercontentmochausercontentframercanvasmytabitdyndns-homew-credentialless-staticblitzcpserverdiscordsaysis-a-nurseappspotatlassian-isolated-3premotewdfrom-mtwixstudiocode0emm180rmyactivedirectoryawsappsmytuleapdnsabrpolyspaceqbuserrenderbuiltwithdarkboutirgotdnsabrdnsdopaascanva-hosted-embedawsglobalacceleratorhomesecuritypcmyiphostditchyouripclever-clouddyndns-ipon-aptibleis-a-musicianhosted-by-filessecuritytacticsappspaceusercontenthomeunixstrapiappsame-previewcf-ipfsmycloudnaselasticbeanstalkis-certifieddontexistkasserverik-serverdrive-platformatlassian-3pfirebaseappncpstorageherokuappawsapprunnerbarsycenteris-a-cubicle-slaveservehttpmyshopifyis-a-guruquicksytessiiitesorsitesmagicpatternsappis-a-cpameteorappfrom-wiis-a-rockstarbumbleshrimpdattolocaldatabricksappsreadthedocs-hostedfrom-rifamilydsdyndns-picsmyoxypagesplesknsbplaceddnsaliasdynaliasdyndns-remotedoomdnsip-ddnsblogdnsis-a-doctorroutingthecloudamazoncognitobarsyonlinedsmynasddnsgurucloudflare-ipfsdeus-canvasfrom-idsmushcdnpagespeedmobilizerdyndns-at-homeunusualpersonhosted-by-previderis-a-republicandyn-o-saurstreamlitappworkisboringonthewificprapidqualifioappis-uberleetis-slickgetmyipwpdevcloudtypeformdyndns-at-workgentlentapismynascloudw-corp-staticblitzfrom-ingeekgalaxyservebeerfrom-mdonrenderspace-to-rentaivencloudappspacehostedwafaicloudcodespotblogspotatlassian-3p-us-gov-modfrom-ndfrom-msis-a-techieis-a-studentcustomer-ociis-a-photographerdurumisfrom-ksmassivegriddyndns-wikiis-an-entertaineris-a-hard-workermysecuritycamerafrom-mnrackmazedyndns-blogis-a-bulls-fanwritesthisblogfreemyipsimple-urlfrom-sdninjaneer-sitesreservdauthgear-stagingest-mon-blogueuris-into-gamesrice-labsxtooldevicesakurawebis-an-anarchistoraclecloudappsdyndns-worksells-for-urhcloudfrom-dcfastvps-serverwpmucdnis-a-geekscrysecfrom-txis-into-cartoonsmodelscapetrycloudflarelocaltonetstreak-linkbalena-devicesfrom-njforgeblocksfreebox-oswebadorsitefrom-ncdoesntexisthobby-sitestreaklinkshomesecuritymacownprovidertuleap-partnersdattorelaywphostedmailservequakeis-a-socialistservehalflifepivohostingdynuhostingquipelementsw-staticblitzdyndns-webfrom-deproject-studyis-not-certifiedhercules-devis-a-financialadvisoramazonlightsailservepicsis-a-greenloseyouripfrom-ilwithyoutubemwcloudnonprodwiredbladehostingdnsdojofrom-tnpixolinomyqnapcloudncloudstorageis-an-artisthostedpiis-a-landscaperauiusercontentoaiusercontenton-forgeis-a-conservativedreamhostersnet-freaksapps-1and1is-goneencoreapifastly-edgefrom-nesalesforcefrom-scdeployagentoraclegovcloudappsfrom-alis-a-lawyercechirevultrobjectsstufftoreadisa-geekddnsgeeklovableprojecttry-snowplowfrom-moblogsyteis-a-bookkeepernogmyforumravendbmyboxdeelementoredsaacficogoorinforgcomgobnatneteduidstoreorgcomnetintedudevnomepublorgcomneteduathgovtestscalculatorspaynowinfoquizzesresearchedcloudnsfunnelsassessmentsjscaleforcetmacltdorgmilcompronetgovbizpresseklogesrsccloudcustomfltusrcloude4corealmgovmunicontentproxy9metacentrumdyndyndyndnsdynpagespages-researchitionoccustomercomymyspreadshopipv64diskussionsbereich4limacomrubgov2ixfirewall-gatewayddnssspdnsbarsykeymachinesquare7myhome-serverspeedpartnercommunity-proschuldockxenonconnectg\xFCnstigliefernbwcloud-os-instancedyndnssecmy-routerxn--gnstigliefern-wobin-butterl-o-g-i-nisteingeekin-dslin-berlinin-brbfuettertdasnetzleitungsenin-vpnlcube-serverdyn-ip24logoipdyn-berlinruhr-uni-bochum12hpgoipsrvdnsfruskygit-repossvn-reposinternet-dnsg\xFCnstigbestellenhome-webserverxn--gnstigbestellen-zvbbplacedheimdnscosidnswebspaceconfiglima-citydyndns1istmeinvirtualuserschulplattformmy-gatewayddnsseclebtimnetztest-iservmein-iservvirtual-userhome64iservschuletaifun-dnstraeumtgeradeschulserverdynamisches-dns123webseitednshomehs-heilbronndnsupdaterbssgraphicdwadpdwdaepeweaawapaafpfwfabwbpbacwcpcciwebuserapiobjectssites*teamst3r2lpabymebravepanelngrokiservstglclcrmerpflypagesbarsyvivenushoplocalcertlocalplayerbearbloggatewaydeno-stagingis-not-ais-a-goodbotdashvercelmocha-sandboxplatter-appreplitgithubpreviewworkersinbrowserevervaultis-ahrsndenoxmitmodxmyaddrstorageapipayloadgrebedocruncontainersreliantlabsstgstagelclstageloginlineis-a-fullstackcodepenreliantpreviewleapcellngrok-freeis-coolpagelemonstoragewebharemediatechlibp2pdiscoursecomyspreadshopstoreregbiz123hjemmesidefirmcoorgcomnetedugovsldorgmilcomwebgobartnetedugovtmorgpolcomsocartnetedugovassoagrondiscoodontk12medcuegyecpaabgengorgmilgalsaltulcomadmesmgobpubdocmonfindgnriouioproartlatvetnetfotedulojgovntrturibrbarxxxofficialbasechefprofmktgpsictechinfoarqtcontdentrrpppsiqgit-pagesritmedfieorgcomlibprieduaipgovriikmeactvsportorgmilcomscieunnetedugovnameinfopintouchtawktotawkmyspreadshoporgcomnomgobedu123miwebcomputeorgcomnetedugovbiznameinfocognito-idptransfer-webappeusc-de-east-1onjelasticnxaspdnsbarsydirectwpdeuxfleurstransurldogadoprvwcloudnsamazonwebservicesdnshomeuserpartycokoobinmkmspaceviewfidymyspreadshopalandkapsiikixn--hkkinen-5wacloudplatformh\xE4kkinen123kotisivuidacorgmilcompronetedugovbiznameinforadioorgcomneteduusercocomexperts-comptablestmmyspreadshopgretaprdcomnomynhccifbxoshuissier-justicenotairesaeroportfreeboxoson-webavocatassoportgouvkdnschirurgiens-dentistes-en-franceavouesfbx-os123sitewebveterinairechirurgiens-dentistespharmacienchambagrimedecinfreebox-osdediboxgoupilemszicpyicpvicppleysheezypagesedugovcnpyorgcomcybllcpvtnetedugovtnxonlineschoolddnsdaemond6atcopanelorgnetplybotdashstackitkaasorgmilcomnetedugovbizmodltdorgcomedugovcoorgcomneteduappwriteacorgcomnetedugovcloudtranslateusercontentorgcomnetedumobiassoorgcomnetedugovbarsysimplesiteindorgmilcomgobneteduorgcomwebnetedugovguaminfonxhra\u6559\u80B2\u654E\u80B2\u7DB2\u7D61\u7F51\u7D61\u7EC4\u7E54\u7D44\u7E54\u7F51\u7EDC\u7DB2\u7EDC\u7EC4\u7EC7\u7D44\u7EC7\u516C\u53F8\u653F\u5E9C\u500B\u4EBA\u4E2A\u4EBA\u7B87\u4EBAltdorgcomincneteduidvgovxn--uc0ay4axn--55qx5dxn--mk0axixn--io0a7ixn--uc0atvxn--zf0avxxn--lcvr32dxn--od0algxn--wcvs22dxn--gmqw5axn--od0aq3bxn--mxtq1mxn--ciqpnxn--tn0agxn--gmq050iorgmilcomgobnetedufngocdnappvoatiiservwp2tempurlmircloudfreesitewpmudevmyfastgadgetcloudaccessjeleambahalfboltfastvpsemergenteasypanelopencraftizcombrendlynamefromrtpersoadultmedorgpolrelcomproartnetedufirminfoassoshopcoopgouvtmcomediahotelforumvideosportorgsexagrargameslakaseroticaerotikatozsdereklamcasino2000filmsuliinfoboltshopprivnewsszexcityutazasjogaszkonyveloingatlaneacaicogoormy\u1B29\u1B2E\u1B36milwebschnetkopbizzonedesaponpesxn--9tfkymyspreadshopgovmytabittabitorderravpageaccok12idforgnetgovmuniltdplcaccotttvorgcomnetmeca6g5gpgamubacaicniocoukuptverdruscsdelhiindorgmilcomwebnicfingenpronetintedugovresbizbiharbarsyinternetbusinessschooltravelsupabasealumnigujaratfirminfoaeropostbankcoopindevscloudnsno-ipbarsybarrell-of-knowledgebarrel-of-knowledgensupdategroks-thisdnsupdatefor-ourknowsitalldvrcammittwalddynamic-dnsv-infowebhopselfipdyndnshere-for-moreilovecollegemayfirstforumzcloudnsmittwaldservertypo3servergroks-theeusekd1cdndyndnsidrawsainaueuapjpusstagemocksysdevicesclientcustreservdcustdevdisrecprodtestingcowzbeebyteutwenteboxfusebravepstmndedynngrokorgmilcomnomnetedugovqcxqzzbarsythingdustmo-siemensrb-hostingfh-muenstergitbookbluebitecloudbeesusercontentnodeartterramindkiloappsforgerockdarklangresinstagingapigeebubbleb-datascryptedhypernodedappnodepantheonsitegitlabgithubkeeneticvirtualservercleverappshostyhostingon-rioedugitticketstelebitwixstudioon-k3sicp0icp12038jeleqotolairbubbleappsmyaddrstolosmyrdbxwebflowdrive-platformbeagleboardhasura-applolipopdefinimavaporcloudmusicianwebflowtestazurecontainerresindevicereadthedocsloginlineeditorxmoonscalesandcatsbasicserverwebthingsbrowsersafetymarkbeebyteappbitbucketidaccovistablogorgschnetgovxn--mgba3a4f16axn--mgba3a4fraarvanedge\u0627\u064A\u0631\u0627\u0646\u0627\u06CC\u0631\u0627\u0646jclaspeziapdudcefegelemeperetevebacanatavaparasabgagfgogrgpgalclblimfmrmcbmbvbfclcmcvcrcpcchlimifibicivipirisimncnbnanenrnpntnnolomobocoaogorosopotoptvtatctbtmtltotpusulunutpspapaqsvpvvvtvavvrtrsrprgrfrcrbrarorkrvstsssbscsmsispzczbzbozen-suedtirolmyspreadshopxn--bulsan-sdtirol-nsbxn--valledaoste-ebbtrentinoaltoadigetrentin-sued-tirolxn--forlcesena-c8axn--forl-cesena-fcbxn--bozen-sdtirol-2obtriestetrentinsuedtiroltrentino-s-tirollecceudineaostesienaparmaluccapaviagenoapaduaaostamonzaabruzzoternirietiturinmilanbozenlaziofermoleccocuneonuoropratola-speziavdataaligfvgpugmolcalcamlomumbsicpmnvenvaoedugovabrsarmaremrbastoslazibxosfirenzetrentinos\xFCdtirolval-d-aostavalle-aostamessinacremonaravennatoscanatrentin-suedtirolbolognacalabriaurbinopesarofriuli-v-giuliaogliastraxn--valle-aoste-ebblaquilaandriatranibarlettasyncloudxn--valle-d-aoste-ehbaostavalleyvalled-aostatrentino-alto-adigevallee-d-aostexn--balsan-sdtirol-nsbpistoiasicilialucaniacataniaiserniaperugiabresciaveneziagorizialiguriaimperiabulsan-suedtirolbalsan-suedtirolbarlettatraniandriaxn--trentino-sdtirol-szbforl\xEC-cesenatuscanyvall\xE9e-d-aostemantovavall\xE9e-aostecasertapiemontevalleaostaval-daostafriulivgiuliatrevisoforli-cesenavall\xE9edaosteferrarapescaravald-aostatrentino-altoadigefriuli-vegiuliavallee-aostecarboniaiglesiastarantomediocampidanovalleedaostetrentinosud-tirolcampobassotrentins\xFCd-tiroltrentinos\xFCd-tirolmonzabrianzatrentino-s\xFCdtirolxn--trentino-sd-tirol-c3bpotenzacosenzavicenzaemiliaromagnavenicefrosinonemarchepordenonetrentinosued-tirolvaresemolisevall\xE9eaostefriuli-veneziagiuliabasilicatalatinaanconasavonaveronamodenabiellabolzano-altoadigepugliafoggiaumbriatrentino-stirolgenovapadovamateranovararagusapiacenzatrentinostirolvalleeaostetempio-olbiasudsardegnatrentinsudtirolmassa-carrarafriuliveneziagiuliatrentinosuedtirolandria-barletta-tranitrapanixn--cesenaforl-i8amaceratacaltanissettaascoli-picenobrindisicarraramassacagliaririmininapolivibo-valentiachietibulsan-sudtirolbalsan-sudtiroltrentino-a-adigebulsanbalsaniglesiascarboniamilanotorinoteramodell-ogliastraarezzotrentinoalto-adigerovigotrentovenetoiglesias-carboniatrentino-sud-tirolaltoadigereggio-emiliareggio-calabriasardegnatranibarlettaandriapiedmontxn--sdtirol-n2amedio-campidanotrentino-s\xFCd-tirolfriuli-vgiuliafriuli-ve-giuliaromeennaromapisa32-b16-b64-blodiastibarineencomonaplesforlicesenailiadboxosalessandriasicilytrani-barletta-andriaxn--trentin-sdtirol-7vbpesarourbinotrentinsued-tirolcesena-forliforl\xECcesenaemilia-romagnamonzaebrianzaxn--trentinsdtirol-nsbtrentinos-tiroltrentins\xFCdtirolvalledaostaolbia-tempiocampidanomediovibovalentiasassarivalle-daostalombardysud-sardegnafriulivegiuliareggioemiliamonzaedellabrianzaalto-adigevercellitrentin-sudtiroltraniandriabarlettatrentino-sudtirolascolipicenobozen-s\xFCdtirolfriulive-giuliaflorencexn--cesena-forl-mcbcarbonia-iglesiasaosta-valleycarrara-massadellogliastratrentinoa-adigexn--valleaoste-e7apesaro-urbinoxn--trentinosdtirol-7vbxn--trentin-sd-tirol-rzbxn--trentinsd-tirol-6vbtrani-andria-barlettatrentin-s\xFCd-tirolxn--trentinosd-tirol-rzbgrossetomonza-e-della-brianzas\xFCdtirolreggiocalabriatrentinoaadigetrentin-s\xFCdtirolverbano-cusio-ossolafriuliv-giuliaverbaniacampaniatrentino-aadigefriulivenezia-giuliasardiniaandriabarlettatranibarletta-trani-andriacatanzarooristanourbino-pesarocesena-forl\xECvalle-d-aostacampidano-medio123homepagesiracusatempioolbiasuedtirollombardiaavellinocesenaforl\xECtrentinofriuli-venezia-giuliabozen-sudtirolandria-trani-barlettabulsan-s\xFCdtirolbalsan-s\xFCdtirolmonza-brianzabolzanotrentino-sued-tirolbellunosalernolivornocrotonesondriodnshometrentinsud-tirolmassacarraratrentin-sud-tiroltrentino-suedtirolviterbobergamocesenaforliolbiatempiopalermobeneventoagrigentoofcoorgnetfmaitvphdengorgmilcomschnetedugovperagrikanieasukehandachitatokaiaisaikonanoharuamaobuhigashiuraowariasahiinuyamatobishimaiwakurashitarainazawatoyonegamagorimihamatoyotataharakariyayatomioguchikomakimiyoshinishiotokonamekiyosuchiryutoyohashiokazakiisshikikasugaikotakiratoeianjotogofusosetohazutsushimashinshirotakahamanisshinshikatsuhekinantoyokawaichinomiyatoyoakeodateogataakitaikawakyowahonjoogayurihonjonoshirokamiokakatagamimitanegojomeyokotekosakadaisenkazunonikahohonjyomoriyoshimisatohappoukamikoanihachirogatahigashinarusesembokufujisatokitaakitaitayanagiowanitakkomutsutsurutahirosakigonoheoirasetowadamisawanohejiaomorishingohiranairokunohehashikamitsugarushichinohehachinohenakadomarisannohekuroishisakaeisumiasahiotakiinzaiabikomatsudoyachiyomutsuzawakujukuriomigawakashiwatoganemihamanaritasakuranagaramobarahanamigawachoshishiroichoseikozakishisuikatorimidorichonankyonanfuttsuonjukufunabashinagareyamanodasosatakochuotohnoshourayasukimitsuyokaichibayotsukaidosodegauratateyamakamagayayokoshibahikariyachimatakatsuuratomisatokisarazukamogawaichikawanarashinoichinomiyashimofusaminamibososhirakoichiharaoamishirasatoikatahonaiainansaijoseiyoiyoozuuwajimaniihamanamikatamasakiuchikokihokutobetoonshikokuchuomatsuyamaimabarikamijimakumakogenyawatahamamatsunosabaeikedaobamasakaifukuiohionotsurugamihamawakasaminamiechizeneiheijikatsuyamatakahamaechizensoedaukihaomutaokawanishiogoribuzenonojosueumiokiotochikugosasagurisaigawamizumakishinyoshitomikurumekurateyamadakasuganakamamiyamanogatatakatahakataiizukakawaratagawakasuyaashiyainatsukimunakataminamitsuikishonaikurogifukuchikeisenhigashimiyakoshinguyukuhashiokagakiyamekogaongausuikahotohochuotoyotsumiyawakadazaifuhisayamatachiaraiyanagawanakagawahirokawachikujochikushinochikuhochikuzennamieotamaokumashowateneiiwakikoorinangoononishigoshimogoomotegomishimafukushimaasakawakagamiishishirakawaiitatefutabahiratayugawahanawakitakatakawamatakunimiyabukibandaihigashihironoyamatomiharuyamatsuriaizubangedatesomaaizuwakamatsuyanaizuaizumisatonishiaizuizumizakikitashiobarataishinkaneyamakoriyamainawashirotanagurafurudonosamegawasukagawaishikawatamakawaikedaogakitaruiginanenahashimahichisonakatsugawaibigawashirakawamizunamiminokamomitakekawauesekigaharatomikasakahogikitagatayamagatatajimianpachimotosuyaotsukakamigaharahidakanisekitokigujominogodoyorogifukasamatsutakayamawanouchihigashishirakawakasaharashimonitatsumagoichiyodakannakanrashowameiwakiryuotaoratomiokafujiokaitakuranaganoharahigashiagatsumatakasakishibukawaminakamikatashinatsukiyonokawabanumataannakaoizumimidorishintoisesakiuenoyoshiokakusatsutakayamanakanojonanmokutamamuratatebayashimaebashiotakekaitadaiwahongofuchukuietajimashobaramiharahatsukaichihigashihiroshimamiyoshikumanokurenakasakaseraseranishiasaminamifukuyamashinichionomichiosakikamijimajinsekikogentakeharaotobenanaeikedatohmaozoraobiraabirakyowaeniwataikibibaisharirebunerimohiroooketootarupippunishiokoppechitosefurubirahakodateshiranukakitahiroshimakushiroobihironanporoiwamizawaniikappukunneppufukushimanakasatsunaitoyourakuromatsunaiakabirakamisunagawashibechaurakawakamifuranonakatombetsuasahikawashimokawakayabeokoppebiratoriabashirisaromaatsumanumatahidakabifukamukawamikasahorokanaitoyotomisarufutsuhigashikawaishikarikitamiyoichiesashiiwanaitomariminamifuranoakkeshifuranotoyakoyakumootoineppushikaoishiraoinemuronayorohaboroashorobihororishirifujiutashinaihokutotakasuebetsuurausuassabukikonaishimamakinaiedatetoyabieinikiesanuryuoumuteshikagarikubetsuashibetsukimobetsuaibetsutobetsusobetsuembetsushimizuchippubetsurishirihokuryuhoronobeshintokutsubetsushibetsuhonbetsumombetsutsukigatakuriyamakoshimizushiriuchikutchanmurorannoboribetsukamishihorowassamushinshinotsukembuchiwakkanaikamoenaikiyosatotakinoueshikabesunagawafukagawanakagawatakikawakamikawahigashikagurahamatonbetsumatsumaemoseushirankoshishakotanimakanemashikeotofuketomakomaisandatambaitamiawajikasaiasagoshisoonoakoyashirotoyookaminamiawajiinagawafukusakitakasagokamigorikasugaharimayokawaashiyahimejiakashitaishiaogakisannantakinosumototakarazukanishinomiyashingugoshikinishiwakiyokatakaaioimikisayoyabukawanishiamagasakisasayamashinonsenkakogawaichikawakamikawatatsunotsukubaiwamaogawaasahisakaitokaioaraiitakobandodaigosuifuinaamikasumigaurakashimaomitamayachiyoshimodatetomobetoridehitachinakainashikisakuragawakasamayawaramoriyahitachiomiyanamegatayamagatahitachikamisuushikutakahagiibarakitonekoganakasowayukimihojosomitoryugasakishimotsumafujishirotsuchiurachikuseihitachiotashirosatotamatsukuriuchiharashikahakuinanaotsubatawajimakahokukawakitatsurugikaganominotosuzuuchinadakomatsuanamizunakanotohakusannonoichikanazawaiwateshiwafudaikawaimoriokaofunatohanamakikuzumakikitakamininohekunoheyamadayahabasumitaichinosekitanohatahiraizumirikuzentakatajobojiotsuchihironomiyakoiwaizumikarumaiichinohenodakujitonooshushizukuishifujisawamizusawakamaishikanegasakimannoutazukotohiraayagawazentsujihigashikagawauchinomikanonjisanukimarugamemitoyotakamatsutadotsunaoshimatonoshoakuneamamiizumihiokiyusuikinkoisasookouyamanakatanekagoshimakanoyaisenkawanabeminamitanemakurazakitarumizunishinoomotematsumotosatsumasendaioimatsudaayaseebinamiurazushinakaiodawaraiseharasagamiharahakoneaikawakaiseiatsugitsukuihadanoyamatoyamakitazamaoisochigasakininomiyayokosukakamakuraminamiashigarafujisawasamukawakiyokawahiratsukayugawaraokawaumajikochitsunootoyoakiinonishitosayasudahidakamiharasakawaniyodogawahigashitsunokagamigeiseisusakiotsukinaharisukumomurototosakamiochitoyotosashimizumotoyamanankokunakamurakitagawayusuharaogunichoyoukiasoutoozugyokutoamakusamifunetakamoriyamagaminamataminamiogunikikuchisumotoyamatonagasumashikiaraokumamotokamiamakusanishiharayatsushiroayabeseikasakyoideineujinakagyokameokakyotangokyotanabekyotambaminamiyamashiroyamashinatanabeyawatawazukaminaminantanmiyazuhigashiyamafukuchiyamakitamukokamojoyokizumaizuruujitawaraoyamazakinagaokakyokumiyamakawagoeinabeshimameiwaasahitaikiudonoisetsukisosakikuwanamihamamiyamasuzukatamakimisuginabarikumanokomonominamiisewataraitobakiwatakikihotadomatsusakayokkaichikameyamaureshinoishinomakishichikashukuohirataiwaosakizaohigashimatsushimashikamaiwanumashibataogawaraonagawakawasakiseminemarumoriminamisanrikukakudamuratawakuyatomiyanatoriwataritagajomisatotomekamirifushiroishimatsushimayamamotoshiogamafurukawahyugaebinotsunosaitoayakushimanobeokakitauramiyazakitakazakigokaseshiibamimatashintomikunitomikitakatakobayashikawaminamitakaharukijotakanabemiyakonojonishimeranichinankitagawakadogawamorotsukakisofukushimaminamimakisakaeobuseikedaogawamiasaokayaasahiotakiotarichinoinaomichikumakomaganechikuhokukaruizawayasuokaooshikaikusakaminamiaikitogakushimatsukawakawakamitateshinatakamorikitaaikishiojirimiyadahakubaiizunaiijimaiiyamamiyotasuzakayasakatoguraookuwanagawaminowahirayayamagataminamiminowafujimiomachisakakitakaginaganonakanosakuhokomoronagisoshinanomachiwadauedaiidaharasuwatomiachiaokianankisosakunozawaonsenagematsutakayamashimosuwamatsumotoyamanouchinakagawamochizukiazuminotatsunoobamaomuraseihiunzenosetofutsuikichijiwanagasakiisahayahasamisaikaikawatanasasebohiradokuchinotsugototogitsutsushimashimabarashinkamigotomatsuurayamazoekashibaikomakawaitenrioyodosangokoryoudaojiikarugayamatokoriyamatenkawakatsuragikurotakikawakamimiyakemitsuetakatorikamikitayamayamatotakadahegurishinjokanmakisakuraitawaramotogoseoudanarasoniandokawanishishimoichihigashiyoshinokashiharashimokitayamanosegawayoshinomintsivorytopazsakuragehirnsumomoaseinetopalmail-boxmokurenyoitamuikaojiyagosensanjoaganomyokoseiroagaomishibataniigatanagaokamurakamiuonumayuzawakariwatagamitainaitsunanminamiuonumatochioyahikojoetsuseiroukamosadoizumozakitokamachiitoigawasekikawakashiwazakitsubamemitsukekokonoesaikiusukibeppuusahimeshimakunisakihasamataketatsukumihitaoitahijikusuyufukujukamitsuebungoonobungotakadaibaraniimibizentsuyamaokayamakasaokahayashimayakagemaniwaakaiwamisakishinjotamanotakahashikibichuowakesojanagishookumenannishiawakurakurashikiasakuchisetouchikagaminosatoshotomigusukunakagusukuyaeseizenaurumaiheyaaguniogiminanjokinminamidaitokitanakagusukuyonaguniokinawaishigakikunigamiurasoekadenataramahiraraginozataketomishimojizamamitonakiitomanhigashimotobuyonabarugushikamionnanahanagohaebarukumejimakitadaitonakijinnishiharayomitanginowantokashikiishikawaikedasuitaminohizuminishisakaikananabenodaitoosakasayamayaokishiwadatadaokakaizukatondabayashichihayaakasakakumatorikadomasayamahigashiosakashijonawatehirakatataishimisakitajirihannansennankatanotoyonominatosettsuhigashiyodogawaibarakinosekitachuohigashisumiyoshifujiiderakashiwaraizumiotsutoyonakamatsubaramoriguchiizumisanoshimamototakatsukineyagawahabikinotakaishikawachinaganoyoshinogarikamiminearitaouchiimarihizenogikashimaariakekiyamafukudomikitagatakitahataomachigenkaikanzakinishiaritakyuragisagataratosutakushiroishikaratsuhamatamakouhokukawagoeyoshidasatteogoseirumaasakaurawaogawaniizaomiyayoriiotakishikihonjooganohannohanyuinasaitamaokegawaarakawayoshikawayokozehasudasayamahidakafukayachichibuiwatsukiryokamiyoshimikamiizumifujimiwarabiranzanmiyoshiminanoyashiosakadosugitomisatohigashichichibutodasokakukiyonokazoshiraokakasukabekounosukawajimatsurugashimamiyashirokitamotohatoyamamoroyamahatogayakumagayakawaguchinagatorokamisatomatsubushinamegawatokigawakamikawafujiminohigashimatsuyamakoshigayatokorozawas3isk01isk02ryuohkoseikonanaishorittotakashimamaibarahikonetorahimenishiazaikokagamokotoyasuotsukusatsunagahamamoriyamatoyosatotakatsukinotogawaomihachimanhigashiomiakagiunnanizumogotsuamayatsukakakinokimatsuehamadamasudahikawahikimiokuizumoyasugiyakumomisatotamayuohdahigashiizumookinoshimanishinoshimatsuwanoshimaneshimadafujiedayoshidashimodagotembaiwataatamikosaiyaizuitoizumishimahaibaramakinoharaomaezakikawanehonkannamisusonohigashiizufukuroinumazukawazufujiaraishizuokahamamatsushimizuizunokunimatsuzakimorimachiminamiizunishiizukikugawakakegawafujikawafujinomiyaujiietsugaoyamayaitaohiranikkoashikagakuroisokanumasakurashioyakarasuyamamotegiichikaikaminokawatochigihagamokanogisanobatonasumibunasushiobaranishikatautsunomiyaiwafunemashikoshimotsukeohtawaratakanezawaitanokomatsushimatokushimaichibaminamiaizumiwajikikainanmiyoshinarutomimamugiananmatsushigesanagochishishikuinakagawamachidachiyodakomaefussainagitaitochofufuchuomeotahigashiyamatotoshimaokutamaaogashimakodairaedogawaarakawahachiojishinagawatachikawashibuyasuginamihinodekiyosesumidaoshimanerimamitakahamuraadachinakanomizuhobunkyomegurominatokoganeihigashikurumekokubunjihigashimurayamamusashimurayamatamakitahinochuokotokatsushikakouzushimaogasawaraakishimakunitachishinjukusetagayamusashinohachijoitabashiakirunohinoharachizunanbukotouramisasawakasayonagokogehinoyazutottorinichinansakaiminatokawaharaoyabetairainamiasahinantoimizufuchutakaokakurobeyamadajohanatoyamatonaminyuzenfunahashinakaniikawanamerikawaunazukitogahimiuozufukumitsutateyamakamiichiiwadearidayuasainamitaijikatsuragiaridagawatanabemihamahidakakainankiminomisatoshingushirahamakamitondayurakozakoyagobokitayamawakayamakudoyamahashimotokushimotokozagawahirogawakinokawanachikatsuurarsuseroeoishidasagaeoguniasahinagaitendonanyoobanazawanishikawasakataohkuratozawamikawamamurogawayamagatafunagatatakahatashonaishinjokahokuiideyuzakawanishitsuruokakaminoyamayamanobeshiratakamurayamanakayamakaneyamahigashineyonezawasakegawamitouubeyuuabushimonosekitabuseoshimatoyotaiwakunihikarishunannagatohagihofukudamatsutokuyamashowadoshitsurunanbukoshukaiminami-alpsnirasakikosugeotsukioshinohokutominobuyamanashifuefukichuokofuichikawamisatoyamanakakonakamichitabayamanishikatsuranarusawafujikawahayakawafujiyoshidafujikawaguchikouenohara\u9577\u91CE\u4EAC\u90FD\u5C90\u961C\u5927\u962A\u4E09\u91CD\u7FA4\u99AC\u5343\u8449\u6ECB\u8CC0\u4F50\u8CC0\u5948\u826Fadednelgaccogogror\u79CB\u7530\u611B\u77E5\u9AD8\u77E5\u57FC\u7389\u6C96\u7E04\u6803\u6728\u718A\u672C\u5CA9\u624B\u9752\u68EE\u5C71\u68A8\u65B0\u6F5F\u5CF6\u6839\u9CE5\u53D6\u9577\u5D0E\u9999\u5DDD\u5BAE\u57CE\u77F3\u5DDD\u5927\u5206\u5BAE\u5D0E\u8328\u57CE\u5C71\u53E3\u5175\u5EAB\u5C71\u5F62\u5FB3\u5CF6\u5E83\u5CF6\u798F\u5CF6\u798F\u5CA1\u5CA1\u5C71\u5BCC\u5C71\u9759\u5CA1\u611B\u5A9B\u798F\u4E95\u6771\u4EACxn--4it168dhatenadiaryxn--vgu402ckawaiishophatenablogcocottenamaste\u5317\u6D77\u9053penneehimeiwateversestabachibashigagonnagunmapermahaccaakitaosakauh-ohblushkochiaichifukuikuroncapooitigohyogotokyokyotopunyuthickcheap0t00g00j0mie2-ddaapyawjg0amfemsubxiiboomoobutchueekpgwrgrherskrboyrdyupperunderflierchipsmydnsheavyangryhippygirlyrulez\u795E\u5948\u5DDD\u9E7F\u5150\u5CF6\u548C\u6B4C\u5C71bambinaxn--nit225kokayamasaitamaxn--k7yn95exn--1lqs03nsapporoparasitelolipopmcxn--efvn9sniigatafukuokatokushimafukushimahiroshimakagoshimafakefurokinawaxn--8pvr4ucoolblogxn--0trq7p7nnkawasakinagasakimiyazakichilloutxn--8ltr62kxn--klty5xpeeweezombiecutegirlxn--rny31hxn--uuwu58axn--ntso0iqx3axn--djrs72d6uytoyamanikitanyantakagawamimozanagoyaboyfriendxn--2m4a15egreaterchowderegoismyamagatafashionstorexn--elqq16hxn--pssu33lsendaimiyagixn--rht27zpecoriaomorisaloonwatsonvivianxn--djty4knobushipigboatnaganopinokoxn--f6qx53asadistvelvetsecretxn--5js045dchicappayamanashiibarakidigickgirlfriendxn--1lqs71dmongolianxn--c3s14mxn--qqqt11mtochigixn--5rtq34kparallelo0o0mondkobesagabonadecaoitanarafoolkilldecimainhiholomosblokilociaoundopupugifutankcrapflopnooroopsmodsholyjeezstripperpepperbittershizuokaxn--rht3dkitakyushureadymadeicurusversusmatrixxn--rht61ehungryfloppygloomycrankyhandcraftedlittlestarxn--klt787dxn--kltx9awhitesnowsunnydaytottorilovepoptheshopbuyshopxn--5rtp49cxn--d5qv7z876cwebaccelxn--kbrq7oxn--4pvxsxn--1ctwolovesickkumamotocatfoodxn--tor131oyokohamawakayamatonkotsuxn--ehqz56nxn--uist22hxn--6btw5axn--kltp7dyamaguchifrenchkisspussycatxn--4it797kxn--uisz3gbabybluexn--zbx025dnetgamersxn--7t0a264ckanagawaxn--6orx2rishikawaxn--ntsq17ghalfmoonschoolbusjellybeanxn--mkru45iusercontentlolitapunkxn--32vp30hsakurastoragehokkaidoshimanecandypopbabymilksupersaleweblikeraindropbackdropwebsozaikikirarahateblodaynightmeneacsccogoormobiinfoaeusxxorgmilcomnetedugovorgcomnetedugovbizinfotmprdorgmilcomnomedugovassnotairespresseassocoopgouvveterinairemedecinpharmaciensorgnetedugovtraorgcomedurepgovmeneperekgacscaiiocogoitoresmshsseoulbusanulsandaeguc01milvkimmvchungnamjeonnamjeonbukeliv-dnsgyeonggijejueliv-cdnincheondaejeongangwongyeongbukgwangjuchungbukgyeongnameliv-apicoeduindorgcomembnetedugovorgmilcomnetedugovjcloudorgcomnetintedugovperbnrinfocooyorgcomnetedugovethipfscanvamypepethw3sstorachakeeneticjoinmcinbrowserdwebcyonnftstoragemyfritzaemewphlxachotelltdorgcomwebsocschngonetintedugrpgovassnomgacsccoorgnetedugovbizinfo123websiteidorgmilcomasnnetedugovconfidmedorgcomplcschnetedugovaccoorgnetgovpresstmassoirseproxaccosoundcasthoptocraftvp4c66orgnetedugovitsxwxmcdirmyboxbarsyedgestacksynologylogintoopencloudnohostwebhopdiskstationi234tcp4hoocgroknoipprivmydsddnsdnsforlohmustransipdscloudfilegear-sgbrasiliafilegearframerbarsybarsyonlinecoprdorgmilcomnomedugovinforgcomnetedugovnameacprorgcomartnetedugovpresseinfoassoinstgouvorgnycedugovbarsydscloudjuorgcomnetedugovminisiteaccoororgcomnetgovorgmilcompronetintedugovbizmuseumnameinfoaerocoopaccoorgcomnetintedugovbizcooporgcomgobneteduorgmilcomnetedugovbiznameaccoorgmilneteduadvgovcoorgcomnetaltgovforgotherhiskeeneticispmanagernomassoprod5476132eastasiacentraluswesteuropewestus2eastus2pnortheurope-01newzealandnorth-01southindia-01southcentralus2-01norwaywest-01eastus2-01westus2-01australiaeast-01italynorth-01israelnorthwest-01swedencentral-01westeurope-01centraluseuap-01taiwannorthwest-01uaecentral-01northcentralusstage-01israelcentral-01mexicocentral-01canadacentral-01austriaeast-01germanywestcentral-01francecentral-01ukwest-01denmarkeast-01polandcentral-01eastus-01westus-01swedensouth-01eastus3-01westus3-01brazilsouth-01centralus-01francesouth-01australiacentral-01westindia-01uaenorth-01jioindiacentral-01canadaeast-01belgiumcentral-01spaincentral-01koreacentral-01chilecentral-01qatarcentral-01westcentralus-01eastus2euap-01norwayeast-01southafricanorth-01brazilsoutheast-01germanynorth-01switzerlandnorth-01switzerlandwest-01japanwest-01southafricawest-01japaneast-01eastasia-01indiasouthcentral-01taiwannorth-01centralindia-01uksouth-01southcentralus-01northcentralus-01eastasiastage-01indonesiacentral-01australiacentral2-01australiasoutheast-01malaysiawest-01koreasouth-01southeastasia-01southeastus5-01northeastus5-01jioindiawest-01rucdnwest1-usfra1-desandboxjls-sto1jls-sto3jls-sto2aglobalabglobalsslmapprodfreetlsmapvpslon-1lon-2ny-1fr-1sg-1ny-2paassnwebpaashostingjelasticnordeste-idcsocuserpagescwebfileblobservicebuscoreatlricnjsjelasticwebsitestoragesezagbinruhuukjptsmyspreadshopmynetnameakamaiorigin-stagingfrom-coipv64dynv6cdn77serveblogadobeaemcloudhicamsprytdnsupno-ipownipde5ovhicpfirewall-gatewaysytesmypsxbarsyusgovcloudapimyamazemyradwebakamaihdsaveincloudfastlylbfrom-lasubsc-paysquare7in-the-bandblackbaudcdnhomelinuxoninfernoctfcloudservebbsdns-dynamiccloudfrontakamai-stagingipifonyham-radio-opsenseeringclickrisingcommunity-profrom-nylocalcertgrafana-devedgesuite-stagingcloudflareanycasteating-organicatlassian-devmydattofeste-iplocaltotorprojectknx-serveredgekeycloudflareglobalcloudyclustercasacamserveftpakamaized-stagingakamaiorigindns-cloudmyeffectboomlabotdashbuyshousestwmailhetemlazure-mobilein-dslthruhereredirectmedynuddnsbouncemesupabaseluyanicloudappakamaicloudfunctionsdebiannhlfanpgafanstatic-accessin-vpnmysynologymafeloappudohomeftptrafficmanagersiteleafseidatmemsetcloudflarecloudaccesskeyword-onazure-apiis-a-chefdoes-itgets-itwebhopselfiphomeipkicks-assedgesuitewindowsserver-ontunnelmolemydissentscrapper-sitecloudflarecnuni5srcfggffiobbzabchrsndenodynuopikddnsvpndnsakadnselastxkinghostvps-hostfastlyhomeunixazureedgeshopselectdontexistmyfritzcloudjiffyalwaysdatasells-itsquaresbroke-itazurefddattolocalat-band-campmeinforumfamilydsazurestaticappsdefinimabplaceddnsaliasdynaliasnow-dnsblogdnsroutingthecloudendofinternetdsmynasakamaiedgemymediapcadobeio-staticakamaiedge-stagingakamaihd-stagingddns-ipprivatizehealthinsurancelive-onkrellianschokokeksmassivegridmysecuritycamerarackmazeserveminecraftfrom-azis-a-geekakamaizedmoonscaleoffice-on-theusgovtrafficmanageradobeioruntimeedgekey-stagingreserve-onlinechannelsdvrdnsdojousgovcloudappcdn77-sslapps-1and1podzoneazurewebsitesdynathomescaleforceyandexcloudvusercontentisa-geekcdn-edgescoaemalcesappwriteazimuthtlonarvobuiltwithrocketnoticeablestorecomwebrecnetperotherfirminfoartslgdloncogoiltdorgmilcolcomplcschgenngonetedugovbiznamefirmmobiacincoorgmilcomnomwebgobnetintedubizinfocomyspreadshopdemongovtransurl123websitehosting-clusterkhplaycistrongsnesosvalerv\xE5lerxn--vler-qoaossandeheroysandeher\xF8yb\xF8boheroyher\xF8yxn--hery-iraxn--b-5gavalerb\xF8boxn--b-5gasandesandexn--hery-iraxn--vler-qoav\xE5lerh\xE5re\xE5laahavaofsfvfhlolnlalrlhmfmtmahcostntbu\xE5strmreigersundmyspreadshopg\xE1ls\xE1eidsvolltingvollgildeskalflor\xF8vads\xF8vard\xF8vanylvenxn--bhccavuotna-k7astrandaxn--kvnangen-k0axn--sknland-fxaxn--mosjen-eyarakkestadhyllestadnannestadvevelstadvaapstenordre-landsondre-lands\xF8ndre-landtjieltexn--vrggt-xqads\xF8r-aurdalsor-aurdalheradstordmoldefordef\xF8rdeseljefedjeryggehemnexn--krehamn-dxasognegranes\xF8gnebrynetjomevallebykletokkegiskedovretj\xF8mehob\xF8lvoldasaudatolgas\xF8mnaviknad\xF8nnasomnadonnatranafrananesnaraumasmolatr\xE6nafr\xE6nalesjasm\xF8la\xF8rstaorstahitrafloraaukraloppafr\xF8yarissasnasahalsagalsaromsaraisar\xE1isafroyasn\xE5sagronghobolfjelltydal\xE5rdalardalaskimharamkraanghkekr\xE5anghkesorumbarumhurumb\xE6rums\xF8rummodums\xE1l\xE1tb\xE1l\xE1tfrognbjugnv\xE5ganvagangulenskienl\xF8tenlotenstrynvefsnxn--merker-kuaskaunsveiob\xF8mlobomloskj\xE5kvardoflorovadsosalatbalats\xE1latkl\xE6buklabuselbubarduulvikskjakkleppris\xF8rxn--nttery-byaefl\xE5eidflahofmilgolholsellomskifetvikdepvgsfhsaskerrisorhamarasnes\xE5snesr\xF8rosrorosxn--slat-5namasoynaroyvaroyluroydyroyaskoyradoyandoyrodoymeloyrad\xF8yand\xF8yr\xF8d\xF8ymel\xF8yask\xF8ylur\xF8ydyr\xF8ym\xE5s\xF8yv\xE6r\xF8yn\xE6r\xF8yhoylandeth\xF8ylandetdivtasvuodnal\xF8renskoglorenskognesoddtangenxn--tjme-hraxn--smla-hraxn--stjrdal-s1aunjargalillehammerunj\xE1rgaxn--hamary-fyadavvenjargaxn--bearalvhki-y4a123hjemmesidegjerdrumxn--brnnysund-m8acxn--tnsberg-q1axn--mlatvuopmi-s4axn--snsa-roaxn--skierv-utaxn--brum-voatysfjordkvafjordeidfjordkv\xE6fjordsongdalenmjondalenmj\xF8ndalenxn--gls-elackragerog\xE1\u014Bgaviikagangaviikas\xF8rreisasorreisas\xF8r-varangersor-varangerxn--risr-iraskiervaxn--frna-woaxn--trna-woakvinesdalleksvikleirvikr\xF8yrvikroyrviksvelvikvenneslaevje-og-hornnessandnessj\xF8enmarnardalvindafjordsandefjordenebakksnillfjordullensvangxn--trany-yuabr\xF8nn\xF8ysundnamsskoganaustevollxn--stjrdalshalsen-sqbnord-aurdalnord-frontr\xF8gstadtrogstadgrimstadflakstadgjerstadxn--sandy-yuaxn--leagaviika-52bnore-og-uvdalvegarsheixn--rlingen-mxaxn--ggaviika-8ya47hveg\xE5rsheikarlsoykvitsoymasfjordenhamaroyinderoyosteroydavvenj\xE1rgasauheradguovdageaidnuxn--vre-eiker-k8abronnoysiellakkr\xF8dsheradkrodsheradkvinnheradbr\xF8nn\xF8yxn--mtta-vrjjat-k7afxn--lrenskog-54akvits\xF8yv\xE1rgg\xE1tkarls\xF8yoster\xF8yinder\xF8yhamar\xF8ybronnoysundxn--aurskog-hland-jnbbahccavuotnab\xE1hccavuotnagiehtavuoatnastor-elvdalmidtre-gauldalxn--gildeskl-g0akarasjokevenassixn--bievt-0qaxn--yer-znalebesbynessebyxn--hbmer-xqamalselvm\xE5lselvxn--unjrga-rtam\xF8re-og-romsdalmore-og-romsdalhareidmeland\xF8rlandorlandstrand\xE5lg\xE5rdsolundalgardafjord\xE5fjorddielddanuorrikautokeinoxn--stre-toten-zcbskodjeaejriestangeliernebamblestokkefauskesn\xE5asesnaasekongsvingerlangevagberlevagxn--flor-jrahattfjelldalostre-toten\xF8stre-totenvestfoldxn--mely-ira\xE1laheadjualaheadjunordreisaxn--troms-zuaxn--lgrd-poacporsangerflatangerstavangerleikangerbremangersamnangergieldakarasjohkaxn--rdy-0nabfrostautsirasnoasatromsaxn--sr-aurdal-l8aflekkefjordj\xF8lsterjolsteraremarkhedmarkn\xE5\xE5mesjevuemienaamesjevuemiexn--vard-jrarollagmer\xE5kermerakerorskog\xF8rskogxn--bdddj-mrabd\xE1k\u014Boluoktaxn--osyro-wuaaknoluoktatrysilskjerv\xF8ymandaljondalbindalrindalmeldalsuldalorkdalsigdalalvdall\xE6rdalhurdalsirdalverdallerdallardaloppdal\xE5seralaseralhadselkrager\xF8divttasvuotnaoverhallasteinkjerxn--hnefoss-q1askedsmokorsettroms\xF8xn--dyry-iravestre-totenmuseumxn--sandnessjen-ogbrahkkeravjufylkesbiblb\xE1jddarbajddarxn--laheadju-7yarennes\xF8yxn--koluokta-7ya57hxn--hgebostad-g3aleirfjordstorfjordbalsfjordb\xE5tsfjordbatsfjordmuos\xE1tbiev\xE1tloab\xE1tk\xE1r\xE1\u0161johkan\xF8tter\xF8yxn--mjndalen-64anordkappl\xE1hppilahppialstahaugsiljanverranr\xF8ykenroykenhaldenlyngenbergenhortenh\xF8nefosshonefosstroandinbeiarnvarggatosoyroos\xF8yrotromsoidrettmuosatbievatruovatloabatvoagattynsetnessetxn--indery-fyask\xE1nitskanitraholtr\xE5holtxn--ystre-slidre-ujbandebusarpsborgbearduxn--karlsy-fyahordalandjorpelandj\xF8rpelanddeatnuringsakers\xF8r-odalsor-odalxn--slt-elabringerikeaudnedalnittedalnissedalhemsedalslattumsurnadalxn--blt-elabelverumstj\xF8rdalnaustdalhjartdalgj\xF8vikfyresdalhasviknarviklarvikgjovikmalvikgamviklenvikporsgrunnstjordalengerdaldrobakdr\xF8bakxn--msy-ula0hvestvagoyxn--vgan-qoaxn--ryken-vuaxn--lten-graxn--stfold-9xaxn--hpmir-xqaxn--lury-iram\xE1latvuopmimalatvuopmitysv\xE6rkirkenesbirkenesmoskenesb\xE1id\xE1rxn--fjord-lraxn--rdal-poabahcavuotnab\xE1hcavuotnaxn--frde-gralind\xE5sbearalvahkixn--hobl-irar\xE1hkker\xE1vjuxn--loabt-0qav\xE5g\xE5\xE1lt\xE1bod\xF8sundlundrader\xE5deetnetimeholeauregrueoddavagavegaranatanaarnasolasulaaltalekafusavangbergkvam\xE5mliamlibokntinnroangranosenoslobodor\xF8stroststat\xE5motamotivgupriv\xF8yeroyerliermossvossxn--nvuotna-hwalusterlunnermarkerh\xE1bmerhabmerhvalerfjalerxn--rholt-mratysvarbaidarfitjargaularh\xE1pmirhapmirmelhusfosnes\xF8ksnesoksnestysneshemnesevenesflesbergeidsbergtonsbergt\xF8nsberglindasxn--sndre-land-0cbnamsosxn--srum-gra\xF8ystre-slidreoystre-slidrevestre-slidretrondheimbalestrandxn--langevg-jxaaustrheimxn--skjk-soavagsoyaveroysandoykarmoyfinnoytranoyvestbytranbysykkylvenxn--hyanger-q1aspjelkavikandasuoloxn--fl-ziaxn--drbak-wuastathellexn--sr-varanger-ggbtelemarkxn--bhcavuotna-s4axn--porsgu-sta26f\u010D\xE1hcesuolocahcesuoloakrehamn\xE5krehamnsand\xF8ykarm\xF8yfinn\xF8ytran\xF8yv\xE5gs\xF8yaver\xF8ynamdalseidxn--lesund-huabadaddjaxn--vegrshei-c0axn--btsfjord-9zagildesk\xE5lporsanguxn--trgstad-r1an\xE1vuotnanavuotnahammerfestxn--sgne-graxn--brnny-wuacibestadharstadnarviikaeven\xE1\u0161\u0161ivestnesgjemnessandnesagdenesrennesoyxn--avery-yuaxn--tysvr-vrabearalv\xE1hkikongsbergspydebergrandabergxn--andy-iradavvesiidaxn--krdsherad-m8apors\xE1\u014Bgufredrikstadbjerkreimringeburennebuaurskog-holandnotteroyxn--vgsy-qoa0jxn--rmskog-byaskierv\xE1ivelandbyglandfrolandaurlandforsandxn--bjddar-ptamidsund\xE5lesundalesundfetsundfarsundovre-eiker\xF8vre-eikerakershusxn--moreke-juas\xF8rfold\xF8stfoldostfoldsorfoldh\xF8yangerhoyangerlevangerorkangertanangerxn--vestvgy-ixa6olillesandulsteinxn--rennesy-v1agranvinskjervoyxn--klbu-woalavagisxn--h-2faxn--ryrvik-byakafjordk\xE5fjordseljordfolkebiblxn--gjvik-wuajevnakerxn--kfjord-iuabudejjuxn--kranghke-b0axn--davvenjrga-y4axn--rland-uuaxn--ldingen-q1axn--mlselv-iuaxn--rady-iraxn--linds-prabrumunddalxn--ygarden-p1amo-i-ranaeidskogr\xF8mskogromskoghjelmelandxn--finny-yuaxn--sr-odal-q1axn--skjervy-v1aballangenkvanangenkv\xE6nangengratangenxn--hmmrfeasta-s4acvossevangensuohkanxn--rde-ulaxn--mli-tlaxn--ksnes-uuanordlandskanlandsk\xE5nlandsortlandfuoiskuxn--rros-graxn--hcesuolo-7ya35bxn--eveni-0qa01gagaivuotnag\xE1ivuotnaxn--seral-lradrammenmodalenmosjoenjan-mayentorskensteigengloppenxn--snes-poamatta-varjjatxn--sr-fron-q1aomasvuotnajessheimb\xE5d\xE5ddj\xE5xn--krager-gyaxn--kvfjord-nxaxn--asky-iraxn--snase-nraxn--bidr-5nacholt\xE5lenxn--vads-jraxn--jlster-byamosj\xF8enxn--rst-0nastavernxn--ostery-fyaxn--oppegrd-ixaxn--sknit-yqaxn--risa-5naoppeg\xE5rdskiptvetrendalenholtalenxn--mot-tlaxn--lhppi-xqaxn--holtlen-hxaxn--srreisa-q1akopervikxn--muost-0qaxn--bmlo-grahokksundkvalsundegersundxn--karmy-yuaullensakerxn--hylandet-54axn--kvitsy-fyaxn--bod-2nalangev\xE5gberlev\xE5gkristiansandxn--rsta-frahornindalstj\xF8rdalshalsenstjordalshalsensandnessjoenh\xE1mm\xE1rfeastaxn--lrdal-sras\xF8r-fronsor-fronnord-odalkristiansundm\xE1tta-v\xE1rjjatvestv\xE5g\xF8ynesoddennotoddenbuskerud\xF8ygardenoygardensalangenlavangenralingenr\xE6lingenlodingenl\xF8dingenlea\u014Bgaviikalaakesvuemieleangaviikauenorgexn--srfold-byaaskvollxn--rskog-uuaxn--nry-yla5gxn--vry-yla5ghammarfeastaxn--rhkkervju-01afxn--givuotna-8yakommunekrokstadelvanedre-eikerhagebostadh\xE6gebostadxn--berlevg-jxakviteseidxn--s-1faxn--l-1faxn--nmesjevuemie-tcbafuosskomo\xE5rekemoarekexn--lt-liacxn--jrpeland-54asvalbardoppegardholmestrandtvedestrandsogndalsokndalarendalsunndalfolldalxn--krjohka-hwab49jlyngdaletnedalnorddalsaltdalgausdalskedsmovaksdalgjesdalstordalxn--frya-hraaarbortedrangedalxn--smna-graaurskog-h\xF8landxn--vg-yiabtjeldsundhaugesundlindesnesxn--mre-og-romsdal-qqbxn--dnna-gradyntmpheremerseineshacknetenterprisecloudmineaccomaorim\u0101oriorgmilcriiwigennetschoolhealthkiwigovtgeekxn--mori-qsacloudnsparliamentcomedorgcompronetedugovmuseumwebsitekinservicebarsywebsitebuildereerobookheimdnsleapcelleero-stagetechcrscsslorigingohomecdbedeeeiemesecabgngilnlalplchfisiincnnoroptatitmtltruauhulumkdkukskjplvtrgrfrkrhrusesismycynzcznetinteduassoososcloudstgbetaaezaeuhkusjswzhatenadiarycdn77hoptozaptois-a-knightmyftpno-ipjpnddnssdpdnsspdnsbarsysweetpepperis-a-bruinsfanis-very-sweetservegameis-a-soxfanhomelinuxcdn77-secureservebbsmisconfusedwebredirectblogsitefreedesktopcouchpotatofriestoolforgeaccesscamis-lostreadmyblogsmall-webfedorapeopleserveftpis-a-celticsfanmywirepotagertwmailin-dslsellsyourhomeread-booksfreeddnscable-modemis-savednflfanufcfanmlbfanstuff-4-saleendoftheinternetin-vpnmy-firewallhomeftpis-localis-a-chefboldlygoingnowherewebhopselfipkicks-assroxatunkcamdvrfedoraprojectgotdnsdvrdnsdyndnspubtlspimientahomeunixdontexistfedorainfracloudwmflabsfspagesbmoattachmentsteckidsfamilydsdnsaliasdynaliasnow-dnscloudnsdoomdnsduckdnsblogdnshomednsroutingthecloudendofinternetdsmynasip-dynamicpoivronhttpbinmyfirewallis-very-evilmysecuritycamerais-a-linux-userwmcloudis-a-geektuxfamilyis-a-candidatedoesntexistis-very-badhobby-sitegame-hostaltervistais-foundis-a-patsfandnsdojohepforgepodzonedynservcollegefanis-very-goodfrom-meis-very-niceisa-geeknerdpolacmedsldingorgcomnomgobabonetedupleskaemhlxmyboxrockyprvcydeuxfleursvibekitprodomgspdnscodebergheyflowstatichostlinkyhostmymagicorgmilcomnomgobneteduorgcomeduiorgmilcomngonetedugovcloudns1337ngrokacorggogfamcomwebgobnetedugokgopgkpgovgosbizpasaugumicsopozpapuwmwsrprusiskwpspkppspkmpspokeoiawsawifoumsdnskokwpmuppuppsppiwwiwoowuzswkzoschrzpisdnwzmiuwwitdpssewsseumigugimoirmpinbwinbwiihupporzgwgriwupowwskrwioswuozstarostwokonsulattmpccopruszkowmyspreadshopostrodakartuzyopolegminamediaustkazgorajgoraolawailawalomzawloclradombytomjaworznotargilubinkoninzagantorunkutnokepnonakloczestsopotsanokturekplockslasksklepzarowlukowmedaidgdaorgmilrelcomnomatmgsmartneteduelkgovwawsossexbiztgorysejnytychypomorzeboleslawiechomesklepsdscloudunicloudzakopanelegnicarawa-mazbydgoszczswidnikkrasnikwloclawekbielawamragowograjeworealestatebeskidykaszubymalopolskaprzeworskswiebodzinlecznadfirmaszkolawarmiagdyniamiastakazimierz-dolnymalborkswidnicadlugolekaostrolekapodlasieelblagtravelsimplesitezachpomormielecszczecinnieruchomosciwalbrzychlezajsklublinbedzinpoznanwielunmielnooleckostarachowicedkontopowiatwroclawrybniksuwalkileborkslupskgdanskostrowwlkptarnobrzegtourismwegrowkrakowglogowyou2pilanysamailwrocinfoagroautobeepshoppriviqhslapypiszlodzcfolksecommerce-shopmazurypulawyskoczowrzeszowpomorskiezgierzkaliszolkuszlowiczostrowiecsosnowiecmazowszewodzislawbialowiezazgorzeleckatowicepabianicejelenia-gorawolominkarpaczsieradznowarudaczeladzkonskowolaskierniewiceswinoujscieturystykabieszczadycieszynketrzynolsztynbialystokbabia-goraprochowicewarszawastalowa-wolapolkowicegorlicegliwiceponiatowalimanowalubartowaugustowkobierzyceopocznognieznoszczytnokolobrzegshoparenapodhalebielskoklodzkostargardcoshipatwithplayitownnamecoorgnetedugovacorgcomproestnetedugovbiznameislaprofinforechtngrokmedaaaacacpaenglawjurbarbarsykeeneticavocatacctcloudnsorgcomsecplonetedugov123paginaweborgcomnetintedugovnomepublidkinbarsygovx443cloudnsorgmilcomnetedugovcooporgmilcomschnetedugovnamecomcannetlibassoaemclantmcontstoreorgcomnomrecwwwbarsyfirminfoshopartsv6stackitmyddnswebspacelima-cityacincooxorgedugovbarsybrendlyhbvpsvpsspectrumlandinghostingacppmordoviamcprecbgorgmilcomspbnetintedumsknovgovbirrasmcdirmytismircloudvladimirnalchikadygeyamarinepyatigorskmyjinobashkiriaeurodirvladikavkazna4ugroznykustanaikalmykiacldmaildagestaniransmbuildcloudcanvaliaravalrwxwixdevelopmentappwritemigrationneedleverceldatabasestackitcodereplravendbsanityonporterlovableaccoorgmilnetgovcoopmedorgcompubschnetedugovservicemecomygovorggovtvmedorgcomnetedugovinfoedgfacbmlonihkutwpsryxzbdtmacfhppmyspreadshopbrandpartiorgcomfhvpress123minsidaitcouldbeworlanbibkommunalforbundfhskiopsyskomvuxkomforbnaturbruksgymnloginlineorgcomnetedugovenscaledeuusentsurgebotdaorgmilcomnetgovnowteleporthashbangbearlyplatformlovablebarsyshopwarebasehoplixbarsyonlinemsf5gitpagewawamscofigma-govcaffeinefigmacanvasoltstscwputerbarsysupportchatgptsquareomniweopensocialcpanelplaycodenotionnovecorewpsquaredpreviewjelecyonbyensrhtfastvpspieboxconvexmedusajsjouwwebheyflowplatformshdocsflowyloginlinemadethissourcecraftclouderaorgorgcomartedugouvunivmeorgcomnetedugovsurveysstatichfheiyumanusxs4allprojectmyfastubervibehostapp-ionosdeployagentmecoorgcomschnetedugovbizcncostoreorgmilcomneteduembaixadaconsuladokiraranohoprincipesaotomeheliohobarsystorebaseshopwaresellfyaisanityabkhaziavologdamordoviapenzalenugsochinavoiexnetspbmsknovnorth-kazakhstanashgabadkareliaarmeniageorgiavladimirnalchikivanovobukharaadygeyakhakassiakalugakrasnodarjambylaktyubinsktroitskbryanskobninskkurganazerbaijanpokrovskbashkiriatselinogradvladikavkazmurmansktulatuvamangyshlaktashkentchimkentgroznykaragandatermezarkhangelskkustanaikalmykiabalashoveast-kazakhstankaracoldagestantogliattibarsyredorgcomgobedumirenaccoorgjelasticdiscoursecleverappsschacmiincogoornetonlineshopcogoorgmilcomwebnicnetintedugovbiznametestcoorgmilcomnomnetedugovorangecloudpersoindorgcomfinnatnetgovensmincomtourismintlinfox0611orgmilcomnetedugovquickconnectvpnplusnettprequalifymeaddrmyaddrntdllwadlnctvavdrk12orgmilpolbeltelcomwebgennetedutskkepgovbbsbiznameinfocoorgmilcompronetedugovbiznameinfobetter-thanworse-thansakurafromdyndnson-the-webmymailerorgmilurlcomneteduidvgovmydnsgameclubebizmeneacsccogotvorhotelmilmobiinfovodteiflgplkmsmsbcckhincndnvncoztltmkckppzpdprvcvkvlvcrkrkscxuzchernovtsyrivneyaltaodesavolynrovnolutskltdinforgcomnetedugovbizvinnicazhitomirternopilpoltavakropyvnytskyizaporizhzhiasevastopolsebastopoluzhgoroduzhhorodkharkovkharkivvinnytsiakhmelnytskyizaporizhzhecrimeaodessazhytomyrnikolaevcherkassydonetskluganskluhanskkirovogradivano-frankivskchernivtsikrymkievkyivlvivsumyzakarpattiamykolaivcherkasychernigovkhersonchernihivdnipropetrovskdnepropetrovskkhmelnitskiyneacsccogoorusorgmilcomedugovmyspreadshopadimono-ipbarsybarsyonlinelayershiftnh-servretrosnubapicampaignservicelugaffinitylotteryweeklylotteryraffleentrygluglugsmeaccoindependent-inquestnimsitecopropymntltdorgplcschnetgovnhsbarsyindependent-commissionindependent-reviewpolicepublic-inquiryindependent-panelconnhospindependent-inquiryroyal-commissionoraclegovcloudappscck12libaws-govccphxcclibpvtparochchtrcck12libcceatonk12coglibtecgendstmusann-arborwashtenawcck12glghcck12sealibforksolympiabainbridge-islkeyporthoquiamyarrow-pointcentraliaport-townsendsequimport-ludlowrentonsilverdalebremertonredmondsheltonbellevueport-orchardport-angeleskingstonchehalisaberdeengig-harborseattlepoulsboidmdndsddemenegacalamaiavawapailalflnmdcncscohnhmihiviwiriinmntnmocoutvtctmtgunjokakwvnvprarorasmskstxwynykyazisadninsnngosrvis-bymircloudservernamepointtoenscaledland-4-salefreeddnsstuff-4-saleazure-apinoipdatabricksappscloudnsgolffanheliohostazurewebsitesgvorgmilcomgubneteducoorgcomnetd0egvorgmilcomnetedugovmydnsiacostoree12orgmilcomnomwebgobbibrectecnetintedugovraremprendefirminfoartseducok12orgcomnethidnsadidacaionioapsonlahanamhanoicamauhueorgcompronetintedugovbizbacninhtayninhhoabinhnamdinhtravinhhaiphongvinhlonghaiduongquangnamquangtrithuathienhuequangninhbacgianghaugiangquangbinhsoctrangbentrethanhphohochiminhdanangkontumhatinhkhanhhoathanhhoahealthgialailaocaiyenbaibackanngheanlonganphuyenphuthocanthodaklakdongnainameinfovinhphucdongthapkiengiangtiengiangquangngailaichaulangsonlamdongdaknonghagiangangiangcaobangbinhduongninhthuanbinhthuanbaclieuthaibinhninhbinhbinhdinhtuyenquanghungyenbaria-vungtauthainguyendienbienbinhphuocschbizputerorgcomnetedugovcloud66advisormypetsdyndnsxn--8dbq2axn--4dbgdty6cxn--5dbhl8dxn--hebda8bxn--80auxn--d1atxn--c1avgxn--o1acxn--o1achxn--90azhxn--55qx5dxn--uc0atvxn--od0algxn--wcvs22dxn--gmqw5axn--mxtq1mxn--12c1fe0brxn--h3cuzk1dixn--12co0c3b4evaxn--12cfi8ixb8lxn--o3cyx2axn--m3ch0j3axn--j1adpxn--90amcxn--90a1afxn--h1ahnxn--j1ael8bxn--h1alizxn--c1avgxn--j1aefxn--80aaa0cvacxn--41acaffeineexeopentunnelbotdashtelebitorgtmaccoagricorgmilnomwebnicngonetaltedugovlawnisschoolgrondaraccoorgmilcomschnetedugovbizinfoprg1-zeropstritonstackitlimazeropsaccoorgmilgov\u044F\u0441\u043F\u0431\u043E\u0440\u0433\u043A\u043E\u043C\u043C\u0441\u043A\u0431\u0438\u0437\u043C\u0438\u0440\u0441\u0430\u043C\u0430\u0440\u0430\u043A\u0440\u044B\u043C\u0441\u043E\u0447\u0438\u0430\u043A\u043E\u0434\u043F\u0440\u043E\u0440\u0433\u043E\u0431\u0440\u0443\u043F\u0440\u05E6\u05D4\u05DC\u05DE\u05DE\u05E9\u05DC\u05D9\u05E9\u05D5\u05D1\u05D0\u05E7\u05D3\u05DE\u05D9\u05D4\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23\u0E18\u0E38\u0E23\u0E01\u0E34\u0E08\u0E23\u0E31\u0E10\u0E1A\u0E32\u0E25\u0E28\u0E36\u0E01\u0E29\u0E32\u0E17\u0E2B\u0E32\u0E23\u0E40\u0E19\u0E47\u0E15\u6559\u80B2\u7DB2\u7D61\u7D44\u7E54\u516C\u53F8\u653F\u5E9C\u500B\u4EBA\uB2F7\uB137\uD55C\uAD6D\u6FB3\u95E8\u65B0\u95FB\u6FB3\u9580\u8054\u901A\u5BB6\u96FB\u5609\u91CC\u62DB\u8058\u901A\u8CA9\uB2F7\uCEF4\uC0BC\uC131\u30B3\u30E0\u10D2\u10D4\u0431\u0433\u0440\u0444\u0435\u044Eadcdbdgdidmdsdtdaebedeeegeiejekemenepereseveyegabacalamanauavapaqasazacfbfafgfnfpfwftfbgcgagggegkgngmgsgpgvgtgugilmlnlalclglplsltlhmimjmkmmmomambmcmdmfmgmzmpmsmtmgbbblbsbecccacnclcmcvctcscmhkhghchbhthphshlinikifigiaibicivisikninhnmncnbngnsnpnvntnjoionomobocoaofodorosotoptstttytatbtetgtithtmtltrusuvuaucueuguhulumunufjdjbjtjsjlkmkhkfkdkcktkukskpkgpmpnpkpjpgqaqmqiqsvtvcvbvmvlvrwpwtwzwbwcwawgwkwmwtrsrprgrfrercrbrarnrmrlrkrirhrwsusrssspsgsesbsaslsmsissxmxaxcxuypysylymykygybycyuztzsznzmzkzdzczbzaz\u03B5\u03BB\u03B5\u03C5\u4E16\u754C\u53F0\u7063\u8D2D\u7269\u516C\u76CA\u70B9\u770B\u81FA\u7063\u7F51\u7EDC\u66F8\u7C4D\u5728\u7EBF\u7F51\u7AD9\u624B\u673A\u673A\u6784\u5927\u62FF\u6E38\u620F\u4FE1\u606F\u53F0\u6E7E\u8C37\u6B4C\u6148\u5584\u5546\u6807\u9999\u6E2F\u4E2D\u56FD\u9910\u5385\u7F51\u5740\u4E2D\u570B\u5546\u57CE\u98DF\u54C1\u5FAE\u535A\u653F\u52A1\u79FB\u52A8\u96C6\u56E2\u516C\u53F8\u516B\u5366\u5546\u5E97\u5065\u5EB7\u7F51\u5E97\u653F\u5E9C\u65F6\u5C1A\u4F5B\u5C71\u4E2D\u4FE1\u5A31\u4E50\u5E7F\u4E1C\u4F01\u4E1Ahomedepotengineering\u0627\u0645\u0627\u0631\u0627\u062Arepublicankuokgroupversicherungchannelcitadelxn--pgbs0dhxn--b4w605ferdstatebankwebsitexn--mgb9awbf\u4E9A\u9A6C\u900A\u6DE1\u9A6C\u9521alibabaxn--ngbc5azdxn--mgbbh1axn--45br5cyltoshibabuildworldcloudtradeguideplacespacedancemoviephoneprimesmilebiblestyleappleazurestoreskypegripexn--l1accdrivelottehorsehouseleasechasereisestadahondaomegaaetnaamicaninjanokiamediadeltavodkaedekaosakapizzaslingemailgmailtirolshelltmallfinallegaltotalhotelamfamforumrehabmusicciticricohcoachwatchboschearthfaithirishmiamiarchidubaiguccipraxi\u307F\u3093\u306A\u30B9\u30C8\u30A2\u30BB\u30FC\u30EBcanonsalononionnikonepsonkoelngreensevencrownikanoradioaudioweiboglobopromogalloyahoociscorodeovideomangobingotokyovolvolottokyotophotosmartsportquesttrusthyattjetztadultcymrubaidutushuxn--kprw13dubankclickblackmerckgroupsharpcheapnowtvxn--h2brj9c\u05E7\u05D5\u05DD\u0570\u0561\u0575\u043E\u0440\u0433\u0441\u0440\u0431\u043C\u043E\u043D\u043A\u043E\u043C\u0431\u0435\u043B\u043C\u043A\u0434\u049B\u0430\u0437\u0440\u0443\u0441\u0443\u043A\u0440\u0645\u0635\u0631\u0642\u0637\u0631\u0639\u0631\u0628\u0643\u0648\u0645dadcfdmedwedredphdthdbidpidkrdmsdltdiceonewmeglemoerwecfageacbanbambaaaammakianraspacpaaxawtfbcgaegongingaigvigorgdogdhlmilrilonlaolloluoljllcalgalnflafltelsrlfrllplkimibmcamcombommomifmabbjcbscbwebcabnabtabmlbpubabcbbcnecincpncllcstcwtcpwcnyckfhbzhovhmoiskiobisbitcifyituipinvinwinxincbnbcnmanfangdnmenrenkpnmtnyunrunfununobiojioriohbogmofooboooooacoecoceongoproartistottnttbbtcateatlatvetpetbetnethktmitfitintjothotgotdotbotprueduicujnjyouinknhktdkappsapgapmapdnptopgopllpjmpzipvipripesqtrvdtvitvdevmovgovhivnrwlawsewnewbmwwownowhowdvrftrmtrsfrbarcartvscrseusawsupsubssbsadsddsldssasbmsmlsxxxboxfoxgmxtjxsextaxbuyflydiysoyjoyskypaydaygayxyzanzbizwebersenerpokerlameractortatarsolar\u0EA5\u0EB2\u0EA7\u0E04\u0E2D\u0E21\u0E44\u0E17\u0E22tourslocusnexuslexusgiftsbeatsboatspartspressglassswiss\u0915\u0949\u092E\u0928\u0947\u091Ftiresgivescodeshomesgamestunesshoescardswalesloansvegastoolsdealsautosparis\u30D5\u30A1\u30C3\u30B7\u30E7\u30F3workssucksrocksxeroxforexfedexpartylillymoneystudyrugbytoraytoday\u4E2D\u6587\u7F51xn--unup4y\u5929\u4E3B\u6559\u98DE\u5229\u6D66\u65B0\u52A0\u5761enterprises\u6211\u7231\u4F60\u5609\u91CC\u5927\u9152\u5E97christmasxn--fct429kholdingsxn--8y0a063axn--mgbx4cd0ablifestyleabogadoallstatenetbank\u0643\u0627\u062B\u0648\u0644\u064A\u0643xn--s9brj9cxn--gk3at1ebestbuycharityxn--55qx5dmicrosoftpropertybasketballhomegoodscorsicajewelrygallerygrocerysurgerycountrybrusselsverisignferreroxn--czr694bhdfcbankcommbanksoftbank\u067E\u0627\u0643\u0633\u062A\u0627\u0646\u067E\u0627\u06A9\u0633\u062A\u0627\u0646nextdirect\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0647\u0627\u0644\u0639\u0644\u064A\u0627\u0646xn--h2brj9c8cxn--80adxhksshikshaxn--mgbai9azgqp6jcuisinellabarclayscatholicxn--kpry57dcompanyxn--xhq521bblackfridayxn--mgba3a3ejtsandvikxn--d1acj3bacademydownload\u0645\u0644\u064A\u0633\u064A\u0627xn--j1amhxn--w4r85el8fhu5dnraipirangaathletaxn--fhbeixn--mgbqly7cvafrzuerichxn--c2br7g\u0B87\u0BB2\u0B99\u0BCD\u0B95\u0BC8contractorsxn--io0a7igraphicsinsurancetemasekxn--xkc2al3hye2amotorcyclesphotographydirectoryplumbingxn--vhquvclothingtrainingcleaningwilliamhilllightingxn--mgba3a4f16ashoppingcateringeducationokinawapicturesventuresproductionsxn--9et52uwalmart\u0D2D\u0D3E\u0D30\u0D24\u0D02supportrealestatecapitalonexn--nqv7fs00emaauspostfloristdentistxn--qxamgodaddybradescobargainsmitsubishikerryhotelsxn--9dbq2axn--3pxu8kimmobilienxn--fjq720axn--mgbtx2bholidaymckinseymadridbusinessbuildersxn--4gbrim\u043C\u043E\u0441\u043A\u0432\u0430\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u0629coffeedegreelacaixapartnersalsaceofficeabbvievoyageorangegeorgeonlinechromemobilekindlegoogleoraclecircleschulesecureinsurexn--mgba7c0bbn0aestatexn--mgbc0a9azcgcruisehangoutxn--vuq861bxn--42c2d9arexrothfirestoneuniversityxn--nnx388alifeinsuranceextraspace\u043E\u043D\u043B\u0430\u0439\u043Dverm\xF6gensberatersoftwarexn--fiqs8sxn--mgbab2bdxn--w4rs40ltienda\u092D\u093E\u0930\u0924\u092E\u094Dafricatoyotaotsukasakuracameracreditcardnagoyaconsultingnetworktheatermonsterprogressivepioneerxn--55qw42gracingdatingvotingvikinglivinggivingxn--bck1b9a5dre4cbrotherweatherjoburg\u0641\u0644\u0633\u0637\u064A\u0646lplfinancialxn--clchc0ea0b2g2a9gcdfutbolschoolsocialglobaldentalwoodsidechanelairtelmatteltravelrealtorwebcamstream\u0C2D\u0C3E\u0C30\u0C24\u0C4Dunicomalstomxn--nodexn--6frz82gmuseumfurniturexn--rvc1e0am3exn--mix891faccenturexn--11b4c3dismailineustardiscountquebeccomsecclinicservicesxn--y9a3aqxn--c1avgswatchchurchsearch\u0627\u0644\u0627\u0631\u062F\u0646marketingcontacthealthmonashshoujisanofitaipeiamericanexpresssuzuki\u30A2\u30DE\u30BE\u30F3\u30AF\u30E9\u30A6\u30C9\u30DD\u30A4\u30F3\u30C8bharti\u30B0\u30FC\u30B0\u30EBxn--mgberp4a5d4armemorialxn--1qqw23alondonmormoninstitutevisionbostonnortoncouponmaisonamazonvirginberlindesigndurbanolayannissananquanxihuanhitachikaufengardenreisenbayerntechnologydatsunxn--90a3aclatinocasinostudiophysioxn--ngbe9e0apharmacytattootaobaoaramcoexpertreportabbottdirectselectimamatfairwindspictettargetmarketintuittravelersinsurancecreditdupontryukyusuppliesxn--tckwebnpparibasschmidtmerckmsdyodobashirestaurantbridgestonecricketxn--fpcrj9c3dbostikbroadwayattorneylefrakemerckxn--fiq228c5hscareersfarmerswinnersflowersxn--wgbh1cguitarsxn--54b7fta0ccxn--p1acfmakeupgalluplandroverxn--kcrx77d1x4agoldpointbauhausxn--mgbayh7gpahiphopplaystationxn--mgba3a4fraxn--eckvdtc9dhyundaixn--gckr3f0fistanbulticketsmarketsflightschintaireviewsxn--3e0b707ewindowsxn--fiqz9sfinancialxn--fzys8d69uvgm\u0627\u0628\u0648\u0638\u0628\u064Adiscoverreview\u09AC\u09BE\u0982\u09B2\u09BExn--5su34j936bgsgmoscowobserverapartments\u0434\u0435\u0442\u0438\u0627\u0631\u0627\u0645\u0643\u0648\u0441\u0430\u0439\u0442eurovisionxn--i1b6b1a6a2exn--xkc2dl3a5ee0h\u062A\u0648\u0646\u0633\u0645\u0648\u0642\u0639\u0628\u0627\u0631\u062A\u0680\u0627\u0631\u062A\u0634\u0628\u0643\u0629\u0639\u0645\u0627\u0646\u0628\u064A\u062A\u0643\u0639\u0631\u0627\u0642readkredbondlandbandfundfoodprodgoldfordtubecafesafelifeggeeieeefreefagepagegugezonewinememenamegamesaleablebikenikelikecarecbreherefiresaveloveliveblueartedatesitevotecaseluxebofamodaltdaasdatiaayogasinavanashiaasiajavabbvatevavivadatazaraarpacasavisasncfprofmaifsurfgolfdvagsongbingpingwangkpmggoogblogpohlfailcooldellcalldeallidlsarlfilmteamroomfarmimdbarabclubhdfcicbchsbcgmbhrichtechfishdishcashminiernikddiaudiwikimobitaxicitikiwidesiqponskinloanakdnwienopenporncerntownimmolimoolloinfonicofidolegosaxozeroaerovivoautovotomotofastbestresthostpostnextlgbtchatseatgiftmeetdietreitmintrentgentspotscotguruitausohumenucyoubanklinkpinkdclktalksilkbookseekworkrsvpaarpjeepshopcoophelpcamppccwshowbeerstarruhrflirweirhaircarsparsjprshausplusnewstipstoysjobskidsfanspicsdocsxboxamexsexynavycitysonyarmyallybabyplaydeliverybuzzgbizlamborghiniphilips\u0DBD\u0D82\u0D9A\u0DCF\u0CAD\u0CBE\u0CB0\u0CA4fitnessexpresslanxesspfizercenterwalterlawyersoccercareerkosherbrokerlockerdealerdoctorauthorxn--mgbqly7c0a67fbcverm\xF6gensberatungjaguarxn--pssy2uxn--hxt814eflickrrepairrogersairbusxn--mgbai9a5eva00beventsyachtsxn--t60b56a\u09AD\u09BE\u09F0\u09A4\u09AD\u09BE\u09B0\u09A4\u092D\u093E\u0930\u0924\u092D\u093E\u0930\u094B\u0924viajeshermeshughesxn--j1aef\u0938\u0902\u0917\u0920\u0928villas\u0B2D\u0B3E\u0B30\u0B24claimshotels\u0AAD\u0ABE\u0AB0\u0AA4zapposphotosjuegoscondostatamotorsgratistennis\u0A2D\u0A3E\u0A30\u0A24tkmaxxtjmaxxschaeffleryandexxn--80aswgrealtysafetybeautyluxuryxn--3ds443gsupplyfamilyxn--o3cw4hhockeysydneyxn--90aenissayalipayenergycomputeragencyxn--rovu88b\u96FB\u8A0A\u76C8\u79D1xn--gecrj9cstatefarmaccountantaquarelleolayangroup\u9999\u683C\u91CC\u62C9xn--p1ai\u7EC4\u7EC7\u673A\u6784xn--1ck2e1bxn--mgbt3dhdschwarz\u0645\u0648\u0631\u064A\u062A\u0627\u0646\u064A\u0627abudhabinowruzkomatsufujitsuhospitalxn--80asehdbxn--mgbtf8flxn--j6w193gxn--yfro4i67oprudentialxn--flw351ecruisescoursesrecipesxn--e1a4cferrarixn--ses554gxn--wgbl6awatchesstaplessinglesxn--mgbcpq6gpa1axn--otu796dpropertiescreditunionxn--mgbah1a3hjkrdstockholmhisamitsu\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629stcgroupdomainsoriginscouponsbloombergclubmedfroganslimitedxn--80aqecdr1aexposedinternationalequipmentbarclaycardxn--q7ce6axn--mgbi4ecexpprotectionassociatesconstructionxn--cck2b3bxn--45q11candroidfoundation\u05D9\u05E9\u05E8\u05D0\u05DCxn--mgbca7dzdocliniqueboutiqueengineerxn--qxa6asystemsfirmdalefashionauctionxn--nqv7finfinitirentalsreliancetradingweddingfishinghostinggentingbookingcookingxn--3hcrj9cgraingerxn--czrs0tdemocratsamsungyokohamaxn--h2breg3evexn--nyqy26alundbeckmelbournevacationssolutionsfrontierxn--vermgensberatung-pwbmanagementxn--cg4bkixn--mgb2ddeslincolnhamburgsandvikcoromantblockbusterairforcebarefootxn--4dbrk0ceinvestmentsfeedbackcommunityxn--ngbrx\u0627\u0644\u0628\u062D\u0631\u064A\u0646diamondsamsterdamhealthcareredumbrellaxn--mxtq1mxn--2scrj9cagakhanxn--mgbpl2fh\u043A\u0430\u0442\u043E\u043B\u0438\u043Acaravan\u0B9A\u0BBF\u0B99\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0BC2\u0BB0\u0BCDrichardlimortgageamericanfamilyxn--fzc2c9e2cscholarshipssaarlandxn--imr513nvlaanderensamsclubgoodyearkitchen\u0B87\u0BA8\u0BCD\u0BA4\u0BBF\u0BAF\u0BBEweatherchannelallfinanzxn--kput3i\u0627\u0644\u0633\u0639\u0648\u062F\u06CC\u06C3xn--90aisxn--efvy88h\u0627\u0644\u062C\u0632\u0627\u0626\u0631xn--mgbaam7a8hexchangejpmorganxn--tiq49xqyjfidelitysecurityxn--mk1bu44cwanggouxn--fiq64bxn--6qq986b3xlxn--mgbbh1a71exn--80ao21amarshallsxn--5tzm5gtravelerspanasoniclatrobeyoutubeaccountantsxn--rhqv96gxn--cckwcxetdanalyticsxn--ygbi2ammx\u0628\u0627\u0632\u0627\u0631\u0628\u06BE\u0627\u0631\u062A\u0633\u0648\u0631\u064A\u0629organicfresenius\u0633\u0648\u0631\u064A\u0627xn--9krt00axn--qcka1pmcxn--jlq480n2rgdeloittesciencefinancexn--jvr189mxn--30rr7yhomesensehotmailbaseballfootballleclercboehringerxn--q9jyb4cxn--mix082f\u0627\u0644\u064A\u0645\u0646\u0647\u0645\u0631\u0627\u0647politie\u0633\u0648\u062F\u0627\u0646\u0627\u064A\u0631\u0627\u0646\u0627\u06CC\u0631\u0627\u0646netflixyamaxunxn--lgbbat1ad8jcollegestoragecapetowncolognekerrypropertiesxn--mgbgu82axn--ogbpf8flxn--czru2dwhoswhociprianilasallexn--g2xx48cforsalebanamexaudiblexn--vermgensberater-ctbxn--zfr164bericssonvanguardxn--45brj9cindustriestheatremarriottxn--3bst00mcomparexn--mgberp4a5d4a87gcapitaldigital\u0627\u0644\u0645\u063A\u0631\u0628barcelonashangrilaxn--d1alfcalvinkleinwwwcitysapporokawasakinagoyasendaikobekitakyushuyokohamackjp";
  var rulesRoot = 663;
  var exceptionsRoot = 667;

  // node_modules/tldts/dist/es6/src/suffix-trie.js
  var numberOfNodes = nodeFlags.length;
  var numberOfEdges = edgeLength.length;
  var edgeOffset = new Uint32Array(numberOfEdges);
  var edgeHash = new Uint32Array(numberOfEdges);
  var wildcardEdge = new Int32Array(numberOfNodes).fill(-1);
  for (let node = 0, offset = 0; node < numberOfNodes; node += 1) {
    for (let edge = edgeStart[node]; edge < edgeStart[node + 1]; edge += 1) {
      edgeOffset[edge] = offset;
      const end = offset + edgeLength[edge];
      let hash = 5381;
      for (let i = end - 1; i >= offset; i -= 1) {
        hash = hash * 33 ^ labelText.charCodeAt(i);
      }
      edgeHash[edge] = hash >>> 0;
      if (edgeLength[edge] === 1 && labelText.charCodeAt(offset) === 42) {
        wildcardEdge[node] = edge;
      }
      offset = end;
    }
  }
  var matchNode = -1;
  var matchStart = 0;
  var matchEnd = 0;
  function labelEquals(edge, hostname, start2, length) {
    if (edgeLength[edge] !== length) {
      return false;
    }
    const offset = edgeOffset[edge];
    for (let i = 0; i < length; i += 1) {
      if (labelText.charCodeAt(offset + i) !== hostname.charCodeAt(start2 + i)) {
        return false;
      }
    }
    return true;
  }
  function findEdge(node, hash, hostname, start2, length) {
    let lo = edgeStart[node];
    let hi = edgeStart[node + 1];
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      const value = edgeHash[mid];
      if (value < hash) {
        lo = mid + 1;
      } else if (value > hash) {
        hi = mid;
      } else {
        for (let e = mid; e >= lo && edgeHash[e] === hash; e -= 1) {
          if (labelEquals(e, hostname, start2, length))
            return e;
        }
        for (let e = mid + 1; e < hi && edgeHash[e] === hash; e += 1) {
          if (labelEquals(e, hostname, start2, length))
            return e;
        }
        return -1;
      }
    }
    return -1;
  }
  function walk(hostname, root, allowedMask) {
    let node = root;
    let end = hostname.length;
    let hash = 5381;
    matchNode = -1;
    for (let i = hostname.length - 1; i >= 0; i -= 1) {
      const code = hostname.charCodeAt(i);
      if (code === 46) {
        const start2 = i + 1;
        let edge2 = findEdge(node, hash >>> 0, hostname, start2, end - start2);
        if (edge2 === -1 && end !== start2) {
          edge2 = wildcardEdge[node];
        }
        if (edge2 === -1) {
          return matchNode !== -1;
        }
        node = edgeChild[edge2];
        if ((nodeFlags[node] & allowedMask) !== 0) {
          matchNode = node;
          matchStart = start2;
          matchEnd = end;
        }
        end = i;
        hash = 5381;
      } else {
        hash = hash * 33 ^ code;
      }
    }
    let edge = findEdge(node, hash >>> 0, hostname, 0, end);
    if (edge === -1 && end !== 0) {
      edge = wildcardEdge[node];
    }
    if (edge !== -1) {
      node = edgeChild[edge];
      if ((nodeFlags[node] & allowedMask) !== 0) {
        matchNode = node;
        matchStart = 0;
        matchEnd = end;
      }
    }
    return matchNode !== -1;
  }
  function suffixLookup(hostname, options, out) {
    if (fast_path_default(hostname, options, out)) {
      return false;
    }
    const allowedMask = (options.allowPrivateDomains ? 2 : 0) | (options.allowIcannDomains ? 1 : 0);
    if (walk(hostname, exceptionsRoot, allowedMask)) {
      out.isIcann = (nodeFlags[matchNode] & 1) !== 0;
      out.isPrivate = (nodeFlags[matchNode] & 2) !== 0;
      out.publicSuffix = hostname.slice(matchEnd + 1);
      return true;
    }
    if (walk(hostname, rulesRoot, allowedMask)) {
      out.isIcann = (nodeFlags[matchNode] & 1) !== 0;
      out.isPrivate = (nodeFlags[matchNode] & 2) !== 0;
      out.publicSuffix = hostname.slice(matchStart);
      return false;
    }
    out.isIcann = false;
    out.isPrivate = false;
    const lastDot = hostname.lastIndexOf(".");
    out.publicSuffix = lastDot === -1 ? hostname : hostname.slice(lastDot + 1);
    return false;
  }

  // node_modules/tldts/dist/es6/index.js
  var RESULT = getEmptyResult();
  function parse(url, options) {
    return parseImpl(url, 5, suffixLookup, options, getEmptyResult());
  }

  // packages/core/dist/destination.js
  var LOCAL_HOSTS = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "[::1]"]);
  function checkDestination(input, opts = {}) {
    const warnings = [];
    const fail = (code, message) => ({
      ok: false,
      error: { code, path: "destination", message },
      warnings
    });
    if (typeof input !== "string" || input.trim() === "")
      return fail("destination_missing", "No destination given.");
    const raw = input.trim();
    if (raw.length > LIMITS.maxUrlLength)
      return fail("url_too_long", "The destination URL is too long.");
    let u;
    try {
      u = new URL(raw);
    } catch {
      return fail("url_invalid", "The destination is not a valid URL.");
    }
    const local = LOCAL_HOSTS.has(u.hostname) || u.hostname.endsWith(".localhost");
    if (u.protocol !== "https:" && !(opts.allowLocalhost && local && u.protocol === "http:")) {
      return fail("url_not_https", `Only https destinations are allowed (got ${u.protocol.replace(":", "")}).`);
    }
    if (u.username || u.password)
      return fail("url_has_credentials", "Destinations must not contain a username or password.");
    const host = parse(u.hostname, { allowPrivateDomains: true });
    const hostname = u.hostname;
    let registrableDomain = host.isIp ? null : host.domain;
    if (host.isIp)
      warnings.push({ code: "ip_address_host", path: "destination", message: "The destination is a raw IP address." });
    else if (!host.isIcann && !host.isPrivate && !local) {
      warnings.push({ code: "unknown_suffix", path: "destination", message: `"${host.publicSuffix ?? hostname}" is not a known public suffix.` });
    }
    if (local)
      registrableDomain = hostname;
    if (hostname.split(".").some((label) => label.startsWith("xn--"))) {
      warnings.push({
        code: "punycode_hostname",
        path: "destination",
        message: "The hostname uses non-Latin characters (shown in raw form). Check it is the site you expect."
      });
    }
    if (u.port)
      warnings.push({ code: "non_default_port", path: "destination", message: `The destination uses port ${u.port}.` });
    const hostPrefix = registrableDomain && hostname !== registrableDomain ? hostname.slice(0, hostname.length - registrableDomain.length) : "";
    return {
      ok: true,
      value: { url: u.href, origin: u.origin, hostname, registrableDomain, hostPrefix },
      warnings
    };
  }
  function isHttpsUrl(v) {
    if (typeof v !== "string" || v.length > LIMITS.maxUrlLength)
      return false;
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }
  function isWssUrl(v) {
    if (typeof v !== "string")
      return false;
    try {
      return new URL(v).protocol === "wss:";
    } catch {
      return false;
    }
  }
  function normalizeUrl(v) {
    try {
      return new URL(v).href;
    } catch {
      return null;
    }
  }

  // packages/core/dist/manifest.js
  var stringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
  var ENTRY_POINT = /^[A-Za-z0-9._-]{1,128}$/;
  function parseManifest(input, opts = {}) {
    const c = new Collector();
    if (opts.byteLength !== void 0 && opts.byteLength > LIMITS.manifestBytes) {
      c.error("manifest_too_large", "", `Manifests are limited to ${LIMITS.manifestBytes} bytes.`);
    }
    if (!isPlainObject(input)) {
      c.error("not_an_object", "", "The manifest must be a JSON object.");
      return c.result(null);
    }
    const schema = input.schema;
    if (typeof schema !== "string" || !schema.startsWith("nswp/manifest/")) {
      c.error("schema_mismatch", "schema", `schema must be "${SCHEMAS.manifest}".`);
    } else if (schema !== SCHEMAS.manifest) {
      c.warn("schema_version", "schema", `Manifest declares ${schema}; this library implements ${SCHEMAS.manifest}.`);
    }
    let listing = "allow";
    if (input.listing !== void 0) {
      if (input.listing === "allow" || input.listing === "deny")
        listing = input.listing;
      else
        c.warn("unknown_value", "listing", 'listing must be "allow" or "deny"; treating as "allow".');
    }
    const publishers = {};
    if (!isPlainObject(input.publishers)) {
      c.error("missing_field", "publishers", "publishers must be an object keyed by hex pubkey.");
    } else {
      for (const [pk, v] of Object.entries(input.publishers)) {
        if (!isHex64(pk)) {
          c.error("invalid_pubkey", `publishers.${pk}`, "Publisher keys must be 64 lowercase hex characters.");
          continue;
        }
        if (!isPlainObject(v) || !stringArray(v.worlds)) {
          c.error("invalid_field", `publishers.${pk}.worlds`, "Each publisher needs a worlds array of world IDs.");
          continue;
        }
        publishers[pk] = { worlds: v.worlds };
      }
    }
    const worlds = {};
    if (!isPlainObject(input.worlds)) {
      c.error("missing_field", "worlds", "worlds must be an object keyed by world ID.");
    } else {
      for (const [id, raw] of Object.entries(input.worlds)) {
        const p = `worlds.${id}`;
        if (!isPlainObject(raw) || !isPlainObject(raw.entry) || !isHttpsUrl(raw.entry.url)) {
          c.error("invalid_entry", `${p}.entry.url`, "Each world needs entry.url as an https URL.");
          continue;
        }
        const modes = stringArray(raw.entry.modes) ? raw.entry.modes : [];
        for (const m of modes)
          if (!MODES.includes(m))
            c.warn("unknown_value", `${p}.entry.modes`, `Unknown mode "${m}".`);
        const w = {
          entry: { url: normalizeUrl(raw.entry.url), modes },
          entryPoints: [],
          capabilities: stringArray(raw.capabilities) ? raw.capabilities : []
        };
        if (raw.entry_points !== void 0) {
          if (!stringArray(raw.entry_points))
            c.warn("invalid_field", `${p}.entry_points`, "entry_points must be an array of strings.");
          else {
            for (const ep of raw.entry_points) {
              if (ENTRY_POINT.test(ep))
                w.entryPoints.push(ep);
              else
                c.warn("invalid_entry_point", `${p}.entry_points`, `Entry point "${ep}" may only use letters, digits, ".", "_" and "-".`);
            }
          }
        }
        if (isPlainObject(raw.avatar)) {
          const a = raw.avatar;
          w.avatar = { formats: stringArray(a.formats) ? a.formats : [] };
          if (typeof a.max_file_size_mb === "number")
            w.avatar.maxFileSizeMb = a.max_file_size_mb;
          if (typeof a.max_triangles === "number")
            w.avatar.maxTriangles = a.max_triangles;
        }
        if (raw.multiplayer !== void 0) {
          if (isPlainObject(raw.multiplayer) && isWssUrl(raw.multiplayer.endpoint)) {
            w.multiplayer = { endpoint: raw.multiplayer.endpoint };
            if (typeof raw.multiplayer.auth === "string")
              w.multiplayer.auth = raw.multiplayer.auth;
          } else
            c.warn("invalid_field", `${p}.multiplayer.endpoint`, "multiplayer.endpoint must be a wss URL; ignored.");
        }
        if (isPlainObject(raw.budgets) && typeof raw.budgets.initial_download_mb === "number") {
          w.budgets = { initialDownloadMb: raw.budgets.initial_download_mb };
        }
        if (raw.airlock !== void 0) {
          if (isHttpsUrl(raw.airlock))
            w.airlock = raw.airlock;
          else
            c.warn("url_not_https", `${p}.airlock`, "airlock must be an https URL; ignored.");
        }
        worlds[id] = w;
      }
    }
    const relays = [];
    if (input.relays !== void 0) {
      if (!stringArray(input.relays))
        c.warn("invalid_field", "relays", "relays must be an array of wss URLs.");
      else
        for (const r of input.relays)
          isWssUrl(r) ? relays.push(r) : c.warn("invalid_relay", "relays", `Ignoring relay "${r}" (not wss).`);
    }
    let kit2;
    if (input.kit !== void 0) {
      if (parseKitVersion(input.kit))
        kit2 = input.kit;
      else
        c.warn("invalid_field", "kit", 'kit must be a version such as "0.21.0"; ignoring it.');
    }
    return c.result({ schema: typeof schema === "string" ? schema : SCHEMAS.manifest, listing, publishers, worlds, relays, ...kit2 ? { kit: kit2 } : {} });
  }
  function doorFor(manifest, url) {
    const here = normalizeUrl(url);
    const d = Object.keys(manifest.worlds).find((id) => normalizeUrl(manifest.worlds[id].entry.url) === here);
    const publishers = d === void 0 ? [] : Object.keys(manifest.publishers).filter((key) => manifest.publishers[key].worlds.includes(d));
    if (d === void 0 || publishers.length !== 1)
      return { url };
    return { naddr: encodeNaddr({ kind: WORLD_KIND, pubkey: publishers[0], identifier: d, relays: manifest.relays.slice(0, 2) }), url };
  }

  // packages/core/dist/settings.js
  var LOOK_RANGE = [0.25, 3];
  var FOV_RANGE = [50, 110];
  var SETTINGS_LINK_LIMIT = 400;
  var level = (v) => typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : void 0;
  function cleanSettings(input) {
    const out = {};
    if (!input || typeof input !== "object" || Array.isArray(input))
      return out;
    const s = input;
    if (s.sound && typeof s.sound === "object" && !Array.isArray(s.sound)) {
      const from = s.sound;
      const sound = {};
      if (typeof from.off === "boolean")
        sound.off = from.off;
      for (const k of ["effects", "music", "voices"]) {
        const v = level(from[k]);
        if (v !== void 0)
          sound[k] = v;
      }
      if (typeof from.hum === "boolean")
        sound.hum = from.hum;
      if (Object.keys(sound).length)
        out.sound = sound;
    }
    if (typeof s.text === "number" && Number.isFinite(s.text))
      out.text = Math.round(Math.min(1.5, Math.max(0.85, s.text)) * 100) / 100;
    if (typeof s.motion === "boolean")
      out.motion = s.motion;
    if (s.wrist === "left" || s.wrist === "right" || s.wrist === "off")
      out.wrist = s.wrist;
    if (s.turn === 30 || s.turn === 45 || s.turn === 90)
      out.turn = s.turn;
    if (s.hand === "left" || s.hand === "right")
      out.hand = s.hand;
    if (typeof s.narrow === "boolean")
      out.narrow = s.narrow;
    if (typeof s.full === "boolean")
      out.full = s.full;
    if (typeof s.intense === "boolean")
      out.intense = s.intense;
    if (typeof s.look === "number" && Number.isFinite(s.look))
      out.look = Math.round(Math.min(LOOK_RANGE[1], Math.max(LOOK_RANGE[0], s.look)) * 100) / 100;
    if (typeof s.fov === "number" && Number.isFinite(s.fov))
      out.fov = Math.round(Math.min(FOV_RANGE[1], Math.max(FOV_RANGE[0], s.fov)));
    if (typeof s.pictures === "boolean")
      out.pictures = s.pictures;
    if (typeof s.chat === "boolean")
      out.chat = s.chat;
    return out;
  }
  var hasSettings = (s) => !!s && Object.keys(s).length > 0;
  var toBase64Url = (text) => {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (const b of bytes)
      bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  function encodeSettings(settings) {
    const clean2 = cleanSettings(settings);
    if (!hasSettings(clean2))
      return "";
    const text = toBase64Url(JSON.stringify(clean2));
    return text.length <= SETTINGS_LINK_LIMIT ? text : "";
  }

  // packages/core/dist/avatar.js
  var LOOK_PARTS = {
    build: ["medium", "slight", "broad"],
    head: ["round", "square", "tall", "wedge", "flat", "faceted"],
    face: ["band", "split", "dots", "tee", "slit", "wide"],
    accessory: ["none", "antenna", "halo", "hat", "crest", "fins"],
    body: ["cloak", "coat", "plate", "robe"],
    shoulders: ["none", "pads", "mantle", "collar"],
    pattern: ["plain", "halves", "stripe", "bands", "yoke"],
    finish: ["matte", "gloss", "sheen"]
  };
  var LOOK_COLORS = ["color", "accent", "light"];
  var HEX_COLOR = /^#[0-9a-f]{6}$/;
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  function generatedLook(seed) {
    const b = sha256(utf8ToBytes(seed.toLowerCase()));
    const pick = (list, i) => list[b[i] % list.length];
    const hue = (b[0] * 256 + b[1]) / 65536;
    const accentHue = (hue + [0.08, 0.5, 0.92, 0.33][b[2] % 4]) % 1;
    const lightHue = (hue + [0, 0.12, 0.5, 0.88][b[3] % 4]) % 1;
    return {
      color: hsl(hue, 0.42 + b[4] % 4 * 0.08, 0.26 + b[5] % 4 * 0.04),
      accent: hsl(accentHue, 0.3 + b[6] % 4 * 0.1, 0.42 + b[7] % 4 * 0.06),
      light: hsl(lightHue, 0.9, 0.62),
      build: pick(LOOK_PARTS.build, 8),
      head: pick(LOOK_PARTS.head, 9),
      face: pick(LOOK_PARTS.face, 10),
      accessory: pick(LOOK_PARTS.accessory, 11),
      body: pick(LOOK_PARTS.body, 12),
      shoulders: pick(LOOK_PARTS.shoulders, 13),
      pattern: pick(LOOK_PARTS.pattern, 14),
      finish: pick(LOOK_PARTS.finish, 15),
      mark: markFor(seed)
    };
  }
  function markFor(seed) {
    const b = sha256(utf8ToBytes(seed.toLowerCase()));
    return bytesToHex(new Uint8Array([b[30] & 127, b[31]]));
  }
  function applyChoices(base, choices) {
    const look = { ...base };
    const warnings = [];
    for (const [key, value] of Object.entries(choices)) {
      if (key === "mark")
        continue;
      if (LOOK_COLORS.includes(key)) {
        if (typeof value === "string" && HEX_COLOR.test(value.toLowerCase()))
          look[key] = value.toLowerCase();
        else
          warnings.push(key);
      } else if (key in LOOK_PARTS) {
        const list = LOOK_PARTS[key];
        if (typeof value === "string" && list.includes(value))
          look[key] = value;
        else
          warnings.push(key);
      }
    }
    return { look, warnings };
  }
  var LOOK_LIMITS = { chars: 600, seedChars: 64 };
  function decodeLook(text) {
    const c = new Collector();
    if (text.length > LOOK_LIMITS.chars) {
      c.error("look_too_large", "", "A look is at most 600 characters.");
      return c.result({ look: generatedLook(""), seed: "" });
    }
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      c.error("invalid_json", "", "A look must be a JSON object.");
      return c.result({ look: generatedLook(""), seed: "" });
    }
    if (!isPlainObject(json) || typeof json.s !== "string" || !/^[0-9a-zA-Z_-]{8,64}$/.test(json.s)) {
      c.error("missing_field", "s", "A look needs a seed: 8 to 64 letters or digits.");
      return c.result({ look: generatedLook(""), seed: "" });
    }
    const { s: seed, ...choices } = json;
    const { look, warnings } = applyChoices(generatedLook(seed), choices);
    for (const w of warnings)
      c.warn("unknown_value", w, `Ignoring an unknown value for "${w}".`);
    return c.result({ look, seed });
  }

  // packages/core/dist/arrival.js
  var ENTRY_POINT2 = /^[A-Za-z0-9._-]{1,128}$/;
  var decoder2 = new TextDecoder();
  function encodeArrival(a) {
    const body = { v: a.v ?? SCHEMAS.arrival, ...a };
    return base64urlnopad.encode(utf8ToBytes(JSON.stringify(body)));
  }
  function decodeArrival(value) {
    const c = new Collector();
    if (value.length > LIMITS.arrivalChars) {
      c.error("arrival_too_large", "", "The arrival context is too large.");
      return c.result(null);
    }
    let json;
    try {
      json = JSON.parse(decoder2.decode(base64urlnopad.decode(value)));
    } catch {
      c.error("arrival_malformed", "", "The arrival context is not valid base64url JSON.");
      return c.result(null);
    }
    if (!isPlainObject(json)) {
      c.error("arrival_malformed", "", "The arrival context must be an object.");
      return c.result(null);
    }
    const out = { v: SCHEMAS.arrival };
    if (typeof json.v !== "string" || !json.v.startsWith("nswp/arrival/"))
      c.error("schema_mismatch", "v", `v must be "${SCHEMAS.arrival}".`);
    else
      out.v = json.v;
    if (json.entry !== void 0) {
      if (typeof json.entry === "string" && ENTRY_POINT2.test(json.entry))
        out.entry = json.entry;
      else
        c.warn("invalid_entry_point", "entry", "Ignoring an invalid entry point.");
    }
    if (json.airlock !== void 0) {
      if (isHttpsUrl(json.airlock))
        out.airlock = json.airlock;
      else
        c.warn("url_not_https", "airlock", "Ignoring a non-https return Airlock.");
    }
    if (json.signer !== void 0) {
      if (isHttpsUrl(json.signer) && json.signer.length <= 300)
        out.signer = json.signer;
      else
        c.warn("url_not_https", "signer", "Ignoring a signer address that isn't a usable https address.");
    }
    if (json.assertion !== void 0) {
      if (hasEventShape(json.assertion))
        out.assertion = json.assertion;
      else
        c.warn("invalid_assertion", "assertion", "Ignoring a malformed entry assertion.");
    }
    if (json.avatar !== void 0) {
      try {
        if (typeof json.avatar !== "string")
          throw new Error();
        decodeNaddr(json.avatar);
        out.avatar = json.avatar;
      } catch {
        c.warn("invalid_avatar", "avatar", "Ignoring an avatar reference that is not an naddr.");
      }
    }
    if (json.look !== void 0) {
      if (typeof json.look === "string" && decodeLook(json.look).ok)
        out.look = json.look;
      else
        c.warn("invalid_look", "look", "Ignoring a look that can't be read.");
    }
    if (json.pass !== void 0 || json.sessionKey !== void 0) {
      let fits = false;
      if (hasEventShape(json.pass) && isHex64(json.sessionKey)) {
        try {
          fits = getTagValue(json.pass, "nswp:session") === getPublicKey(hexToBytes(json.sessionKey));
        } catch {
        }
      }
      if (fits) {
        out.pass = json.pass;
        out.sessionKey = json.sessionKey;
      } else
        c.warn("invalid_pass", "pass", "Ignoring a pass that doesn't come with the session key it names.");
    }
    if (json.immersive !== void 0 && json.immersive !== false) {
      if (json.immersive === true)
        out.immersive = true;
      else
        c.warn("invalid_immersive", "immersive", "Ignoring an immersive hint that isn't true or false.");
    }
    if (json.home !== void 0 && json.home !== false) {
      if (json.home === true)
        out.home = true;
      else
        c.warn("invalid_home", "home", "Ignoring a home hint that isn't true or false.");
    }
    if (json.joined !== void 0 && json.joined !== false) {
      if (json.joined === true)
        out.joined = true;
      else
        c.warn("invalid_joined", "joined", "Ignoring a joined hint that isn't true or false.");
    }
    if (json.mic !== void 0 && json.mic !== false) {
      if (json.mic === true && out.joined)
        out.mic = true;
      else
        c.warn("invalid_mic", "mic", "Ignoring a microphone hint that isn't true, or that comes without joined.");
    }
    if (json.moving !== void 0 && json.moving !== "casual") {
      if (json.moving === "intense")
        out.moving = "intense";
      else
        c.warn("invalid_moving", "moving", `Ignoring a way of moving that isn't "casual" or "intense".`);
    }
    if (json.settings !== void 0) {
      const settings = cleanSettings(json.settings);
      if (hasSettings(settings))
        out.settings = settings;
      else
        c.warn("invalid_settings", "settings", "Ignoring settings with nothing readable in them.");
    }
    if (json.form !== void 0) {
      if (json.form === "touch" || json.form === "desk")
        out.form = json.form;
      else
        c.warn("invalid_form", "form", `Ignoring a form that isn't "touch" or "desk".`);
    }
    if (json.blocked !== void 0) {
      const ok = Array.isArray(json.blocked) && json.blocked.length <= LIMITS.maxBlocked && json.blocked.every((k) => typeof k === "string" && isHex64(k));
      if (ok) {
        const keys = [...new Set(json.blocked)];
        if (keys.length)
          out.blocked = keys;
      } else
        c.warn("invalid_blocked", "blocked", `Ignoring a block list (must be at most ${LIMITS.maxBlocked} keys).`);
    }
    if (json.receipts !== void 0) {
      if (Array.isArray(json.receipts) && json.receipts.length <= LIMITS.maxReceipts && json.receipts.every(hasEventShape)) {
        out.receipts = json.receipts;
      } else
        c.warn("invalid_receipts", "receipts", `Ignoring receipts (must be at most ${LIMITS.maxReceipts} events).`);
    }
    return c.result(out);
  }
  function buildArrivalUrl(destination, arrival3) {
    const u = new URL(destination);
    const existing = u.hash.replace(/^#/, "");
    const param = `nswp=${encodeArrival(arrival3)}`;
    u.hash = existing ? `${existing}&${param}` : param;
    return u.href;
  }
  function arrivalParam(hash) {
    for (const part of hash.replace(/^#/, "").split("&")) {
      if (part.startsWith("nswp="))
        return part.slice(5);
    }
    return null;
  }
  function stripArrivalParam(hash) {
    const rest = hash.replace(/^#/, "").split("&").filter((p) => p !== "" && !p.startsWith("nswp="));
    return rest.length ? `#${rest.join("&")}` : "";
  }

  // packages/core/dist/portal.js
  var isForm = (v) => v === "touch" || v === "desk";
  function cleanKeys(input, limit) {
    if (!Array.isArray(input))
      return [];
    const out = [];
    for (const k of input) {
      if (typeof k !== "string" || !/^[0-9a-f]{64}$/.test(k) || out.includes(k))
        continue;
      out.push(k);
      if (out.length >= limit)
        break;
    }
    return out;
  }
  var blockedFlag = (opts) => {
    const keys = cleanKeys(opts.blocked, LIMITS.maxBlockedOnLink);
    return keys.length ? [`blocked=${keys.join(",")}`] : [];
  };
  var settingsFlag = (opts) => {
    const text = encodeSettings(opts.settings);
    return text ? [`set=${text}`] : [];
  };
  function stateFlags(opts) {
    return [...opts.immersive ? ["xr=1"] : [], ...opts.moving === "intense" ? ["moving=intense"] : [], ...opts.joined ? ["joined=1"] : [], ...opts.joined && opts.mic ? ["mic=1"] : []];
  }
  function buildAirlockUrl(airlock, dest, opts = {}) {
    const u = new URL(airlock);
    const to = dest.naddr ?? dest.url;
    if (!to)
      throw new Error("buildAirlockUrl: destination needs an naddr or a url");
    const parts2 = [`to=${encodeURIComponent(to)}`];
    if (dest.naddr && dest.url)
      parts2.push(`url=${encodeURIComponent(dest.url)}`);
    if (dest.entryPoint)
      parts2.push(`entry=${encodeURIComponent(dest.entryPoint)}`);
    parts2.push(...opts.who === "look" ? ["who=look"] : opts.who ? ["who=1"] : [], ...stateFlags(opts), ...isForm(opts.form) ? [`form=${opts.form}`] : [], ...settingsFlag(opts), ...blockedFlag(opts));
    u.hash = parts2.join("&");
    return u.href;
  }
  function buildWayUrl(airlock, opts = {}) {
    const u = new URL(airlock);
    u.hash = [...opts.doors ? ["doors=1"] : [], ...stateFlags(opts), ...settingsFlag(opts), ...blockedFlag(opts)].join("&");
    return u.href;
  }

  // packages/core/dist/nip44.js
  var SALT = utf8ToBytes("nip44-v2");
  var decoder3 = new TextDecoder("utf-8", { fatal: true });

  // packages/core/dist/room.js
  var ROOM_PASS_KIND = 27300;
  var POSE_FLOATS = 22;
  var POSE_BYTES = POSE_FLOATS * 4;

  // packages/core/dist/chat.js
  var CHAT_LIMITS = {
    /** The most characters in one thing said. Longer is cut, by the one saying it and again by the one reading. */
    chars: 240,
    /** A line is sent this many times, because the channel doesn't try again; a reader takes the first. */
    repeats: 3,
    repeatGapMs: 180,
    /** No more than `burst` lines from one member in `perMs`. The rest are dropped, unseen. */
    burst: 5,
    perMs: 1e4,
    /** How many lines a reader keeps for the visit. */
    kept: 100,
    /** How many ids are remembered for each member, to know a repeat from a new line. */
    remembered: 32
  };
  var UNSEEN = [
    [0, 31],
    [127, 159],
    [8203, 8204],
    // 0x200d joins the parts of one emoji, and stays.
    [8206, 8207],
    [8232, 8239],
    [8288, 8303],
    [65279, 65279],
    [65529, 65531]
  ];
  var unseen = (code) => UNSEEN.some(([from, to]) => code >= from && code <= to);
  function cleanLine(text, chars) {
    if (typeof text !== "string")
      return "";
    let out = "";
    for (const ch of text.slice(0, chars * 8).normalize("NFC"))
      out += unseen(ch.codePointAt(0)) ? " " : ch;
    out = out.replace(/\s+/g, " ").trim();
    return [...out].slice(0, chars).join("").trim();
  }
  var cleanChat = (text) => cleanLine(text, CHAT_LIMITS.chars);

  // packages/core/dist/pass.js
  var PASS_LIMITS = {
    defaultTtlSec: 4 * 3600,
    maxTtlSec: 12 * 3600,
    /** How far a reader's clock and a signer's may disagree. */
    skewSec: 120,
    nameChars: 48,
    /** The longest address a picture may have. */
    pictureChars: 300,
    /** The most a pass says about its holder, in their own words. */
    aboutChars: 280,
    /** A pass as JSON, as it travels between the members of a room. */
    chars: 4e3
  };
  function cleanName(name) {
    const cleaned = name.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ").replace(/\s+/g, " ").trim();
    return [...cleaned].slice(0, PASS_LIMITS.nameChars).join("").trim();
  }
  function cleanPicture(url) {
    if (typeof url !== "string" || url.length > PASS_LIMITS.pictureChars)
      return "";
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes("."))
        return "";
      return u.href.length <= PASS_LIMITS.pictureChars ? u.href : "";
    } catch {
      return "";
    }
  }
  var cleanAbout = (about) => cleanLine(about, PASS_LIMITS.aboutChars);
  function verifyRoomPass(event, opts) {
    const c = new Collector();
    if (!verifyEvent(event)) {
      c.error("bad_signature", "", "The pass is not a validly signed Nostr event.");
      return c.result(null);
    }
    const now = opts.now ?? nowSeconds();
    if (event.kind !== ROOM_PASS_KIND)
      c.error("wrong_kind", "kind", `Expected kind ${ROOM_PASS_KIND}.`);
    const one = (name2) => {
      const t = getTags(event, name2);
      if (t.length !== 1 || !t[0][1]) {
        c.error(t.length > 1 ? "duplicate_tag" : "missing_tag", `tags.${name2}`, `Exactly one "${name2}" tag is required.`);
        return void 0;
      }
      return t[0][1];
    };
    const session2 = one("nswp:session");
    const origin = one("nswp:origin");
    const exp = one("expiration");
    let expectedOrigin;
    try {
      expectedOrigin = new URL(opts.origin).origin;
    } catch {
      c.error("invalid_option", "origin", "opts.origin is not a URL.");
      return c.result(null);
    }
    if (session2 !== void 0) {
      if (!isHex64(session2))
        c.error("invalid_session", "tags.nswp:session", "The session key must be 64 lowercase hex characters.");
      else if (session2 === event.pubkey)
        c.error("invalid_session", "tags.nswp:session", "A pass can't name the identity key as its own session key.");
      else if (opts.session !== void 0 && session2 !== opts.session)
        c.error("session_mismatch", "tags.nswp:session", "The pass speaks for a different session key.");
    }
    if (origin !== void 0 && origin !== expectedOrigin)
      c.error("origin_mismatch", "tags.nswp:origin", "The pass was made for a different site.");
    const expiresAt = exp !== void 0 ? Number(exp) : NaN;
    if (exp !== void 0) {
      if (!/^\d+$/.test(exp) || !Number.isSafeInteger(expiresAt))
        c.error("invalid_expiration", "tags.expiration", "expiration must be an integer timestamp.");
      else {
        if (expiresAt <= now)
          c.error("pass_expired", "tags.expiration", "The pass has expired.");
        if (expiresAt - event.created_at > PASS_LIMITS.maxTtlSec)
          c.error("ttl_too_long", "tags.expiration", `A pass may live at most ${PASS_LIMITS.maxTtlSec / 3600} hours.`);
      }
    }
    if (event.created_at > now + PASS_LIMITS.skewSec)
      c.error("created_in_future", "created_at", "The pass is dated in the future.");
    const names = getTags(event, "name");
    if (names.length > 1)
      c.warn("duplicate_tag", "tags.name", "Only the first name is used.");
    const raw = names[0]?.[1] ?? "";
    const name = cleanName(raw);
    if (raw !== name)
      c.warn("name_cleaned", "tags.name", "The name was tidied before being shown.");
    const shown3 = getTags(event, "picture")[0]?.[1] ?? "";
    const picture = cleanPicture(shown3);
    if (shown3 && !picture)
      c.warn("picture_ignored", "tags.picture", "The picture's address isn't one that can be fetched, so none is shown.");
    const told = getTags(event, "about")[0]?.[1] ?? "";
    const about = cleanAbout(told);
    if (told !== about)
      c.warn("about_cleaned", "tags.about", "What they wrote about themselves was tidied or cut short before being shown.");
    return c.result({ pubkey: event.pubkey, session: session2 ?? "", name, picture, about, expiresAt, id: event.id });
  }

  // packages/core/dist/signing.js
  var SIGNER_PROTOCOL = "nswp-signer";
  var SIGNER_VERSION = 1;
  var SIGN_LIMITS = {
    /** The longest a note's content may be, in characters. */
    contentChars: 8e3,
    tags: 60,
    tagItems: 8,
    tagChars: 400,
    /** How long an unlocked signer stays unlocked for a world, at most. Closing the world's page ends it sooner. */
    grantSec: 4 * 3600,
    /** No more than this many notes for one world in `perMs`: the pace of a person, not of a script. */
    burst: 3,
    perMs: 6e4,
    /** And no more than this many in an hour. */
    hourly: 20,
    /**
     * A pass is counted apart from notes, so signing in doesn't use up a post: no more than this many passes for
     * one world in `perMs`, and in an hour. A reader asks once per sign-in and once when a pass runs out.
     */
    passBurst: 2,
    passHourly: 10
  };
  var WORLD_TAG = "nswp:world";
  function cleanOrigin(input) {
    if (typeof input !== "string" || input.length > 300)
      return "";
    try {
      const u = new URL(input);
      return (u.protocol === "https:" || u.protocol === "http:") && u.origin !== "null" ? u.origin : "";
    } catch {
      return "";
    }
  }
  function isWhatWasAsked(asked, signed) {
    if (signed.kind !== asked.kind || signed.content !== asked.content)
      return false;
    const mine = asked.tags.filter((t) => t[0] !== WORLD_TAG);
    const theirs = signed.tags.filter((t) => t[0] !== WORLD_TAG);
    return JSON.stringify(mine) === JSON.stringify(theirs);
  }
  function signerAddresses(airlock) {
    if (!airlock)
      return null;
    try {
      const base = new URL(airlock);
      if (base.protocol !== "https:")
        return null;
      return { origin: base.origin, signer: new URL("../signer/", base).href, window: new URL("../connect/", base).href };
    } catch {
      return null;
    }
  }
  function signerAt(base) {
    if (!base || base.length > 300)
      return null;
    try {
      const at = new URL(base);
      if (at.protocol !== "https:" || at.username || at.password)
        return null;
      if (!at.pathname.endsWith("/"))
        at.pathname += "/";
      at.search = "";
      at.hash = "";
      return { origin: at.origin, signer: new URL("signer/", at).href, window: new URL("connect/", at).href };
    } catch {
      return null;
    }
  }
  var ID = /^[0-9a-z-]{1,40}$/i;
  var wrapped = (data) => {
    if (!data || typeof data !== "object")
      return null;
    const d = data;
    return d.nswp === SIGNER_PROTOCOL && d.v === SIGNER_VERSION && typeof d.t === "string" ? d : null;
  };
  var signerMessage = (message) => ({ nswp: SIGNER_PROTOCOL, v: SIGNER_VERSION, ...message });
  function readSignerReply(data) {
    const d = wrapped(data);
    if (!d)
      return null;
    if (d.t === "ready")
      return { t: "ready" };
    if (d.t === "state" && typeof d.unlocked === "boolean") {
      const pubkey = typeof d.pubkey === "string" && /^[0-9a-f]{64}$/.test(d.pubkey) ? d.pubkey : void 0;
      return {
        t: "state",
        ...typeof d.id === "string" && ID.test(d.id) ? { id: d.id } : {},
        unlocked: d.unlocked && !!pubkey,
        ...pubkey ? { pubkey } : {},
        ...typeof d.name === "string" && cleanLine(d.name, 48) ? { name: cleanLine(d.name, 48) } : {},
        // Their own picture and words, as their sign-in address read them from their profile: cleaned as a pass's are.
        ...pubkey && cleanPicture(d.picture) ? { picture: cleanPicture(d.picture) } : {},
        ...pubkey && cleanAbout(d.about) ? { about: cleanAbout(d.about) } : {},
        ...typeof d.until === "number" && Number.isFinite(d.until) ? { until: d.until } : {},
        // Whether the signer will still be unlocked for this world on their next visit, where it says.
        ...pubkey && d.unlocked && typeof d.remembered === "boolean" ? { remembered: d.remembered } : {}
      };
    }
    if (typeof d.id !== "string" || !ID.test(d.id))
      return null;
    if (d.t === "refused")
      return { t: "refused", id: d.id };
    if (d.t === "signed" && d.event && typeof d.event === "object")
      return { t: "signed", id: d.id, event: d.event };
    return null;
  }

  // packages/core/dist/layout.js
  var LAYOUT_LIMITS = {
    placements: 64,
    publishedItems: 16,
    /** Furthest a placement may be from the home's origin, in metres. */
    reach: 50,
    noteChars: 280,
    /** A picture in a frame (spec §10.1). */
    pictureBytes: 1024 * 1024
  };

  // packages/core/dist/bridge.js
  var WORLD_GRANT_LIMITS = {
    defaultTtlSec: 8 * 3600,
    maxTtlSec: 12 * 3600
  };

  // packages/core/dist/local.js
  var LOCAL_MAP_PATH = "/.well-known/nswp-local.json";
  var LOCAL_MAP_WAIT = 2e3;
  var LOCAL_MAP_LIMIT = 64;
  var FOLLOWED_MOST = 16384;
  function isLocalHost(hostname) {
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (h === "localhost" || h.endsWith(".localhost") || h === "::1")
      return true;
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (!m)
      return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255))
      return false;
    return a === 127 || a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 169 && b === 254;
  }
  function originOf(text, most = 300) {
    if (typeof text !== "string" || text.length > most)
      return null;
    try {
      const u = new URL(text);
      return u.username || u.password ? null : u;
    } catch {
      return null;
    }
  }
  function cleanLocalMap(input) {
    const out = /* @__PURE__ */ new Map();
    if (!input || typeof input !== "object" || Array.isArray(input))
      return out;
    for (const [real, local] of Object.entries(input)) {
      if (out.size >= LOCAL_MAP_LIMIT)
        break;
      const from = originOf(real);
      const to = originOf(local);
      if (!from || !to)
        continue;
      if (from.protocol !== "https:" || isLocalHost(from.hostname))
        continue;
      if (to.protocol !== "http:" && to.protocol !== "https:" || !isLocalHost(to.hostname))
        continue;
      out.set(from.origin, to.origin);
    }
    return out;
  }
  function mapToLocal(url, map) {
    if (!map.size)
      return url;
    const u = originOf(url, FOLLOWED_MOST);
    const to = u && map.get(u.origin);
    return to ? `${to}${url.slice(u.origin.length)}` : url;
  }
  function mapFromLocal(url, map) {
    if (!map.size)
      return url;
    const u = originOf(url, FOLLOWED_MOST);
    if (!u)
      return url;
    for (const [real, local] of map)
      if (local === u.origin)
        return `${real}${url.slice(u.origin.length)}`;
    return url;
  }
  var NONE = /* @__PURE__ */ new Map();
  var loading;
  function onLocalHost() {
    try {
      return typeof location !== "undefined" && (location.protocol === "http:" || location.protocol === "https:") && isLocalHost(location.hostname);
    } catch {
      return false;
    }
  }
  function localMap() {
    if (loading)
      return loading;
    if (!onLocalHost() || typeof fetch !== "function")
      return loading = Promise.resolve(NONE);
    loading = (async () => {
      try {
        const res = await fetch(LOCAL_MAP_PATH, { cache: "no-store", credentials: "omit" });
        return res.ok ? cleanLocalMap(await res.json()) : NONE;
      } catch {
        return NONE;
      }
    })();
    return loading;
  }
  function mapSoon() {
    const asked = localMap();
    if (!onLocalHost())
      return asked;
    return Promise.race([asked, new Promise((done) => setTimeout(() => done(NONE), LOCAL_MAP_WAIT))]);
  }
  async function toLocal(url) {
    return mapToLocal(url, await mapSoon());
  }
  async function fromLocal(url) {
    return mapFromLocal(url, await mapSoon());
  }

  // packages/sdk/src/form.ts
  var matches = (query) => {
    try {
      return typeof matchMedia === "function" && matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  function deviceForms() {
    const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 || matches("(any-pointer: coarse)");
    const mouse = matches("(any-pointer: fine)");
    return { touch, mouse, main: matches("(pointer: fine)") ? "desk" : "touch" };
  }
  function formFor(said, device) {
    if (said === "touch" && device.touch) return "touch";
    if (said === "desk" && device.mouse) return "desk";
    return device.main;
  }
  var arrived;
  var used;
  var watching = false;
  function arriveAs(form) {
    arrived = form;
    watch();
  }
  function startingForm() {
    return formFor(arrived, deviceForms());
  }
  function currentForm() {
    watch();
    return used ?? startingForm();
  }
  function watch() {
    if (watching || typeof addEventListener !== "function") return;
    watching = true;
    addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch") used = "touch";
        else if (e.pointerType === "mouse") used = "desk";
      },
      { capture: true, passive: true }
    );
  }

  // packages/sdk/src/settings.ts
  var arrived2 = {};
  var parts = /* @__PURE__ */ new Map();
  function arriveWith(settings) {
    arrived2 = cleanSettings(settings);
  }
  function arrivedSettings() {
    return arrived2;
  }
  function reportSettings(part, now) {
    parts.set(part, now);
    return () => {
      if (parts.get(part) === now) parts.delete(part);
    };
  }
  function currentSettings() {
    let out = { ...arrived2 };
    for (const now of parts.values()) {
      let said = {};
      try {
        said = cleanSettings(now());
      } catch {
      }
      out = { ...out, ...said, ...said.sound || out.sound ? { sound: { ...out.sound, ...said.sound } } : {} };
    }
    return cleanSettings(out);
  }

  // packages/sdk/src/ui/fullscreen.ts
  var resumed = false;
  var waiting = false;
  var FULL_KEY = "nswp:full";
  var prefers = false;
  var keepFull = (on) => {
    prefers = on;
    try {
      if (on) localStorage.setItem(FULL_KEY, "1");
      else localStorage.removeItem(FULL_KEY);
    } catch {
    }
  };
  function resumeFullscreen(presenting = () => false) {
    if (resumed || typeof document === "undefined") return;
    resumed = true;
    const came = arrivedSettings().full;
    let kept = false;
    try {
      kept = localStorage.getItem(FULL_KEY) === "1";
    } catch {
    }
    if (came === void 0) prefers = kept;
    else keepFull(came);
    reportSettings("screen", () => ({ full: prefers }));
    waiting = prefers && document.fullscreenEnabled && !document.fullscreenElement;
    if (!waiting) return;
    const presses = ["keydown", "pointerdown", "pointerup", "touchend"];
    const stop = () => {
      waiting = false;
      for (const type of presses) removeEventListener(type, onPress, true);
      document.removeEventListener("fullscreenchange", onChange);
    };
    const onChange = () => {
      if (document.fullscreenElement) stop();
    };
    const onPress = (e) => {
      if (e.code === "Escape" || presenting() || document.fullscreenElement) return;
      void document.documentElement.requestFullscreen().then(stop, () => {
      });
    };
    for (const type of presses) addEventListener(type, onPress, true);
    document.addEventListener("fullscreenchange", onChange);
  }
  function fullscreenAction(controls2, presenting) {
    resumeFullscreen(presenting);
    setTimeout(() => {
      if (waiting && !presenting()) controls2.say("Press any key, or click, to fill the screen again.");
    }, 600);
    return {
      id: "fullscreen",
      section: "view",
      icon: "size",
      on: () => prefers,
      // Not every browser lets a page fill the screen (a phone's often won't), and a headset already does.
      hidden: () => !document.fullscreenEnabled || presenting(),
      // It says what they prefer, in every world, and whether the screen is filled just now.
      label: () => !prefers ? "Fullscreen: off" : document.fullscreenElement ? "Fullscreen: on, in every world" : "Fullscreen: on, in every world. Press to fill the screen again",
      act: async () => {
        const fill = !document.fullscreenElement;
        if (!fill) keepFull(false);
        try {
          if (fill) {
            await document.documentElement.requestFullscreen();
            keepFull(true);
          } else await document.exitFullscreen();
        } catch {
          controls2.say("This browser wouldn't go fullscreen.");
        }
        controls2.setTarget("");
      }
    };
  }

  // packages/sdk/src/index.ts
  var RETURN_KEY = "nswp:return-airlock";
  var SIGNER_KEY = "nswp:signer";
  var LOOK_KEY = "nswp:look";
  var PASS_KEY = "nswp:pass";
  var HOME_KEY = "nswp:at-home";
  var defaultAirlock;
  var cached;
  function configure(opts) {
    if (opts.defaultAirlock !== void 0) {
      const chk = checkDestination(opts.defaultAirlock);
      if (!chk.ok) throw new Error(`nswp-sdk: defaultAirlock must be an https URL (${chk.error.code})`);
      defaultAirlock = chk.value.url;
    }
  }
  function session() {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
  var arrival = {
    /**
     * Read the arrival context once, then remove it from the URL so it doesn't
     * linger in history or reach third-party scripts. Call this before loading
     * any third-party code. Later calls return the same result.
     */
    read() {
      if (cached) return cached;
      try {
        document.documentElement.dataset.nswpKit = KIT_VERSION;
      } catch {
      }
      void localMap();
      const raw = arrivalParam(location.hash);
      if (!raw) {
        cached = { context: null, warnings: [] };
        arriveAs(void 0);
        return cached;
      }
      history.replaceState(history.state, "", `${location.pathname}${location.search}${stripArrivalParam(location.hash)}`);
      const r = decodeArrival(raw);
      cached = r.ok ? { context: r.value, warnings: r.warnings } : { context: null, warnings: [...r.errors, ...r.warnings] };
      arriveAs(cached.context?.form);
      arriveWith(cached.context?.settings);
      resumeFullscreen();
      try {
        if (cached.context?.home) session()?.setItem(HOME_KEY, "1");
        else if (cached.context) session()?.removeItem(HOME_KEY);
      } catch {
      }
      if (cached.context?.airlock) {
        try {
          session()?.setItem(RETURN_KEY, cached.context.airlock);
        } catch {
        }
      }
      if (cached.context) {
        try {
          if (cached.context.signer) session()?.setItem(SIGNER_KEY, cached.context.signer);
          else session()?.removeItem(SIGNER_KEY);
        } catch {
        }
      }
      if (cached.context) {
        try {
          if (cached.context.look) session()?.setItem(LOOK_KEY, cached.context.look);
          else session()?.removeItem(LOOK_KEY);
          const { pass, sessionKey } = cached.context;
          if (pass && sessionKey && verifyRoomPass(pass, { origin: location.origin }).ok) session()?.setItem(PASS_KEY, JSON.stringify({ pass, sessionKey }));
          else session()?.removeItem(PASS_KEY);
        } catch {
        }
      }
      return cached;
    },
    /**
     * The look this visitor arrived wearing, in its inline form (spec §4.2), or
     * undefined if they came plain. Hand it to a room so others see them as
     * they chose to be seen. Kept for this tab's session only.
     */
    look() {
      try {
        return session()?.getItem(LOOK_KEY) ?? void 0;
      } catch {
        return void 0;
      }
    },
    /**
     * Who this visitor chose to be here, if they came by name
     * (protocol/10-identity.md): their public key, the name on their pass, and
     * the pass and session key to hand to a room. Checked against this site and
     * the clock each time; undefined for a guest, and once the pass has run out.
     * The world never sees their own key, only this throwaway one.
     */
    identity() {
      try {
        const kept = JSON.parse(session()?.getItem(PASS_KEY) ?? "null");
        if (!kept?.pass || typeof kept.sessionKey !== "string") return void 0;
        const checked = verifyRoomPass(kept.pass, { origin: location.origin });
        if (!checked.ok) {
          session()?.removeItem(PASS_KEY);
          return void 0;
        }
        const { pubkey, name, picture, about } = checked.value;
        return { pubkey, name, ...picture ? { picture } : {}, ...about ? { about } : {}, pass: kept.pass, sessionKey: kept.sessionKey };
      } catch {
        return void 0;
      }
    },
    /**
     * Keep a pass made for this site after arriving: the one the visitor's signer made when they signed in here
     * (protocol/10-identity.md, "A pass from the signer"). It is checked as an arrival's is, and kept the same way,
     * for this tab. False if it doesn't check out.
     */
    keepIdentity(pass, sessionKey) {
      try {
        if (!/^[0-9a-f]{64}$/.test(sessionKey) || !verifyRoomPass(pass, { origin: location.origin }).ok) return false;
        session()?.setItem(PASS_KEY, JSON.stringify({ pass, sessionKey }));
        return true;
      } catch {
        return false;
      }
    },
    /** The Airlock this visitor came from, for this tab's session only. */
    /**
     * Whether this world is where the visitor starts: their own client brought
     * them home (NSWP-07). Remembered for the tab, so a refresh at home is
     * still at home. From here the way home leads nowhere new.
     */
    atHome() {
      try {
        return session()?.getItem(HOME_KEY) === "1";
      } catch {
        return false;
      }
    },
    /**
     * Where the visitor's client said their signer is, or undefined: then it
     * is beside the Airlock (protocol/10-identity.md, "Signing from a world").
     */
    signer() {
      try {
        return session()?.getItem(SIGNER_KEY) ?? void 0;
      } catch {
        return void 0;
      }
    },
    returnAirlock() {
      try {
        return session()?.getItem(RETURN_KEY) ?? void 0;
      } catch {
        return void 0;
      }
    }
  };
  var carried = (opts, immersive) => ({
    immersive,
    ...opts.joined ? { joined: true, ...opts.mic ? { mic: true } : {} } : {},
    ...opts.blocked?.length ? { blocked: opts.blocked } : {},
    ...opts.moving === "intense" ? { moving: "intense" } : {},
    form: opts.form ?? currentForm(),
    // Their settings as they are now, so the next place needn't be set up again.
    settings: currentSettings()
  });
  var portal = {
    /** Which Airlock `go()` would use right now, or null for the built-in screen. */
    airlockFor(opts = {}) {
      return opts.airlock ?? arrival.returnAirlock() ?? defaultAirlock ?? null;
    },
    async go(dest, opts = {}) {
      if (!dest.naddr && !dest.url) throw new Error("nswp-sdk: portal destination needs an naddr or a url");
      if (dest.url) {
        const chk = checkDestination(dest.url);
        if (!chk.ok) throw new Error(`nswp-sdk: refusing portal destination (${chk.error.code})`);
      }
      const immersive = opts.immersive ?? !!opts.xrSession;
      if (opts.xrSession) {
        try {
          await opts.xrSession.end();
        } catch {
        }
      }
      if (typeof window.nswp?.navigate === "function") {
        window.nswp.navigate(dest);
        return;
      }
      const airlock = portal.airlockFor(opts);
      if (airlock) {
        location.assign(await toLocal(buildAirlockUrl(airlock, dest, carried(opts, immersive))));
        return;
      }
      showFallback(dest);
    },
    /**
     * Take the visitor back to their own client's start place (spec §6.3): the
     * Airlock they came through, opened with no destination. Returns false, and
     * does nothing, when there is no Airlock to go back to.
     */
    async home(opts = {}) {
      const airlock = portal.airlockFor(opts);
      if (!airlock) return false;
      const immersive = opts.immersive ?? !!opts.xrSession;
      if (opts.xrSession) {
        try {
          await opts.xrSession.end();
        } catch {
        }
      }
      location.assign(await toLocal(buildWayUrl(airlock, carried(opts, immersive))));
      return true;
    },
    /**
     * This world's own door: the announcement its manifest lists for this page,
     * and its address. It is what sends a visitor back here through their own
     * client, which checks it like any other door. With no manifest, or none
     * that names this page, the door is the address alone.
     */
    async here() {
      const url = await fromLocal(new URL(location.pathname, location.origin).href);
      try {
        const res = await fetch(WELL_KNOWN_PATH, { signal: AbortSignal.timeout(2500), credentials: "omit" });
        const parsed = res.ok ? parseManifest(await res.json()) : null;
        if (parsed?.ok) return doorFor(parsed.value, url);
      } catch {
      }
      return { url };
    },
    /**
     * The visitor asked to say who they are: to sign in, switch to another
     * profile, or go on as a guest. A world never asks that itself
     * (protocol/09-what-a-world-owes.md), so this leaves for their own client
     * with a door back here and the request (`who=1`). Their client asks them
     * in its own way and brings them back, by name if they chose that
     * (protocol/10-identity.md, "Signing in from inside a world"). Returns
     * false, and does nothing, when they came through no client.
     */
    async signIn(opts = {}) {
      return portal.ask("identity", opts);
    },
    /**
     * The visitor asked to change how they look. A look is theirs, kept by
     * their own client, and a world never edits one or sends one back: a look
     * a world could write would be a mark it could follow them by
     * (protocol/05-looks.md). So, like signing in, this leaves for their own
     * client with a door back here (`who=look`). Returns false, and does
     * nothing, when they came through no client.
     */
    async changeLook(opts = {}) {
      return portal.ask("look", opts);
    },
    /** To the visitor's own client for something that is theirs, and back here. */
    async ask(what, opts = {}) {
      const airlock = portal.airlockFor(opts);
      if (!airlock) return false;
      const immersive = opts.immersive ?? !!opts.xrSession;
      const here = await portal.here();
      if (opts.xrSession) {
        try {
          await opts.xrSession.end();
        } catch {
        }
      }
      location.assign(await toLocal(buildAirlockUrl(airlock, here, { ...carried(opts, immersive), who: what === "look" ? "look" : true })));
      return true;
    },
    /**
     * Take the visitor to their doors: their client's own place for them. For
     * most visitors that is where home is too. It is a different place for one
     * whose home is a world of their own, and a world that can be a home
     * offers this wherever it offers the way home (protocol/07-homes.md).
     */
    async doors(opts = {}) {
      const airlock = portal.airlockFor(opts);
      if (!airlock) return false;
      const immersive = opts.immersive ?? !!opts.xrSession;
      if (opts.xrSession) {
        try {
          await opts.xrSession.end();
        } catch {
        }
      }
      location.assign(await toLocal(buildWayUrl(airlock, { ...carried(opts, immersive), doors: true })));
      return true;
    }
  };
  function showFallback(dest) {
    const chk = dest.url ? checkDestination(dest.url) : null;
    const host = document.createElement("div");
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.72);font:16px/1.4 system-ui,sans-serif;color:#fff";
    const card = document.createElement("div");
    card.style.cssText = "background:#16181d;border:1px solid #333;border-radius:12px;padding:24px;max-width:min(92vw,480px)";
    const h = document.createElement("p");
    h.textContent = "This portal leads to:";
    h.style.margin = "0 0 8px";
    const where = document.createElement("p");
    where.style.cssText = "margin:0 0 16px;font-size:1.6em;word-break:break-all";
    if (chk?.ok) {
      const pre = document.createElement("span");
      pre.textContent = chk.value.hostPrefix;
      pre.style.opacity = "0.6";
      const dom = document.createElement("strong");
      dom.textContent = chk.value.registrableDomain ?? chk.value.hostname;
      where.append(pre, dom);
    } else where.textContent = "A world this page can't look up without an Airlock.";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:12px;justify-content:flex-end";
    const cancel = document.createElement("button");
    cancel.textContent = "Stay here";
    const go2 = document.createElement("button");
    go2.textContent = "Continue";
    for (const b of [cancel, go2]) b.style.cssText = "font:inherit;padding:10px 18px;border-radius:8px;border:1px solid #555;background:#23262d;color:#fff;cursor:pointer";
    go2.style.background = "#2f6df6";
    go2.disabled = !chk?.ok;
    cancel.onclick = () => host.remove();
    go2.onclick = () => {
      if (chk?.ok) void toLocal(buildArrivalUrl(chk.value.url, dest.entryPoint ? { entry: dest.entryPoint } : {})).then((to) => location.assign(to));
    };
    row.append(cancel, go2);
    card.append(h, where, row);
    host.append(card);
    document.body.append(host);
    go2.focus();
  }

  // packages/sdk/src/desk.ts
  var DESK_PREFS_KEY = "nswp:desk";
  var LOOK_STEPS = [
    { value: 0.5, word: "slow" },
    { value: 0.75, word: "gentle" },
    { value: 1, word: "normal" },
    { value: 1.5, word: "quick" },
    { value: 2, word: "fast" },
    { value: 3, word: "fastest" }
  ];
  var FOV_STEPS = [null, 60, 70, 80, 90, 100, 110];
  var clampLook = (v) => typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(LOOK_RANGE[1], Math.max(LOOK_RANGE[0], v)) * 100) / 100 : 1;
  var clampFov = (v) => typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(FOV_RANGE[1], Math.max(FOV_RANGE[0], v))) : null;
  var prefs = null;
  var watchers = /* @__PURE__ */ new Set();
  var keep = (p) => {
    try {
      localStorage.setItem(DESK_PREFS_KEY, JSON.stringify(p));
    } catch {
    }
  };
  function load() {
    if (prefs) return prefs;
    let kept = {};
    try {
      kept = JSON.parse(localStorage.getItem(DESK_PREFS_KEY) ?? "{}") ?? {};
    } catch {
    }
    const came = arrivedSettings();
    prefs = { look: clampLook(came.look ?? kept.look), fov: came.fov !== void 0 ? clampFov(came.fov) : clampFov(kept.fov) };
    if (came.look !== void 0 || came.fov !== void 0) keep(prefs);
    reportSettings("desk", () => ({ look: load().look, ...load().fov === null ? {} : { fov: load().fov } }));
    return prefs;
  }
  var change = (next) => {
    prefs = next;
    keep(next);
    for (const w of watchers) w();
  };
  var lookScale = () => load().look;
  var setLookScale = (v) => change({ ...load(), look: clampLook(v) });
  var visitorFov = () => currentForm() === "desk" ? load().fov : null;
  var setVisitorFov = (v) => change({ ...load(), fov: v === null ? null : clampFov(v) });
  function onDeskChange(cb) {
    watchers.add(cb);
    return () => void watchers.delete(cb);
  }
  var after = (steps, at) => steps[(at + 1) % steps.length];
  function addDeskControls(controls2, o) {
    const lookAt = () => {
      const now = lookScale();
      let best = 0;
      LOOK_STEPS.forEach((s, i) => {
        if (Math.abs(s.value - now) < Math.abs(LOOK_STEPS[best].value - now)) best = i;
      });
      return best;
    };
    controls2.add(
      {
        id: "look-speed",
        section: "moving",
        icon: "turn",
        hidden: o.presenting,
        label: () => `Look speed: ${LOOK_STEPS[lookAt()].word}`,
        short: "Look speed",
        act: () => {
          setLookScale(after(LOOK_STEPS, lookAt()).value);
          controls2.say(`Look speed: ${LOOK_STEPS[lookAt()].word}. It is the same in every world.`);
        }
      },
      {
        id: "fov",
        section: "view",
        icon: "size",
        // A touch screen's view is fitted to its window by the world, and a headset has its own.
        hidden: () => o.presenting() || currentForm() !== "desk",
        label: () => load().fov === null ? "Field of view: this world's own" : `Field of view: ${load().fov}\xB0`,
        short: "View width",
        act: () => {
          const at = FOV_STEPS.indexOf(load().fov);
          setVisitorFov(after(FOV_STEPS, at === -1 ? 0 : at));
          controls2.say(load().fov === null ? "Field of view: each world's own." : `Field of view: ${load().fov}\xB0, in every world.`);
        }
      }
    );
    onDeskChange(() => controls2.setTarget(""));
  }

  // packages/sdk/src/stroll.ts
  var WALK_SPEED = 2.4;
  var RUN = 1.75;
  var TOP_SPEED = WALK_SPEED * RUN;
  var DOUBLE_TAP = 400;
  var TAP_REACH = 6;
  var DRAG_LOOK = 5e-3;

  // packages/sdk/src/fps.ts
  var LOOK_SPEED = 22e-4;
  var PITCH_LIMIT = 85 * Math.PI / 180;
  var SPRINT = RUN;
  var DESK_KEY = "nswp:fps";
  var DESK_WORDS = {
    intense: "Desk controls: intense",
    casual: "Desk controls: casual",
    nowIntense: "Intense: the mouse looks round. W, A, S, D walk, Shift runs, Space jumps, F uses what is in front of you, and Escape brings up this menu.",
    nowCasual: "Casual: click where you want to stand, twice to run there, and drag to look round. W, A, S, D walk, Shift runs and Space jumps."
  };
  var hasMouse = () => startingForm() === "desk";
  function startsIntense(arrived3, key = DESK_KEY) {
    if (!hasMouse()) return false;
    const prefers2 = arrivedSettings().intense;
    if (typeof prefers2 === "boolean") return prefers2;
    try {
      return arrived3 || localStorage.getItem(key) === "1";
    } catch {
      return arrived3;
    }
  }
  function keepIntense(on, key = DESK_KEY) {
    try {
      if (on) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
    } catch {
    }
  }

  // packages/sdk/src/gate-size.ts
  var PORTAL_WIDTH = 1.5;
  var PORTAL_HEIGHT = 2.1;
  var PORTAL_SPRING = PORTAL_HEIGHT - PORTAL_WIDTH / 2;
  var PORTAL_SIGN_HEIGHT = PORTAL_HEIGHT + 0.72;
  var DOOR_REACH = 3.05;

  // packages/sdk/src/panel-store.ts
  var PANEL_LIMITS = {
    count: 24,
    titleChars: 80,
    noteChars: 4e3,
    srcChars: 2048,
    minWidth: 0.3,
    maxWidth: 3,
    /** A panel is never kept further from the middle of a world than this, in metres. */
    reach: 500,
    /** The largest file of the visitor's own that is kept, in bytes. */
    fileBytes: 64 * 1024 * 1024
  };

  // packages/sdk/src/library.ts
  var DB = "nswp-panels";
  function files() {
    return new Promise((resolve, reject) => {
      const open2 = indexedDB.open(DB, 1);
      open2.onupgradeneeded = () => open2.result.createObjectStore("files");
      open2.onsuccess = () => resolve(open2.result);
      open2.onerror = () => reject(open2.error);
    });
  }
  async function fileStore(mode, run2) {
    try {
      const db = await files();
      return await new Promise((resolve, reject) => {
        const request = run2(db.transaction("files", mode).objectStore("files"));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return void 0;
    }
  }

  // packages/sdk/src/sound-store.ts
  var CUES = [
    "step",
    // a footstep, walking
    "land",
    // arriving at the end of a jump: a step in a headset, or one taken at once
    "bump",
    // walking into something that can't be walked through
    "grab",
    "drop",
    "hover",
    "press",
    "menuOpen",
    "menuClose",
    "cross",
    // leaving through a door
    "arrive",
    // coming out of one
    "join",
    // someone is in the room who wasn't: the visitor, or another person
    "leave",
    "micOn",
    "micOff",
    "notice",
    // the kit has something to say
    "chat",
    // someone in the room wrote something: heard from where they stand
    "error"
  ];
  var tone = (from, to, at, dur, gain, wave = "sine") => ({
    kind: "tone",
    wave,
    from,
    ...to === void 0 ? {} : { to },
    at,
    dur,
    gain
  });
  var noise = (band, at, dur, gain) => ({ kind: "noise", band, at, dur, gain });
  var RECIPES = {
    step: [noise(850, 0, 0.06, 0.2), tone(120, 70, 0, 0.07, 0.16)],
    land: [tone(190, 62, 0, 0.16, 0.3), noise(480, 0, 0.11, 0.2)],
    bump: [tone(96, 58, 0, 0.12, 0.28, "triangle"), noise(260, 0, 0.05, 0.14)],
    grab: [tone(520, 780, 0, 0.07, 0.16, "triangle")],
    drop: [tone(700, 420, 0, 0.08, 0.16, "triangle")],
    hover: [tone(1400, void 0, 0, 0.025, 0.05)],
    press: [tone(880, 1320, 0, 0.05, 0.15, "triangle")],
    menuOpen: [tone(660, void 0, 0, 0.05, 0.12), tone(990, void 0, 0.05, 0.07, 0.12)],
    menuClose: [tone(990, void 0, 0, 0.05, 0.12), tone(660, void 0, 0.05, 0.07, 0.12)],
    cross: [tone(196, 784, 0, 0.5, 0.22), noise(1400, 0.05, 0.45, 0.07), tone(392, 1568, 0.1, 0.4, 0.08)],
    arrive: [tone(784, 392, 0, 0.42, 0.2), tone(1176, 588, 0.04, 0.38, 0.08), noise(900, 0, 0.2, 0.05)],
    join: [tone(523.25, void 0, 0, 0.09, 0.14), tone(783.99, void 0, 0.09, 0.14, 0.14)],
    leave: [tone(783.99, void 0, 0, 0.09, 0.12), tone(523.25, void 0, 0.09, 0.14, 0.12)],
    micOn: [tone(600, 900, 0, 0.08, 0.14)],
    micOff: [tone(900, 600, 0, 0.08, 0.14)],
    notice: [tone(1046.5, void 0, 0, 0.08, 0.09), tone(1318.5, void 0, 0.08, 0.12, 0.08)],
    // Two soft syllables, low and falling at the end, with a breath in front: somebody said something. It is two
    // octaves under the kit's own notice, which is high, clean and rises, so the two are never taken for each other.
    chat: [noise(1900, 0, 0.03, 0.06), tone(360, 440, 5e-3, 0.07, 0.15, "triangle"), tone(330, 262, 0.1, 0.11, 0.13, "triangle")],
    error: [tone(220, void 0, 0, 0.11, 0.13, "square"), tone(185, void 0, 0.14, 0.14, 0.13, "square")]
  };
  function cueRecipe(cue) {
    return RECIPES[cue];
  }
  var SOUND_LIMITS = {
    /** A world's own cue: a file this size at most, this long at most. Longer ones aren't sounds for something that happened. */
    cueBytes: 512 * 1024,
    cueSeconds: 3,
    /** Kinds of file a world may name. */
    extensions: ["ogg", "oga", "opus", "mp3", "m4a", "aac", "wav", "webm", "flac"],
    /** Files for one cue: one is chosen each time, so a sound heard often isn't the same sound every time. */
    variants: 6,
    /** Pieces of music for one place: they play in turn. */
    tracks: 8,
    /** The visitor's own songs: this many, each this size at most. */
    songs: 60,
    songBytes: 40 * 1024 * 1024,
    titleChars: 80
  };
  function ownSound(address, base) {
    if (typeof address !== "string" || address.length > 2e3) return null;
    let u;
    let b;
    try {
      b = new URL(base);
      u = new URL(address, b);
    } catch {
      return null;
    }
    if (u.origin !== b.origin || u.protocol !== "https:" && u.protocol !== "http:") return null;
    const ext = u.pathname.split(".").pop()?.toLowerCase() ?? "";
    if (!SOUND_LIMITS.extensions.includes(ext)) return null;
    u.hash = "";
    return u.href;
  }
  function ownSounds(value, base, limit) {
    const out = [];
    for (const v of Array.isArray(value) ? value : [value]) {
      const address = ownSound(v, base);
      if (address && !out.includes(address)) out.push(address);
      if (out.length >= limit) break;
    }
    return out;
  }
  function cleanTheme(input, base) {
    const out = { cues: {} };
    if (!input || typeof input !== "object") return out;
    const { cues, music, hum } = input;
    if (cues && typeof cues === "object") {
      for (const cue of CUES) {
        const v = cues[cue];
        if (v === null) out.cues[cue] = null;
        else if (v !== void 0) {
          const files2 = ownSounds(v, base, SOUND_LIMITS.variants);
          if (files2.length) out.cues[cue] = files2;
        }
      }
    }
    if (music === null) out.music = null;
    else if (music !== void 0) {
      const tracks = ownSounds(music, base, SOUND_LIMITS.tracks);
      if (tracks.length) out.music = tracks;
    }
    if (hum === null) out.hum = null;
    else if (hum !== void 0) {
      const address = ownSound(hum, base);
      if (address) out.hum = address;
    }
    return out;
  }
  function cleanKit(input, folder, playsOgg) {
    const out = { cues: {} };
    if (!input || typeof input !== "object") return out;
    const pick = (entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const { ogg, mp3 } = entry;
      return playsOgg ? ogg ?? mp3 : mp3 ?? ogg;
    };
    const many = (value, limit) => ownSounds((Array.isArray(value) ? value : [value]).map(pick), folder, limit);
    const { cues, music, hum } = input;
    if (cues && typeof cues === "object") {
      for (const cue of CUES) {
        const files2 = many(cues[cue], SOUND_LIMITS.variants);
        if (files2.length) out.cues[cue] = files2;
      }
    }
    const tracks = many(music, SOUND_LIMITS.tracks);
    if (tracks.length) out.music = tracks;
    const h = ownSound(pick(hum), folder);
    if (h) out.hum = h;
    return out;
  }
  function pieceName(address) {
    let name = address;
    try {
      name = decodeURIComponent(new URL(address, "https://x.invalid/").pathname.split("/").pop() ?? "");
    } catch {
      name = address.split(/[/?#]/).filter(Boolean).pop() ?? "";
    }
    name = name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\u0000-\u001f]/g, "").trim();
    return name.slice(0, 60) || "a piece with no name";
  }
  var STEP_LEVEL = 0.45;
  var HEARD = { near: 2, far: 25, floor: 0.14, fall: 6 };
  function heardFrom(place) {
    const d = Number.isFinite(place.distance) ? Math.max(0, place.distance) : HEARD.far;
    const beyond = Math.max(0, d - HEARD.near);
    const gain = Math.max(HEARD.floor, 1 / (1 + (beyond / HEARD.fall) ** 2));
    const along = Math.min(1, beyond / (HEARD.far - HEARD.near));
    const cutoff = Math.round(7e3 * (1100 / 7e3) ** along);
    const side = Number.isFinite(place.pan) ? Math.max(-1, Math.min(1, place.pan)) : 0;
    return { gain: Math.round(gain * 1e3) / 1e3, cutoff, pan: Math.round(side * 0.8 * 100) / 100, rate: 1 };
  }
  function stepShape(foot, random = Math.random) {
    const right = Math.abs(Math.trunc(foot)) % 2 === 1;
    const side = right ? 1 : -1;
    return {
      // Between a little over half and all of the step's level: a light tread now and then.
      gain: STEP_LEVEL * (0.6 + 0.4 * random()),
      // One foot falls a touch lower than the other, and each step is up to a semitone and a half either way.
      rate: (1 + side * 0.025) * Math.pow(2, (random() * 2 - 1) * (1.5 / 12)),
      cutoff: 1600 + random() * 3400,
      pan: side * (0.08 + random() * 0.1)
    };
  }
  function nextVariant(count, last, random = Math.random) {
    if (count <= 1) return 0;
    if (last < 0 || last >= count) return Math.min(count - 1, Math.floor(random() * count));
    const i = Math.floor(random() * (count - 1));
    return i >= last ? i + 1 : i;
  }
  var DEFAULT_LEVELS = { off: false, effects: 0.7, music: 0.45, voices: 1, hearShared: false, shared: 0.7, hum: true };
  var LEVEL_STEPS = [0, 0.35, 0.7, 1];
  var LEVEL_WORDS = ["off", "low", "medium", "high"];
  var unit = (v, fallback) => typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  function cleanLevels(input) {
    const i = input && typeof input === "object" ? input : {};
    return {
      off: i.off === true,
      effects: unit(i.effects, DEFAULT_LEVELS.effects),
      music: unit(i.music, DEFAULT_LEVELS.music),
      voices: unit(i.voices, DEFAULT_LEVELS.voices),
      hearShared: i.hearShared === true,
      shared: unit(i.shared, DEFAULT_LEVELS.shared),
      hum: i.hum !== false
    };
  }
  function levelStep(v) {
    let best = 0;
    LEVEL_STEPS.forEach((s, i) => {
      if (Math.abs(s - v) < Math.abs(LEVEL_STEPS[best] - v)) best = i;
    });
    return best;
  }
  function nextLevel(v) {
    return LEVEL_STEPS[(levelStep(v) + 1) % LEVEL_STEPS.length];
  }
  function seeded(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    let a = h >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var ROOTS = [98, 110, 116.54, 130.81, 146.83, 155.56];
  var SCALES = [
    [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3],
    // major pentatonic: open, bright
    [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5],
    // minor pentatonic: darker
    [1, 9 / 8, 4 / 3, 3 / 2, 16 / 9],
    // suspended: unresolved, still
    [1, 5 / 4, 3 / 2, 15 / 8, 9 / 4]
    // major seventh: warm
  ];
  function ambiencePlan(seed) {
    const r = seeded(`ambience:${seed}`);
    const root = ROOTS[Math.floor(r() * ROOTS.length)];
    const scale = SCALES[Math.floor(r() * SCALES.length)];
    const fifth = scale.includes(3 / 2) ? 3 / 2 : scale[3];
    const drones = [1, fifth, 2, scale[2] * 2].map((m) => ({ hz: root * m, detune: (r() - 0.5) * 14, swell: 11 + r() * 18 }));
    const least = 3.5 + r() * 3;
    return { root, scale, drones, colour: 500 + r() * 900, gap: [least, least + 3 + r() * 4] };
  }
  function songTitle(fileName) {
    const raw = typeof fileName === "string" ? fileName : "";
    const cleaned = raw.split(/[\\/]/).pop().replace(/\.[a-z0-9]{1,5}$/i, "").normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ").replace(/[_\s]+/g, " ").trim();
    return [...cleaned].slice(0, SOUND_LIMITS.titleChars).join("").trim() || "A song";
  }
  function cleanSongs(input) {
    if (!Array.isArray(input)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const s of input) {
      if (!s || typeof s !== "object") continue;
      const { id, title, size, at } = s;
      if (typeof id !== "string" || !/^[a-z0-9-]{4,40}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, title: songTitle(title), size: typeof size === "number" && size > 0 ? Math.floor(size) : 0, at: typeof at === "number" && at > 0 ? Math.floor(at) : 0 });
      if (out.length >= SOUND_LIMITS.songs) break;
    }
    return out;
  }
  function songRefusal(file, have) {
    const ext = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
    const isSound = (file.type ?? "").startsWith("audio/") || SOUND_LIMITS.extensions.includes(ext);
    if (!isSound) return "That isn't a sound file.";
    if (!file.size) return "That file is empty.";
    if (file.size > SOUND_LIMITS.songBytes) return `That file is over ${Math.round(SOUND_LIMITS.songBytes / 1024 / 1024)} MB, which is more than is kept here.`;
    if (have >= SOUND_LIMITS.songs) return `${SOUND_LIMITS.songs} songs are kept here at most. Take one out first.`;
    return null;
  }

  // packages/sdk/src/sound.ts
  var GAP = { step: 0.14, hover: 0.08, bump: 0.5, land: 0.2, notice: 0.25, chat: 0.3 };
  var STRIDE = 0.75;
  var JUMP = 1.2;
  function createSounds(o = {}) {
    const ctx = o.context ?? new AudioContext();
    const base = o.base ?? location.href;
    const theme = cleanTheme(o.theme, base);
    const levelsKey = o.keep?.levels ?? "nswp:sound";
    const songsKey = o.keep?.songs ?? "nswp:jukebox";
    const read4 = (key) => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "null");
      } catch {
        return null;
      }
    };
    const write = (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
      }
    };
    const came = arrivedSettings().sound;
    let levels = cleanLevels({ ...read4(levelsKey), ...came });
    let songs = cleanSongs(read4(songsKey));
    let disposed = false;
    if (came) write(levelsKey, levels);
    const stopReporting = reportSettings("sound", () => ({ sound: { off: levels.off, effects: levels.effects, music: levels.music, voices: levels.voices, hum: levels.hum } }));
    const master = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 10;
    limiter.ratio.value = 12;
    limiter.attack.value = 3e-3;
    limiter.release.value = 0.25;
    const meter = ctx.createAnalyser();
    meter.fftSize = 1024;
    master.connect(limiter);
    limiter.connect(meter);
    limiter.connect(ctx.destination);
    const effects = ctx.createGain();
    const placeMusic = ctx.createGain();
    const ownMusic = ctx.createGain();
    for (const g of [effects, placeMusic, ownMusic]) g.connect(master);
    const humGain = ctx.createGain();
    humGain.connect(placeMusic);
    const listeners = /* @__PURE__ */ new Set();
    const changed = () => {
      for (const fn of listeners) {
        try {
          fn(levels);
        } catch (err) {
          console.error("nswp-sdk sound listener failed", err);
        }
      }
    };
    const juke = { audio: null, url: "", current: null, playing: false, tap: null };
    const apply = () => {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(levels.off ? 0 : 1, t, 0.05);
      effects.gain.setTargetAtTime(levels.effects, t, 0.05);
      placeMusic.gain.setTargetAtTime(levels.music * (juke.playing ? 0.1 : 1), t, 0.4);
      ownMusic.gain.setTargetAtTime(levels.music, t, 0.05);
      humGain.gain.setTargetAtTime(levels.hum ? 1 : 0, t, 0.3);
    };
    apply();
    let noiseBuffer = null;
    const noise2 = () => {
      if (noiseBuffer) return noiseBuffer;
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      return noiseBuffer;
    };
    const playPart = (p, when, to = effects, rate = 1) => {
      const start2 = when + p.at;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start2);
      gain.gain.linearRampToValueAtTime(p.gain, start2 + Math.min(6e-3, p.dur / 3));
      gain.gain.exponentialRampToValueAtTime(8e-4, start2 + p.dur);
      gain.connect(to);
      if (p.kind === "tone") {
        const osc = ctx.createOscillator();
        osc.type = p.wave;
        osc.frequency.setValueAtTime(p.from * rate, start2);
        if (p.to !== void 0) osc.frequency.exponentialRampToValueAtTime(p.to * rate, start2 + p.dur);
        osc.connect(gain);
        osc.start(start2);
        osc.stop(start2 + p.dur + 0.02);
      } else {
        const src = ctx.createBufferSource();
        src.buffer = noise2();
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = p.band * rate;
        band.Q.value = 1.1;
        src.connect(band);
        band.connect(gain);
        src.start(start2, Math.random() * 0.5);
        src.stop(start2 + p.dur + 0.02);
      }
    };
    const CUE_LOUDNESS = 0.14;
    const loudnessOf = (buffer) => {
      let sum = 0;
      let n = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i += 4) {
          sum += data[i] * data[i];
          n++;
        }
      }
      return n ? Math.sqrt(sum / n) : 0;
    };
    const loadCue = async (address) => {
      try {
        const res = await fetch(address);
        if (!res.ok) return null;
        const bytes = await res.arrayBuffer();
        if (bytes.byteLength > SOUND_LIMITS.cueBytes) return null;
        const buffer = await ctx.decodeAudioData(bytes);
        if (buffer.duration > SOUND_LIMITS.cueSeconds || disposed) return null;
        const loud = loudnessOf(buffer);
        return { buffer, gain: loud > CUE_LOUDNESS ? CUE_LOUDNESS / loud : 1 };
      } catch {
        return null;
      }
    };
    const own = /* @__PURE__ */ new Map();
    const fromKit = /* @__PURE__ */ new Map();
    const loadInto = (into, files2) => {
      for (const [cue, addresses] of Object.entries(files2)) {
        for (const address of addresses ?? []) {
          void loadCue(address).then((loaded2) => {
            if (loaded2) into.set(cue, [...into.get(cue) ?? [], loaded2]);
          });
        }
      }
    };
    let kit2 = { cues: {} };
    const kitReady = o.kit ? (async () => {
      try {
        const folder = new URL(o.kit.endsWith("/") ? o.kit : `${o.kit}/`, base).href;
        const res = await fetch(new URL("sounds.json", folder).href);
        if (!res.ok) return;
        const playsOgg = new Audio().canPlayType('audio/ogg; codecs="opus"') !== "";
        kit2 = cleanKit(await res.json(), folder, playsOgg);
      } catch {
      }
    })() : Promise.resolve();
    let cuesAsked = false;
    const loadCues = () => {
      if (cuesAsked || disposed) return;
      cuesAsked = true;
      loadInto(own, theme.cues);
      void kitReady.then(() => {
        const rest = Object.fromEntries(Object.entries(kit2.cues).filter(([cue]) => theme.cues[cue] === void 0));
        loadInto(fromKit, rest);
      });
    };
    const last = /* @__PURE__ */ new Map();
    const lastVariant = /* @__PURE__ */ new Map();
    let foot = 0;
    const shaped = (shape) => {
      const soft = ctx.createBiquadFilter();
      soft.type = "lowpass";
      soft.frequency.value = shape.cutoff;
      soft.Q.value = 0.5;
      const level2 = ctx.createGain();
      level2.gain.value = shape.gain;
      soft.connect(level2);
      if (typeof ctx.createStereoPanner === "function") {
        const side = ctx.createStereoPanner();
        side.pan.value = shape.pan;
        level2.connect(side);
        side.connect(effects);
      } else level2.connect(effects);
      return soft;
    };
    const play2 = (cue, from) => {
      if (disposed || levels.off || levels.effects <= 0 || ctx.state !== "running") return;
      if (theme.cues[cue] === null) return;
      const now = ctx.currentTime;
      if (now - (last.get(cue) ?? -1) < (GAP[cue] ?? 0.03)) return;
      last.set(cue, now);
      const shape = cue === "step" ? stepShape(foot++) : from ? heardFrom(from) : null;
      const out = shape ? shaped(shape) : effects;
      const files2 = own.get(cue) ?? fromKit.get(cue);
      if (files2?.length) {
        const which = nextVariant(files2.length, lastVariant.get(cue) ?? -1);
        lastVariant.set(cue, which);
        const src = ctx.createBufferSource();
        src.buffer = files2[which].buffer;
        if (shape) src.playbackRate.value = shape.rate;
        const level2 = ctx.createGain();
        level2.gain.value = files2[which].gain;
        src.connect(level2);
        level2.connect(out);
        src.start();
        return;
      }
      for (const part of cueRecipe(cue)) playPart(part, now + 5e-3, out, shape?.rate ?? 1);
    };
    let walked = 0;
    const moved2 = (metres) => {
      if (!(metres > 5e-4)) return;
      if (metres > JUMP) {
        walked = 0;
        return play2("land");
      }
      walked += metres;
      if (walked >= STRIDE) {
        walked = 0;
        play2("step");
      }
    };
    const loopPlayer = (tracks, into, opts = {}) => {
      const fade = opts.fade ?? 2;
      const out = ctx.createGain();
      out.gain.value = opts.gain ?? 1;
      out.connect(into);
      const deck = () => {
        const audio = new Audio();
        audio.preload = "auto";
        const gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(audio).connect(gain);
        gain.connect(out);
        return { audio, gain };
      };
      const decks = [deck(), deck()];
      let active = 0;
      let index = 0;
      let heard = 0;
      let turning = false;
      let stopped = false;
      const curve = (rising) => Float32Array.from({ length: 32 }, (_, k) => (rising ? Math.sin : Math.cos)(k / 31 * Math.PI / 2));
      const turn = () => {
        if (turning || stopped) return;
        turning = true;
        const from = decks[active];
        const to = decks[1 - active];
        index = (index + 1) % tracks.length;
        to.audio.src = tracks[index];
        to.audio.currentTime = 0;
        void to.audio.play().then(
          () => {
            const t = ctx.currentTime + 0.02;
            from.gain.gain.cancelScheduledValues(t);
            to.gain.gain.cancelScheduledValues(t);
            from.gain.gain.setValueCurveAtTime(curve(false), t, fade);
            to.gain.gain.setValueCurveAtTime(curve(true), t, fade);
            active = 1 - active;
            heard = index;
            opts.onTurn?.();
            setTimeout(() => {
              from.audio.pause();
              turning = false;
            }, (fade + 0.1) * 1e3);
          },
          () => {
            turning = false;
          }
        );
      };
      for (const d of decks) {
        d.audio.addEventListener("timeupdate", () => {
          if (d !== decks[active] || !Number.isFinite(d.audio.duration)) return;
          if (d.audio.duration - d.audio.currentTime <= fade + 0.35) turn();
        });
        d.audio.addEventListener("ended", () => {
          if (d === decks[active]) turn();
        });
        d.audio.addEventListener("error", () => {
          if (stopped || d !== decks[active] || turning) return;
          stopped = true;
          opts.onFail?.();
        });
      }
      const first = decks[0];
      first.audio.src = tracks[0];
      void first.audio.play().then(
        () => first.gain.gain.setTargetAtTime(1, ctx.currentTime, 0.8),
        () => {
        }
      );
      return {
        stop() {
          stopped = true;
          for (const d of decks) {
            d.audio.pause();
            d.audio.removeAttribute("src");
          }
          out.disconnect();
        },
        /** How many times one piece has handed on to the next. For tests. */
        get index() {
          return index;
        },
        /** Where the piece that is heard now is kept. */
        get now() {
          return tracks[heard];
        },
        get count() {
          return tracks.length;
        },
        /** Hand on to the next piece now. */
        next() {
          if (tracks.length < 2 || turning || stopped) return false;
          turn();
          return true;
        }
      };
    };
    let kind = theme.music === null ? "none" : theme.music ? "world" : "made";
    let stopMusic = null;
    let pieces = null;
    let stopHum = null;
    let humAddress = null;
    let musicAsked = false;
    const startMusic = () => {
      if (musicAsked || disposed) return;
      musicAsked = true;
      loadCues();
      void kitReady.then(() => {
        if (disposed) return;
        humAddress = theme.hum === null ? null : theme.hum ?? kit2.hum ?? null;
        if (humAddress) stopHum = loopPlayer([humAddress], humGain, { gain: 0.55 }).stop;
        const tracks = theme.music === null ? null : theme.music ?? kit2.music ?? null;
        if (theme.music === void 0 && kit2.music) kind = "kit";
        changed();
        if (theme.music === null) return;
        if (tracks) {
          const player2 = loopPlayer(tracks, placeMusic, {
            gain: 0.6,
            onTurn: () => changed(),
            onFail: () => {
              stopMusic?.();
              pieces = null;
              kind = "made";
              stopMusic = madeMusic();
              changed();
            }
          });
          pieces = player2;
          stopMusic = player2.stop;
          changed();
          return;
        }
        stopMusic = madeMusic();
      });
    };
    const madeMusic = () => {
      const plan = ambiencePlan(o.seed ?? location.host);
      const bed = ctx.createGain();
      bed.gain.value = 0.12;
      const colour = ctx.createBiquadFilter();
      colour.type = "lowpass";
      colour.frequency.value = plan.colour;
      colour.connect(bed);
      bed.connect(placeMusic);
      const running = [];
      plan.drones.forEach((d, i) => {
        const osc = ctx.createOscillator();
        osc.type = i < 2 ? "sine" : "triangle";
        osc.frequency.value = d.hz;
        osc.detune.value = d.detune;
        const swell = ctx.createGain();
        swell.gain.value = i < 2 ? 0.3 : 0.14;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 1 / d.swell;
        const depth = ctx.createGain();
        depth.gain.value = swell.gain.value * 0.8;
        lfo.connect(depth);
        depth.connect(swell.gain);
        osc.connect(swell);
        swell.connect(colour);
        osc.start();
        lfo.start();
        running.push(osc, lfo);
      });
      const random = seeded(`notes:${o.seed ?? location.host}`);
      let timer;
      const note = () => {
        if (disposed) return;
        if (ctx.state === "running" && !levels.off && levels.music > 0) {
          const hz = plan.root * plan.scale[Math.floor(random() * plan.scale.length)] * (random() < 0.5 ? 2 : 4);
          const t = ctx.currentTime + 0.05;
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = hz;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.11, t + 0.5);
          g.gain.exponentialRampToValueAtTime(8e-4, t + 4.5);
          osc.connect(g);
          g.connect(bed);
          osc.start(t);
          osc.stop(t + 4.6);
        }
        timer = setTimeout(note, (plan.gap[0] + random() * (plan.gap[1] - plan.gap[0])) * 1e3);
      };
      timer = setTimeout(note, 1500);
      return () => {
        clearTimeout(timer);
        for (const n of running) {
          try {
            n.stop();
          } catch {
          }
        }
        bed.disconnect();
      };
    };
    const wake = () => {
      void ctx.resume().then(startMusic, () => {
      });
      if (ctx.state === "running") startMusic();
    };
    const onTouch = () => wake();
    addEventListener("pointerdown", onTouch, true);
    addEventListener("keydown", onTouch, true);
    if (ctx.state === "running") startMusic();
    const keepSongs = () => write(songsKey, songs);
    const stopOwn = () => {
      juke.audio?.pause();
      juke.playing = false;
      apply();
      changed();
    };
    const player = () => {
      if (!juke.audio || !juke.tap) {
        juke.audio = new Audio();
        const source = ctx.createMediaElementSource(juke.audio);
        source.connect(ownMusic);
        juke.tap = ctx.createMediaStreamDestination();
        source.connect(juke.tap);
        juke.audio.addEventListener("ended", () => void jukebox.next());
      }
      return { audio: juke.audio, tap: juke.tap };
    };
    const jukebox = {
      list: () => [...songs],
      async add(file) {
        const refusal = songRefusal({ type: file.type, size: file.size, ...file.name ? { name: file.name } : {} }, songs.length);
        if (refusal) return refusal;
        const id = `song-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const kept = await fileStore("readwrite", (s) => s.put(file, `song:${id}`));
        if (kept === void 0) return "This browser couldn't keep that file.";
        songs = cleanSongs([...songs, { id, title: songTitle(file.name ?? ""), size: file.size, at: Math.floor(Date.now() / 1e3) }]);
        keepSongs();
        changed();
        return null;
      },
      async remove(id) {
        if (juke.current?.id === id) {
          stopOwn();
          juke.current = null;
        }
        songs = songs.filter((s) => s.id !== id);
        keepSongs();
        await fileStore("readwrite", (s) => s.delete(`song:${id}`));
        changed();
      },
      async play(id) {
        const song = id ? songs.find((s) => s.id === id) : juke.current ?? songs[0];
        if (!song || disposed) return false;
        player();
        if (juke.current?.id !== song.id || !juke.url) {
          const file = await fileStore("readonly", (s) => s.get(`song:${song.id}`));
          if (!file) return false;
          if (juke.url) URL.revokeObjectURL(juke.url);
          juke.url = URL.createObjectURL(file);
          juke.audio.src = juke.url;
          juke.current = song;
        }
        try {
          await ctx.resume();
          await juke.audio.play();
        } catch {
          juke.playing = false;
          apply();
          changed();
          return false;
        }
        juke.playing = true;
        apply();
        changed();
        return true;
      },
      pause: stopOwn,
      async next() {
        if (songs.length === 0) return false;
        const at = songs.findIndex((s) => s.id === juke.current?.id);
        return jukebox.play(songs[(at + 1) % songs.length].id);
      },
      get playing() {
        return juke.playing;
      },
      get current() {
        return juke.current;
      },
      output: () => player().tap.stream.getAudioTracks()[0]
    };
    const samples = new Float32Array(meter.fftSize);
    return {
      play: play2,
      moved: moved2,
      bump: () => play2("bump"),
      get levels() {
        return levels;
      },
      setLevels(patch) {
        levels = cleanLevels({ ...levels, ...patch });
        write(levelsKey, levels);
        apply();
        changed();
      },
      jukebox,
      onChange(fn) {
        listeners.add(fn);
        fn(levels);
        return () => listeners.delete(fn);
      },
      get music() {
        return kind;
      },
      get piece() {
        return pieces ? { name: pieceName(pieces.now), of: pieces.count } : null;
      },
      nextPiece() {
        return pieces?.next() ?? false;
      },
      get hasHum() {
        return !!humAddress;
      },
      loudness() {
        meter.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((s, x) => s + x * x, 0) / samples.length);
      },
      dispose() {
        stopReporting();
        disposed = true;
        removeEventListener("pointerdown", onTouch, true);
        removeEventListener("keydown", onTouch, true);
        stopMusic?.();
        stopHum?.();
        juke.audio?.pause();
        if (juke.url) URL.revokeObjectURL(juke.url);
        master.disconnect();
      }
    };
  }
  function addSoundControls(controls2, sounds2) {
    const word = (v) => LEVEL_WORDS[levelStep(v)];
    let listed = [];
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "audio/*";
    picker.multiple = true;
    picker.hidden = true;
    document.body.append(picker);
    picker.addEventListener("change", async () => {
      let added = 0;
      let refused = "";
      for (const file of [...picker.files ?? []]) {
        const no = await sounds2.jukebox.add(file);
        if (no) refused = no;
        else added++;
      }
      picker.value = "";
      controls2.say(added ? `${added === 1 ? "1 song" : `${added} songs`} added. Only you hear your music.${refused ? ` ${refused}` : ""}` : refused || "Nothing was added.");
      refresh();
    });
    const refresh = () => {
      for (const id of listed) controls2.remove(id);
      const songs = sounds2.jukebox.list();
      listed = songs.map((s) => `song-${s.id}`);
      controls2.addSection({
        id: "sound",
        label: "Sound",
        icon: "sound",
        note: () => `${sounds2.levels.off ? "All sound is off. " : ""}${sounds2.music === "none" ? "This place has no music of its own." : sounds2.music === "world" ? "This place plays its own music." : sounds2.music === "kit" ? "This place plays the music every world starts with." : "This place's music is made by your browser, from its name."} Your own music is kept in this browser, for this site, and only you hear it.`
      });
      songs.forEach(
        (s, i) => controls2.add({
          id: listed[i],
          section: "sound",
          icon: "note",
          on: () => sounds2.jukebox.playing && sounds2.jukebox.current?.id === s.id,
          label: () => sounds2.jukebox.playing && sounds2.jukebox.current?.id === s.id ? `Playing: ${s.title}` : s.title,
          act: async () => {
            if (sounds2.jukebox.playing && sounds2.jukebox.current?.id === s.id) sounds2.jukebox.pause();
            else if (!await sounds2.jukebox.play(s.id)) controls2.say(`${s.title} couldn't be played.`);
          }
        })
      );
    };
    const level2 = (id, name, key) => ({
      id,
      section: "sound",
      label: () => `${name}: ${word(sounds2.levels[key])}`,
      on: () => sounds2.levels[key] > 0,
      act: () => sounds2.setLevels({ [key]: nextLevel(sounds2.levels[key]) })
    });
    controls2.addSection({ id: "sound", label: "Sound", icon: "sound" });
    controls2.add(
      {
        id: "sound-all",
        section: "sound",
        icon: () => sounds2.levels.off ? "soundOff" : "sound",
        on: () => !sounds2.levels.off,
        label: () => sounds2.levels.off ? "All sound: off" : "All sound: on",
        act: () => sounds2.setLevels({ off: !sounds2.levels.off })
      },
      level2("sound-effects", "Effects", "effects"),
      level2("sound-music", "Music", "music"),
      {
        // What the place is playing, by name, so a visitor can say which piece they mean. Pressing goes on to the next.
        id: "sound-piece",
        section: "sound",
        icon: "note",
        hidden: () => sounds2.music === "none" || sounds2.music === "made" || !sounds2.piece,
        label: () => {
          const p = sounds2.piece;
          if (!p) return "This place's music";
          return `Playing here: ${p.name}${p.of > 1 ? `. Next of ${p.of}` : ""}`;
        },
        act: () => {
          const p = sounds2.piece;
          if (!p) return;
          if (sounds2.nextPiece()) controls2.say(`Going on from ${p.name} to this place's next piece.`);
          else controls2.say(`${p.name} is the only piece this place has. Music: off, above, silences it.`);
        }
      },
      level2("sound-voices", "Voices", "voices"),
      {
        id: "sound-hum",
        section: "sound",
        icon: "sound",
        on: () => sounds2.levels.hum,
        hidden: () => !sounds2.hasHum,
        label: () => sounds2.levels.hum ? "The room's hum: on" : "The room's hum: off",
        act: () => sounds2.setLevels({ hum: !sounds2.levels.hum })
      },
      {
        id: "juke-add",
        section: "sound",
        icon: "save",
        label: "Add music from this device",
        act: () => picker.click()
      },
      {
        id: "juke-play",
        section: "sound",
        icon: "note",
        on: () => sounds2.jukebox.playing,
        hidden: () => sounds2.jukebox.list().length === 0,
        label: () => sounds2.jukebox.playing ? "Pause your music" : "Play your music",
        act: async () => {
          if (sounds2.jukebox.playing) return sounds2.jukebox.pause();
          if (!await sounds2.jukebox.play()) controls2.say("Your music couldn't be played.");
        }
      },
      {
        id: "juke-next",
        section: "sound",
        icon: "turn",
        hidden: () => sounds2.jukebox.list().length < 2,
        label: "Next song",
        act: () => void sounds2.jukebox.next()
      },
      {
        id: "juke-remove",
        section: "sound",
        icon: "exit",
        hidden: () => !sounds2.jukebox.current,
        label: () => `Take out ${sounds2.jukebox.current?.title ?? "this song"}`,
        act: async () => {
          const song = sounds2.jukebox.current;
          if (!song) return;
          await sounds2.jukebox.remove(song.id);
          controls2.say(`${song.title} was taken out of this browser.`);
          refresh();
        }
      }
    );
    refresh();
    controls2.onSignal((name) => {
      if (CUES.includes(name)) sounds2.play(name);
    });
    controls2.onSay(() => sounds2.play("notice"));
    sounds2.onChange(() => refresh());
    return { refresh };
  }

  // packages/sdk/src/jump.ts
  var JUMP_HEIGHT = 0.45;
  var JUMP_GRAVITY = 9.8;
  var JUMP_SPEED = Math.sqrt(2 * JUMP_GRAVITY * JUMP_HEIGHT);

  // packages/sdk/src/signer.ts
  var NONE2 = {
    state: "none",
    pubkey: null,
    name: null,
    picture: null,
    about: null,
    remembered: null,
    host: null,
    unanswered: false,
    copy: null,
    unlock: () => false,
    lock() {
    },
    sign: async () => null,
    pass: async () => null,
    onChange: () => () => {
    },
    whenAnswered: async () => {
    },
    dispose() {
    }
  };
  function namedAddresses(at) {
    try {
      const signer = new URL(at.signer);
      const win = new URL(at.window);
      if (signer.protocol !== "https:" || win.origin !== signer.origin) return null;
      return { origin: signer.origin, signer: signer.href, window: win.href };
    } catch {
      return null;
    }
  }
  function createWorldSigner(opts) {
    const real = opts.at ? namedAddresses(opts.at) : signerAt(opts.under) ?? signerAddresses(opts.airlock);
    if (!real || typeof document === "undefined") return NONE2;
    const test = new URLSearchParams(opts.search ?? location.search).get("signer") === "test";
    const watchers3 = /* @__PURE__ */ new Set();
    const pending = /* @__PURE__ */ new Map();
    let state = "none";
    let pubkey = null;
    let name = null;
    let picture = null;
    let about = null;
    let remembered = null;
    let origin = "";
    let windowAt = "";
    let frame = null;
    let disposed = false;
    const named = !!opts.at || !!signerAt(opts.under);
    let waited = false;
    setTimeout(() => {
      waited = true;
      if (state === "none") changed();
    }, 1e4);
    let answered = false;
    const firstAnswer = /* @__PURE__ */ new Set();
    let n = 0;
    const changed = () => {
      for (const fn of watchers3) fn();
    };
    const tell2 = (message) => frame?.contentWindow?.postMessage(signerMessage(message), origin);
    const onMessage = (e) => {
      if (!frame || e.source !== frame.contentWindow || e.origin !== origin) return;
      const reply = readSignerReply(e.data);
      if (!reply) return;
      if (reply.t === "ready") {
        if (state === "none") state = "locked";
        tell2({ t: "state", id: `s${++n}` });
        return changed();
      }
      if (reply.t === "state") {
        answered = true;
        state = reply.unlocked ? "unlocked" : "locked";
        pubkey = reply.unlocked ? reply.pubkey ?? null : null;
        name = reply.unlocked ? reply.name ?? null : null;
        picture = reply.unlocked ? reply.picture ?? null : null;
        about = reply.unlocked ? reply.about ?? null : null;
        remembered = reply.unlocked ? reply.remembered ?? null : null;
        for (const go2 of [...firstAnswer]) go2();
        return changed();
      }
      const waiting2 = pending.get(reply.id);
      if (!waiting2) return;
      pending.delete(reply.id);
      clearTimeout(waiting2.timer);
      if (reply.t === "refused") return waiting2.done(null);
      const signed = reply.event;
      if (waiting2.session) {
        const checked = verifyRoomPass(signed, { origin: location.origin, session: waiting2.session });
        return waiting2.done(checked.ok && checked.value.pubkey === pubkey ? signed : null);
      }
      if (!waiting2.asked) return waiting2.done(null);
      const marked = Array.isArray(signed?.tags) && signed.tags.some((t) => t[0] === WORLD_TAG && t[1] === cleanOrigin(location.origin));
      waiting2.done(verifyEvent(signed) && signed.pubkey === pubkey && marked && isWhatWasAsked(waiting2.asked, signed) ? signed : null);
    };
    void (async () => {
      try {
        const there = opts.at ? async (address) => address : toLocal;
        const signerUrl = await there(real.signer);
        windowAt = await there(real.window);
        origin = new URL(signerUrl).origin;
        if (disposed) return;
        frame = document.createElement("iframe");
        frame.title = "Signer";
        frame.setAttribute("aria-hidden", "true");
        frame.tabIndex = -1;
        frame.setAttribute("allow", "");
        frame.referrerPolicy = "no-referrer";
        frame.style.cssText = "position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;visibility:hidden;pointer-events:none";
        addEventListener("message", onMessage);
        frame.addEventListener("load", () => {
          for (const after2 of [0, 400, 1200, 3e3]) {
            setTimeout(() => {
              if (!answered && !disposed) tell2({ t: "state", id: `s${++n}` });
            }, after2);
          }
        });
        frame.src = signerUrl;
        document.body.append(frame);
      } catch {
      }
    })();
    return {
      get state() {
        return state;
      },
      get pubkey() {
        return pubkey;
      },
      get name() {
        return name;
      },
      get picture() {
        return picture;
      },
      get about() {
        return about;
      },
      get remembered() {
        return remembered;
      },
      get unanswered() {
        return named && waited && state === "none" && !disposed;
      },
      get copy() {
        return origin && origin !== real.origin ? origin : null;
      },
      // The signer's real address, never a development server's copy of it: it is what the visitor should recognise.
      get host() {
        try {
          return new URL(real.origin).host;
        } catch {
          return null;
        }
      },
      unlock() {
        if (state === "none" || !windowAt) return false;
        try {
          const opened = window.open(`${windowAt}${test ? "?signer=test" : ""}`, "nswp-connect", "popup,width=460,height=660");
          return !!opened;
        } catch {
          return false;
        }
      },
      lock() {
        if (state === "unlocked") tell2({ t: "lock", id: `l${++n}` });
      },
      sign(note) {
        if (state !== "unlocked" || !frame) return Promise.resolve(null);
        const asked = { kind: note.kind, content: note.content, tags: note.tags ?? [] };
        const id = `q${++n}`;
        return new Promise((done) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            done(null);
          }, 8e3);
          pending.set(id, { asked, done, timer });
          tell2({ t: "sign", id, event: asked });
        });
      },
      pass(session2) {
        if (state !== "unlocked" || !frame) return Promise.resolve(null);
        const id = `p${++n}`;
        return new Promise((done) => {
          const timer = setTimeout(() => {
            pending.delete(id);
            done(null);
          }, 8e3);
          pending.set(id, { session: session2, done, timer });
          tell2({ t: "pass", id, session: session2 });
        });
      },
      onChange(fn) {
        watchers3.add(fn);
        return () => void watchers3.delete(fn);
      },
      whenAnswered(ms) {
        if (answered || disposed) return Promise.resolve();
        return new Promise((done) => {
          const go2 = () => {
            clearTimeout(timer);
            firstAnswer.delete(go2);
            done();
          };
          const timer = setTimeout(go2, ms);
          firstAnswer.add(go2);
        });
      },
      dispose() {
        disposed = true;
        for (const go2 of [...firstAnswer]) go2();
        removeEventListener("message", onMessage);
        frame?.remove();
        frame = null;
        for (const w of pending.values()) {
          clearTimeout(w.timer);
          w.done(null);
        }
        pending.clear();
        state = "none";
      }
    };
  }

  // packages/sdk/src/ui/identity.ts
  function signerNamed() {
    if (!signerAt(arrival.signer())) return false;
    try {
      const airlock = portal.airlockFor();
      if (airlock && new URL(airlock).origin === location.origin) return false;
    } catch {
    }
    return true;
  }
  function hereAs() {
    const who = arrival.identity();
    if (!who || !signerNamed()) return who;
    const signer = worldSigner();
    return signer.state === "unlocked" && signer.pubkey === who.pubkey ? who : void 0;
  }
  var hereWatchers = /* @__PURE__ */ new Set();
  var seeking = null;
  var seekAfter = 0;
  function seekPass() {
    if (seeking) return seeking;
    if (!signerNamed()) return Promise.resolve();
    const signer = worldSigner();
    const key = signer.state === "unlocked" ? signer.pubkey : null;
    if (!key || arrival.identity()?.pubkey === key || Date.now() < seekAfter) return Promise.resolve();
    seekAfter = Date.now() + 6e4;
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const sessionKey = [...secret].map((b) => b.toString(16).padStart(2, "0")).join("");
    seeking = signer.pass(getPublicKey(secret)).then((pass) => {
      if (pass && signer.state === "unlocked" && signer.pubkey === key && arrival.keepIdentity(pass, sessionKey)) {
        for (const fn of [...hereWatchers]) fn();
      } else if (!pass) seekAfter = Infinity;
    }).catch(() => {
    }).finally(() => {
      seeking = null;
    });
    return seeking;
  }
  function identityWords() {
    const who = hereAs();
    const name = who ? who.name || shortNpub(who.pubkey) : "";
    return who ? { signedIn: true, name, label: `Here as ${name}. Switch profile, or go as a guest`, short: "You" } : { signedIn: false, name: "", label: "You are a guest here. Sign in", short: "Sign in" };
  }
  function youCard() {
    const who = hereAs();
    const signer = signerNamed() ? worldSigner() : null;
    if (who) {
      const npub = encodeNpub(who.pubkey);
      return { title: who.name || shortNpub(who.pubkey), tag: "Signed in", proven: true, sub: shortNpub(who.pubkey), copy: npub, text: who.about ?? "", picture: who.picture ?? "", color: "", now: [] };
    }
    if (signer?.state === "unlocked" && signer.pubkey) {
      return { title: signer.name ?? shortNpub(signer.pubkey), tag: "Signed in to post", proven: false, sub: shortNpub(signer.pubkey), copy: encodeNpub(signer.pubkey), text: signer.about ?? "", picture: signer.picture ?? "", color: "", now: [] };
    }
    return null;
  }
  function identityHost() {
    const airlock = portal.airlockFor();
    try {
      return airlock ? new URL(airlock).host : null;
    } catch {
      return null;
    }
  }
  var identitySection = () => ({
    id: "you",
    label: "You",
    icon: "you",
    card: youCard,
    note: () => {
      const host = identityHost();
      if (!host) return "";
      if (!signerNamed()) return `Who you are and how you look are kept by ${host}, the place you set out from, and are the same in every world. Changing either takes you there and brings you back here.`;
      const at = worldSigner().host ?? "your sign-in address";
      const look = `How you look is kept by ${host}, the place you set out from: changing it takes you there and brings you back.`;
      const visit = worldSigner().remembered === false ? ` It lasts for this visit: next time, ${at} asks again. Whether it remembers this world is yours to choose in its window.` : "";
      if (worldSigner().state === "unlocked") return `You are signed in here by ${at}.${visit} Signing out here makes you a guest in this world, and nowhere else. ${look}`;
      return `Signing in is done at ${at}, in a window of its own: nothing is typed in this world. Until you sign in here, everyone sees a guest. ${look}`;
    }
  });
  var shared = null;
  function worldSigner() {
    if (shared) return shared;
    const signer = shared = createWorldSigner({ under: arrival.signer(), airlock: portal.airlockFor() });
    signer.onChange(() => {
      if (signer.state !== "unlocked") seekAfter = 0;
      void seekPass();
    });
    if (typeof document !== "undefined" && signerNamed()) setInterval(() => void seekPass(), 6e4);
    return signer;
  }

  // packages/sdk/src/ui/icons.ts
  var ICONS = {
    home: "M4 11.5 12 4l8 7.5M6 10v10h12V10M10 20v-5h4v5",
    turn: "M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5",
    room: "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20a6 6 0 0 1 12 0M16.5 11.5a2.5 2.5 0 1 0 0-5M17.5 14.6A5 5 0 0 1 21.5 20",
    leave: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
    mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
    micOff: "M9 9v2a3 3 0 0 0 4.6 2.5M15 10.5V6a3 3 0 0 0-5.7-1.3M6 11a6 6 0 0 0 9.6 4.8M18 11a6 6 0 0 1-.4 2.2M12 17v4M9 21h6M4 4l16 16",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    vr: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3.5l-2-2.5h-3L8.5 17H5a2 2 0 0 1-2-2V9ZM8 12h.01M16 12h.01",
    exit: "M18 6 6 18M6 6l12 12",
    look: "M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11ZM9 14a3 3 0 0 0 3 3",
    help: "M9.2 9a3 3 0 1 1 4.6 2.5c-1 .7-1.8 1.4-1.8 2.7M12 18h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
    menu: "M4 7h16M4 12h16M4 17h10",
    /** An arched doorway: this project's mark for a way through. */
    door: "M7 21V10a5 5 0 0 1 10 0v11M5 21h14M14.5 14h.01",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.700l1-1",
    save: "M7 4h10v17l-5-3.5L7 21V4Z",
    step: "M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.800-6 10-6 10ZM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
    size: "M4 18 9 6l5 12M5.700 14h6.600M15 18l3.500-8 3.500 8M16 15.700h5",
    motion: "M3 12h4l3-7 4 14 3-7h4",
    check: "M5 12.500 10 17.500 19 7",
    camera: "M4 8h3l1.5-2h7L17 8h3v11H4ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
    selfie: "M4 5h16v14H4ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM7.5 19a4.5 4.5 0 0 1 9 0",
    record: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    /** A panel: a frame with a bar along its top. */
    panel: "M4 5h16v14H4ZM4 9h16M15 7h.01M17.5 7h.01",
    note: "M6 3h9l4 4v14H6ZM14 3v5h5M9 13h7M9 17h5",
    /** A loudspeaker, sounding and crossed out. */
    sound: "M4 9.500v5h3.500L13 19V5L7.500 9.500ZM16.500 9a4.500 4.500 0 0 1 0 6M19 6.500a8 8 0 0 1 0 11",
    soundOff: "M4 9.500v5h3.500L13 19V5L7.500 9.500ZM16.500 9.500l4.500 5M21 9.500l-4.500 5",
    you: "M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5ZM5 20.5a7 7 0 0 1 14 0",
    close: "M6 6l12 12M18 6 6 18",
    key: "M14.5 9.5a3.5 3.5 0 1 0-3.4 3.5L4 20v-3h3v-3h3l1.6-1.6M16 8h.01",
    chat: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 10h8M8 13h5",
    people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a6 6 0 0 1 12 0M16 11a2.5 2.5 0 1 0 0-5M21 20a5 5 0 0 0-4-4.9"
  };

  // packages/sdk/src/picture.ts
  var PICTURES_KEY = "nswp:pictures";
  var PICTURE_LIMITS = { bytes: 3e6, size: 128, waitMs: 9e3 };
  var shown = null;
  function showsPictures() {
    if (shown !== null) return shown;
    const came = arrivedSettings().pictures;
    let kept = null;
    try {
      kept = localStorage.getItem(PICTURES_KEY);
    } catch {
    }
    shown = came ?? kept !== "0";
    if (came !== void 0) keep2(shown);
    reportSettings("pictures", () => ({ pictures: showsPictures() }));
    return shown;
  }
  var keep2 = (on) => {
    try {
      if (on) localStorage.removeItem(PICTURES_KEY);
      else localStorage.setItem(PICTURES_KEY, "0");
    } catch {
    }
  };
  function badge(image, width, height) {
    const size = PICTURE_LIMITS.size;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const g = canvas.getContext("2d");
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    g.closePath();
    g.clip();
    const side = Math.min(width, height);
    g.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
    return canvas;
  }
  async function byFetch(url) {
    const res = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", redirect: "follow", signal: AbortSignal.timeout(PICTURE_LIMITS.waitMs) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpeg|webp|gif|avif)\b/i.test(type)) return null;
    if (Number(res.headers.get("content-length") ?? 0) > PICTURE_LIMITS.bytes) return null;
    const blob = await res.blob();
    if (blob.size > PICTURE_LIMITS.bytes) return null;
    const bitmap = await createImageBitmap(blob);
    try {
      return badge(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }
  function byImage(url) {
    return new Promise((done) => {
      const img = new Image();
      const timer = setTimeout(() => done(null), PICTURE_LIMITS.waitMs);
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      img.decoding = "async";
      img.onload = () => {
        clearTimeout(timer);
        try {
          done(img.naturalWidth > 0 && img.naturalWidth <= 8192 && img.naturalHeight <= 8192 ? badge(img, img.naturalWidth, img.naturalHeight) : null);
        } catch {
          done(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        done(null);
      };
      img.src = url;
    });
  }
  var loaded = /* @__PURE__ */ new Map();
  function loadPicture(address) {
    const url = cleanPicture(address);
    if (!url || !showsPictures() || typeof document === "undefined") return Promise.resolve(null);
    let asked = loaded.get(url);
    if (!asked) {
      asked = byFetch(url).catch(() => null).then((got) => got ?? byImage(url)).catch(() => null);
      loaded.set(url, asked);
    }
    return asked;
  }

  // packages/sdk/src/ui/feed.ts
  var FEED_LIMITS = { shown: 420, kept: 30 };
  function createUiFeed(changed, now = () => Date.now()) {
    let opts = null;
    let posts = [];
    let loading2 = false;
    let said = "";
    let version = 0;
    let count = 0;
    let asked = 0;
    const bump2 = () => {
      version++;
      changed();
    };
    const sort = () => {
      posts.sort((a, b) => b.at - a.at);
      const kept = posts.filter((p, i) => p.state !== "out" || i < FEED_LIMITS.kept);
      posts = kept;
    };
    return {
      attach(next) {
        opts = next;
        posts = [];
        loading2 = false;
        said = "";
        asked = 0;
        bump2();
      },
      detach() {
        if (!opts) return;
        opts = null;
        posts = [];
        loading2 = false;
        said = "";
        bump2();
      },
      opened() {
        const mine = opts;
        if (!mine?.load || loading2 || asked && now() - asked < 6e4) return;
        asked = now();
        loading2 = true;
        bump2();
        void mine.load().catch(() => null).then((got) => {
          if (opts !== mine) return;
          loading2 = false;
          if (!got) said = "Your earlier posts couldn't be fetched just now.";
          else {
            const seen = new Set(posts.map((p) => p.key));
            for (const p of got) {
              const text = cleanLine(p.text, FEED_LIMITS.shown);
              if (!text || seen.has(p.id) || !Number.isFinite(p.at)) continue;
              seen.add(p.id);
              posts.push({ key: p.id, text, at: p.at, state: "out" });
            }
            sort();
          }
          bump2();
        });
      },
      send(text) {
        const mine = opts;
        if (!mine) return "There is nothing to post with: sign in first.";
        const words2 = cleanChat(text);
        if (!words2) return null;
        const post = { key: `new-${++count}`, text: words2, at: Math.floor(now() / 1e3), state: "sending" };
        posts.unshift(post);
        said = "";
        bump2();
        void mine.send(words2).catch(() => ({ ok: false, said: "That wasn't sent." })).then((how) => {
          if (opts !== mine) return;
          post.state = how.ok ? "out" : "failed";
          said = how.said;
          bump2();
        });
        return null;
      },
      view() {
        const who = typeof opts?.who === "function" ? opts.who() : opts?.who ?? "";
        const lead = `Public, like a tweet: anyone can read what you send out here, as ${who}, and it can't be taken back.${opts?.marked ? ` Each post is marked as sent from ${opts.marked}.` : ""}`;
        return { ready: !!opts, title: "My public feed", who, posts, loading: loading2, said, lead, limit: CHAT_LIMITS.chars, version };
      }
    };
  }
  function ago(at, nowSec) {
    const s = Math.max(0, nowSec - at);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    const days = Math.floor(s / 86400);
    if (days < 30) return days === 1 ? "1 day ago" : `${days} days ago`;
    return new Date(at * 1e3).toISOString().slice(0, 10);
  }

  // packages/sdk/src/ui/summon.ts
  var SUMMON_KEY = "Backquote";
  var SUMMON_HOLD = 600;
  var SUMMON_SLOP = 18;
  function createHoldWatch(o) {
    const hold = o.hold ?? SUMMON_HOLD;
    const slop = o.slop ?? SUMMON_SLOP;
    let from = null;
    let timer = null;
    const cancel = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      from = null;
    };
    return {
      touches(points) {
        if (points.length !== 2) return cancel();
        if (!from) {
          from = points.map((p) => ({ x: p.x, y: p.y }));
          timer = setTimeout(() => {
            cancel();
            o.onHeld();
          }, hold);
          return;
        }
        if (points.some((p, i) => Math.hypot(p.x - from[i].x, p.y - from[i].y) > slop)) cancel();
      },
      cancel
    };
  }

  // packages/sdk/src/ui/theme.ts
  var DEFAULT_THEME = { accent: "#ffb65c", ink: "#eef5fb", glass: "#0a1018", warn: "#ff7566", motion: true, scale: 1, wrist: "left" };
  var UI_PRESETS = [
    { id: "lantern", label: "Lantern", accent: "#ffb65c" },
    { id: "ion", label: "Ion", accent: "#62d9ff" },
    { id: "verdant", label: "Verdant", accent: "#4fd08b" },
    { id: "rose", label: "Rose", accent: "#ff8fb1" },
    { id: "paper", label: "Paper", accent: "#f2f3f6" }
  ];
  var KEY = "nswp:ui";
  var HEX = /^#[0-9a-f]{6}$/i;
  function cleanTheme2(input) {
    const out = {};
    if (!input || typeof input !== "object") return out;
    const t = input;
    for (const k of ["accent", "ink", "glass", "warn"]) if (typeof t[k] === "string" && HEX.test(t[k])) out[k] = t[k].toLowerCase();
    if (typeof t.motion === "boolean") out.motion = t.motion;
    if (typeof t.scale === "number" && Number.isFinite(t.scale)) out.scale = Math.min(1.5, Math.max(0.85, t.scale));
    if (t.wrist === "left" || t.wrist === "right" || t.wrist === "off") out.wrist = t.wrist;
    return out;
  }
  function loadVisitorTheme() {
    try {
      return cleanTheme2(JSON.parse(globalThis.localStorage?.getItem(KEY) ?? "{}"));
    } catch {
      return {};
    }
  }
  function saveVisitorTheme(theme) {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(cleanTheme2(theme)));
    } catch {
    }
  }
  function prefersStill() {
    try {
      return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
      return false;
    }
  }
  function resolveTheme(world = {}, visitor = loadVisitorTheme()) {
    return { ...DEFAULT_THEME, ...prefersStill() ? { motion: false } : {}, ...cleanTheme2(world), ...cleanTheme2(visitor) };
  }
  function rgb(hex) {
    const n = Number.parseInt(hex.slice(1), 16);
    return `${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}`;
  }

  // packages/sdk/src/ui/hud.ts
  var CSS = `
:host { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; display: block;
  --s: 1; --accent: 255, 182, 92; --ink: 238, 245, 251; --glass: 10, 16, 24; --warn: 255, 117, 102;
  font: 500 calc(13px * var(--s)) / 1.35 ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  color: rgb(var(--ink)); -webkit-font-smoothing: antialiased; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:focus-visible { outline: 2px solid rgb(var(--ink)); outline-offset: 3px; }
svg { width: 1.55em; height: 1.55em; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.glass { background: rgba(var(--glass), .7); border: 1px solid rgba(var(--accent), .34);
  -webkit-backdrop-filter: blur(12px) saturate(1.25); backdrop-filter: blur(12px) saturate(1.25); }
.mono { font-family: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace; font-weight: 400; }

/* ---- the corners of the view, marked lightly: this is a HUD, laid over a place */
.corner { position: absolute; width: 22px; height: 22px; border: 0 solid rgba(var(--accent), .5); }
.corner.a { left: 6px; bottom: 6px; border-left-width: 1px; border-bottom-width: 1px; border-bottom-left-radius: 6px; }
.corner.b { right: 6px; bottom: 6px; border-right-width: 1px; border-bottom-width: 1px; border-bottom-right-radius: 6px; }
@media (max-width: 640px) { .corner { display: none; } }

/* ---- who and where: top left */
.id { position: absolute; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left));
  display: flex; align-items: center; gap: 10px; max-width: min(60vw, 420px); padding: 8px 14px 8px 10px; border-radius: 6px 14px 14px 6px;
  border-left: 2px solid rgb(var(--accent)); }
/* The mark: a lit doorway. The arch is this kit's one shape, borrowed from the doors it leads to. */
.mark { width: 18px; height: 24px; border-radius: 9px 9px 2px 2px; flex: none; position: relative;
  background: linear-gradient(rgba(var(--accent), .95), rgba(var(--accent), .25)); box-shadow: 0 0 14px rgba(var(--accent), .55); }
.mark::after { content: ""; position: absolute; left: -3px; right: -3px; bottom: -3px; height: 2px; background: rgb(var(--ink)); border-radius: 1px; }
.id b { display: block; font-weight: 650; font-size: 1.12em; letter-spacing: .005em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.id .mono { display: block; font-size: .86em; color: rgba(var(--ink), .68); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---- the menu button: top right */
.menu { position: absolute; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
  pointer-events: auto; display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px 0 10px; border-radius: 12px; }
.menu:hover, .menu[aria-expanded="true"] { border-color: rgb(var(--accent)); color: rgb(var(--accent)); }
kbd { font: inherit; font-size: .82em; min-width: 1.6em; padding: 1px 5px; text-align: center; border-radius: 5px;
  border: 1px solid rgba(var(--ink), .3); color: rgba(var(--ink), .75); }

/* ---- the bottom: what you point at, then the hotbar */
.low { position: absolute; left: 0; right: 0; bottom: max(10px, env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 0 12px; }
.target { max-width: min(92vw, 640px); padding: 6px 14px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.target:empty { visibility: hidden; }
/* What is pointed at, with a few lines about it: a small card, always this size, never in the way of the thing itself. */
.target.card { max-width: min(92vw, 460px); padding: 10px 16px; border-radius: 14px; white-space: normal; text-align: left; display: grid; gap: 3px; }
.target.card b { font-weight: 650; }
.target.card span { opacity: 0.86; font-size: 0.93em; line-height: 1.35; }
.target.card span:last-child { opacity: 1; color: rgb(var(--accent)); }
.hotbar { pointer-events: auto; display: flex; align-items: flex-start; justify-content: center; gap: 10px; padding: 12px 14px 8px; border-radius: 20px 20px 10px 10px; }
.key { position: relative; width: 62px; display: grid; justify-items: center; gap: 7px; text-align: center; }
/* A key is a small doorway: an arch, standing on a sill that lights when it is on. */
.key .arch { width: 52px; height: 54px; display: grid; place-items: center; border-radius: 26px 26px 7px 7px;
  background: rgba(var(--accent), .08); border: 1px solid rgba(var(--accent), .42); transition: background .15s, border-color .15s, transform .15s; }
.key .sill { width: 60px; height: 2px; margin-top: -4px; border-radius: 1px; background: rgba(var(--ink), .28); transition: background .2s, box-shadow .2s; }
.key .name { font-size: .84em; line-height: 1.2; color: rgba(var(--ink), .82); max-width: 100%; overflow-wrap: anywhere; }
.key .num { position: absolute; top: -6px; right: -2px; }
.key:hover .arch, .key:focus-visible .arch { background: rgba(var(--accent), .2); border-color: rgb(var(--accent)); transform: translateY(-2px); }
.key:hover .sill, .key[aria-pressed="true"] .sill { background: rgb(var(--accent)); box-shadow: 0 0 12px rgba(var(--accent), .8); }
.key[aria-pressed="true"] .arch { background: rgba(var(--accent), .26); color: rgb(var(--accent)); border-color: rgb(var(--accent)); }
.key.primary .arch { background: rgb(var(--accent)); color: rgb(var(--glass)); border-color: rgb(var(--accent)); box-shadow: 0 0 18px rgba(var(--accent), .45); }
.key.warn .arch { border-color: rgba(var(--warn), .7); color: rgb(var(--warn)); background: rgba(var(--warn), .08); }
.key:disabled { opacity: .5; cursor: default; }

/* ---- a few words for a moment: bottom left */
.says { position: absolute; left: max(12px, env(safe-area-inset-left)); bottom: calc(max(10px, env(safe-area-inset-bottom)) + 128px * var(--s)); display: grid; gap: 6px; max-width: min(80vw, 360px); }
.say { padding: 8px 12px; border-radius: 4px 12px 12px 4px; border-left: 2px solid rgb(var(--accent)); animation: say-in .22s ease-out both; }
.say.going { opacity: 0; transition: opacity .5s; }

/* ---- what the room writes: at the right-hand side. Put away, the newest lines pass by; open, a list and a place to write. */
.chat { position: absolute; right: max(12px, env(safe-area-inset-right)); top: calc(max(12px, env(safe-area-inset-top)) + 54px);
  bottom: calc(max(10px, env(safe-area-inset-bottom)) + 128px * var(--s)); width: min(340px, calc(100vw - 24px));
  display: flex; flex-direction: column; justify-content: flex-end; pointer-events: none; }
.chat[data-state="closed"] { display: none; }
.chat [hidden] { display: none !important; }
.chat .frame { display: flex; flex-direction: column; min-height: 0; max-height: 100%; }
.chat[data-state="open"] .frame { pointer-events: auto; border-radius: 14px 6px 6px 14px; border-right: 2px solid rgb(var(--accent)); overflow: hidden; }
.chat[data-state="peek"] .frame { background: none; border: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
.chat header { display: flex; align-items: center; gap: 8px; padding: 9px 8px 8px 14px; border-bottom: 1px solid rgba(var(--accent), .22); }
.chat header b { flex: 1; font-weight: 650; }
.chat header button { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: rgba(var(--ink), .7); }
.chat header button:hover { color: rgb(var(--ink)); background: rgba(var(--ink), .1); }
.chat header svg { width: 1.2em; height: 1.2em; }
.chat ol { list-style: none; margin: 0; padding: 10px 14px; display: grid; gap: 7px; align-content: end; overflow-y: auto; min-height: 0;
  scrollbar-width: thin; scrollbar-color: rgba(var(--accent), .5) transparent; overflow-wrap: anywhere; }
.chat li b { font-weight: 650; margin-right: .45em; color: var(--who, rgb(var(--accent))); }
.chat li.mine b { color: rgba(var(--ink), .62); }
.chat li.aside { color: rgba(var(--ink), .6); font-size: .93em; }
.chat .empty { margin: 0; padding: 14px; color: rgba(var(--ink), .7); }
.chat form { display: flex; gap: 6px; padding: 8px; border-top: 1px solid rgba(var(--accent), .22); }
.chat input { flex: 1; min-width: 0; font: inherit; font-size: max(16px, 1em); color: rgb(var(--ink)); background: rgba(var(--ink), .07);
  border: 1px solid rgba(var(--ink), .22); border-radius: 9px; padding: 8px 10px; outline: none; }
.chat input::placeholder { color: rgba(var(--ink), .5); }
.chat input:focus { border-color: rgb(var(--accent)); }
.chat form button { padding: 0 13px; border-radius: 9px; background: rgba(var(--accent), .18); border: 1px solid rgba(var(--accent), .7); }
.chat form button:hover { background: rgb(var(--accent)); color: rgb(var(--glass)); }
.chat .hint { margin: 0; padding: 0 12px 8px; font-size: .9em; color: rgb(var(--warn)); }
.chat .hint:empty { display: none; }
.chat header .tabs2 { flex: 1; display: flex; gap: 4px; min-width: 0; }
.chat header .tab { width: auto; height: 30px; padding: 0 10px; font-weight: 650; white-space: nowrap; border-bottom: 2px solid transparent; border-radius: 8px 8px 0 0; }
.chat header .tab[aria-selected="true"] { color: rgb(var(--ink)); border-bottom-color: rgb(var(--accent)); }
.chat .lead, .chat .said { margin: 0; padding: 8px 14px 0; font-size: .9em; color: rgba(var(--ink), .7); }
.chat .said { padding: 0 12px 8px; }
.chat .said:empty { display: none; }
/* The feed reads the other way up from the chat: where to write is at the top, and the newest post under it. */
.chat[data-tab="feed"] form { order: 1; border-top: 0; flex-wrap: wrap; }
.chat[data-tab="feed"] form input { flex: 1 1 100%; min-height: 38px; }
.chat[data-tab="feed"] form button { margin-left: auto; min-height: 34px; font-weight: 650; }
.chat[data-tab="feed"] :is(.hint, .said) { order: 2; }
.chat[data-tab="feed"] :is(ol, .empty) { order: 3; border-top: 1px solid rgba(var(--accent), .22); }
.chat[data-tab="feed"] ol { align-content: start; gap: 0; padding: 0 14px; }
.chat li.post { padding: 10px 0; border-bottom: 1px solid rgba(var(--ink), .12); overflow-wrap: anywhere; }
.chat li.post:last-child { border-bottom: 0; }
.chat li.post small { display: block; margin-top: 3px; font-size: .86em; color: rgba(var(--ink), .55); }
.chat li.post.failed small { color: rgb(var(--warn)); }
.chat li.post.sending { opacity: .7; }
.chat[data-state="peek"] :is(header, form, .hint, .empty, .lead, .said) { display: none; }
.chat[data-state="peek"] ol { padding: 0; overflow: hidden; justify-items: end; }
.chat[data-state="peek"] li { padding: 7px 12px; border-radius: 12px 4px 4px 12px; border-right: 2px solid rgb(var(--accent)); max-width: 100%;
  background: rgba(var(--glass), .7); -webkit-backdrop-filter: blur(12px) saturate(1.25); backdrop-filter: blur(12px) saturate(1.25); animation: chat-in .22s ease-out both; }
.chat[data-state="peek"].going { opacity: 0; transition: opacity .6s; }
:host([data-presence="hidden"]) .chat { display: none; }
:host(:not([data-presence="full"])) .chat { bottom: max(72px, env(safe-area-inset-bottom)); }

/* ---- the sheet: everything else, by section */
.sheet { position: absolute; left: 50%; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 122px * var(--s)); transform: translateX(-50%);
  width: min(480px, calc(100vw - 20px)); max-height: min(62vh, 560px); display: flex; flex-direction: column; pointer-events: auto;
  border-radius: 22px 22px 12px 12px; overflow: hidden; }
.sheet[hidden] { display: none; }
.sheet::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgb(var(--accent)), transparent); box-shadow: 0 0 16px rgb(var(--accent)); }
.tabs { position: relative; display: flex; gap: 4px; padding: 12px 12px 0; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
/* There are more sections than fit: an arrow at the side they are on, over a fade, and it takes them there. */
.tabbar { position: relative; }
.tabbar .more { position: absolute; top: 2px; bottom: 0; width: 40px; display: grid; align-items: center; z-index: 1; font-size: 1.55em; line-height: 1;
  color: rgb(var(--accent)); text-shadow: 0 0 10px rgb(var(--accent)); }
.tabbar .more.left { left: 0; justify-items: start; padding-left: 9px; border-radius: 22px 0 0 0; background: linear-gradient(90deg, rgb(var(--glass)) 45%, rgba(var(--glass), 0)); }
.tabbar .more.right { right: 0; justify-items: end; padding-right: 9px; border-radius: 0 22px 0 0; background: linear-gradient(270deg, rgb(var(--glass)) 45%, rgba(var(--glass), 0)); }
.tabbar .more[hidden] { display: none; }
.tabbar .more:hover { color: rgb(var(--ink)); }
.tab { display: flex; align-items: center; gap: 7px; padding: 9px 13px 8px; border-radius: 14px 14px 0 0; color: rgba(var(--ink), .72); border-bottom: 2px solid transparent; white-space: nowrap; }
.tab:hover { color: rgb(var(--ink)); }
.tab[aria-selected="true"] { color: rgb(var(--accent)); background: rgba(var(--accent), .1); border-bottom-color: rgb(var(--accent)); }
.rows { display: grid; gap: 6px; padding: 12px; overflow-y: auto; border-top: 1px solid rgba(var(--accent), .22);
  scrollbar-width: thin; scrollbar-color: rgba(var(--accent), .5) transparent; }
/* A choice of colour is a row of small doorways, each lit in its own. */
.swatches { display: flex; flex-wrap: wrap; gap: 6px 4px; padding: 4px 2px 8px; }
.swatch { width: 66px; display: grid; justify-items: center; gap: 6px; font-size: .86em; color: rgba(var(--ink), .8); }
.swatch i { width: 38px; height: 44px; border-radius: 19px 19px 5px 5px; background: linear-gradient(var(--c), color-mix(in srgb, var(--c) 30%, transparent)); border: 1px solid var(--c); transition: transform .15s, box-shadow .15s; }
.swatch u { width: 46px; height: 2px; margin-top: -3px; border-radius: 1px; background: rgba(var(--ink), .25); }
.swatch:hover i { transform: translateY(-2px); }
.swatch[aria-pressed="true"] i { box-shadow: 0 0 16px var(--c); }
.swatch[aria-pressed="true"] u { background: var(--c); box-shadow: 0 0 10px var(--c); }
.swatch[aria-pressed="true"] { color: rgb(var(--ink)); }
.row { display: flex; align-items: center; gap: 12px; min-height: 46px; padding: 8px 12px; border-radius: 10px; text-align: left;
  border: 1px solid rgba(var(--ink), .12); background: rgba(var(--ink), .03); transition: background .12s, border-color .12s; }
.row:hover { background: rgba(var(--accent), .13); border-color: rgba(var(--accent), .7); }
.row .grow { flex: 1; min-width: 0; }
.row .state { font-size: .86em; color: rgba(var(--ink), .6); }
.row[aria-pressed="true"] { border-color: rgba(var(--accent), .8); }
.row[aria-pressed="true"] .state { color: rgb(var(--accent)); }
.row.warn { color: rgb(var(--warn)); }
.row.primary { background: rgba(var(--accent), .16); border-color: rgba(var(--accent), .75); }
/* Who a section is about: a face, a name, how they are known, and what they say of themselves, set apart as theirs. */
.card { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; align-items: center; padding: 12px; border-radius: 16px 16px 8px 8px;
  border: 1px solid rgba(var(--accent), .45); background: rgba(var(--accent), .07); }
.card .face { grid-row: span 2; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; overflow: hidden;
  background: var(--c, rgba(var(--ink), .2)); color: rgb(var(--glass)); font-weight: 700; font-size: 1.5em; }
.card .face canvas { width: 100%; height: 100%; display: block; }
.card h3 { margin: 0; font-size: 1.15em; font-weight: 650; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; overflow-wrap: anywhere; }
.card .tag { font-size: .76em; font-weight: 500; padding: 1px 8px; border-radius: 999px; border: 1px solid rgba(var(--ink), .3); color: rgba(var(--ink), .75); white-space: nowrap; }
.card .tag.proven { border-color: rgba(var(--accent), .8); color: rgb(var(--accent)); }
.card .keyline { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; color: rgba(var(--ink), .7); font-size: .9em; }
.card .keyline button { padding: 2px 10px; border-radius: 7px; border: 1px solid rgba(var(--ink), .25); color: rgb(var(--ink)); }
.card .keyline button:hover { border-color: rgb(var(--accent)); color: rgb(var(--accent)); }
.card blockquote { grid-column: 1 / -1; margin: 7px 0 0; padding: 1px 0 1px 10px; border-left: 2px solid rgba(var(--accent), .6); overflow-wrap: anywhere; }
.card .now { grid-column: 1 / -1; margin: 5px 0 0; font-size: .9em; color: rgb(var(--accent)); }

.note { margin: 0; padding: 4px 12px 0 12px; color: rgba(var(--ink), .78); border-left: 2px solid rgba(var(--accent), .6); margin-left: 12px; font-size: .95em; }
.note:empty { display: none; }
.foot { display: flex; justify-content: flex-end; padding: 0 12px 12px; }
.close { min-height: 38px; padding: 0 14px; border-radius: 10px; border: 1px solid rgba(var(--ink), .22); }
.close:hover { border-color: rgb(var(--ink)); }

/* ---- quiet: one mark in a corner, and everything else behind it */
.quiet { position: absolute; pointer-events: auto; display: none; width: 44px; height: 48px; place-items: center; border-radius: 22px 22px 8px 8px; }
.quiet .mark { margin-bottom: 2px; }
.quiet:hover, .quiet[aria-expanded="true"] { border-color: rgb(var(--accent)); }
:host([data-presence="quiet"]) .quiet { display: grid; }
:host([data-presence="quiet"]) :is(.id, .menu, .hotbar, .target, .corner),
:host([data-presence="hidden"]) :is(.id, .menu, .hotbar, .target, .corner, .says) { display: none; }
:host([data-corner="top-left"]) .quiet { top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); }
:host([data-corner="top-right"]) .quiet { top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); }
:host([data-corner="bottom-left"]) .quiet { bottom: max(12px, env(safe-area-inset-bottom)); left: max(12px, env(safe-area-inset-left)); }
:host([data-corner="bottom-right"]) .quiet { bottom: max(12px, env(safe-area-inset-bottom)); right: max(12px, env(safe-area-inset-right)); }
/* With no hotbar under it, the sheet opens in the middle of the bottom edge, clear of the corners. */
:host(:not([data-presence="full"])) .sheet { bottom: max(72px, env(safe-area-inset-bottom)); }
:host(:not([data-presence="full"])) .says { bottom: max(72px, env(safe-area-inset-bottom)); }
/* Keys the world has switched off aren't advertised. */
:host(.no-menu-key) .menu kbd, :host(.no-hotbar-keys) :is(.key .num, .row kbd) { display: none; }

/* ---- one moment of motion: things arrive. Nothing loops. */
@keyframes say-in { from { opacity: 0; transform: translateX(-8px); } }
@keyframes chat-in { from { opacity: 0; transform: translateX(8px); } }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes unfold { from { clip-path: inset(100% 0 0 0 round 22px); opacity: .4; } to { clip-path: inset(0 0 0 0 round 22px); opacity: 1; } }
:host(.moving.arriving) .key { animation: rise .32s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i) * 45ms + 120ms); }
:host(.moving.arriving) .id, :host(.moving.arriving) .menu { animation: rise .32s cubic-bezier(.2, .8, .2, 1) both; }
:host(.moving) .sheet:not([hidden]) { animation: unfold .24s cubic-bezier(.2, .8, .2, 1) both; }
:host(:not(.moving)) * { transition: none !important; animation: none !important; }

/* ---- a phone: the same things, closer together */
@media (max-width: 640px) {
  .id { max-width: calc(100vw - 86px); padding: 6px 10px 6px 8px; }
  .menu span, .menu kbd, .key .num { display: none; }
  .menu { padding: 0 10px; }
  .hotbar { gap: 4px; padding: 10px 8px 6px; }
  .key { width: 54px; }
  .key .arch { width: 46px; height: 46px; border-radius: 23px 23px 6px 6px; }
  .key .sill { width: 50px; }
  .key .name { font-size: .76em; }
  .sheet { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 108px * var(--s)); }
  .says { bottom: calc(max(10px, env(safe-area-inset-bottom)) + 116px * var(--s)); }
  /* The chat is across the bottom, over the hotbar's shoulder, and no taller than half the screen. */
  .chat { left: 8px; right: 8px; width: auto; top: auto; max-height: 46vh; bottom: calc(max(10px, env(safe-area-inset-bottom)) + 108px * var(--s)); }
  .chat[data-state="peek"] { max-height: 30vh; }
}
/* A keyboard on the glass covers the bottom of the page: the place to write stands on top of it. */
:host(.keys-up) .chat[data-state="open"] { top: auto; bottom: calc(var(--kb, 0px) + 8px); max-height: calc(100vh - var(--kb, 0px) - 24px); }
@media (hover: none) { kbd { display: none; } }
`;
  function icon(name) {
    if (!name) return null;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICONS[name]);
    svg.append(path);
    return svg;
  }
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const c of children) if (c) e.append(c);
    return e;
  }
  function mountHud(controls2, opts = {}) {
    const host = document.createElement("nswp-hud");
    const root = host.attachShadow({ mode: "open" });
    let style = "";
    try {
      const sheet2 = new CSSStyleSheet();
      sheet2.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet2];
    } catch {
      style = document.createElement("style");
      style.textContent = CSS;
    }
    const title = el("b");
    const address = el("span", { class: "mono" });
    const id = el("div", { class: "id glass" }, el("span", { class: "mark", "aria-hidden": "true" }), el("div", {}, title, address));
    const menu2 = el("button", { class: "menu glass", type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" }, icon("menu"), el("span", {}, "Menu"), el("kbd", {}, "M"));
    const quiet = el("button", { class: "quiet glass", type: "button", "aria-label": "Menu", "aria-haspopup": "dialog", "aria-expanded": "false" }, el("span", { class: "mark", "aria-hidden": "true" }));
    const target2 = el("div", { class: "target glass", "aria-live": "polite" });
    const hotbar = el("nav", { class: "hotbar glass", "aria-label": "Controls" });
    const says = el("div", { class: "says", role: "status" });
    const tabs = el("div", { class: "tabs", role: "tablist" });
    const tabsBack = el("button", { class: "more left", type: "button", "aria-label": "Earlier sections", hidden: "" }, "\u2039");
    const tabsOn = el("button", { class: "more right", type: "button", "aria-label": "More sections", hidden: "" }, "\u203A");
    const tabbar = el("div", { class: "tabbar" }, tabsBack, tabs, tabsOn);
    let tabsShowing = "";
    const tendTabs = () => {
      const most = tabs.scrollWidth - tabs.clientWidth;
      tabsBack.hidden = tabs.scrollLeft <= 6;
      tabsOn.hidden = most <= 6 || tabs.scrollLeft >= most - 6;
    };
    const slideTabs = (by) => tabs.scrollBy({ left: by * Math.max(120, tabs.clientWidth * 0.6), behavior: controls2.theme.motion ? "smooth" : "auto" });
    tabsBack.addEventListener("click", () => slideTabs(-1));
    tabsOn.addEventListener("click", () => slideTabs(1));
    tabs.addEventListener("scroll", tendTabs, { passive: true });
    const tabsWatch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => tendTabs());
    tabsWatch?.observe(tabs);
    tabs.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || tabs.scrollWidth <= tabs.clientWidth) return;
        e.preventDefault();
        tabs.scrollLeft += e.deltaY;
      },
      { passive: false }
    );
    const rows = el("div", { class: "rows" });
    const note = el("p", { class: "note" });
    const close = el("button", { class: "close", type: "button" }, "Close");
    const sheet = el("section", { class: "sheet glass", role: "dialog", "aria-label": "Menu", hidden: "" }, tabbar, rows, note, el("div", { class: "foot" }, close));
    const chatTitle = el("b");
    const tabRoom = el("button", { type: "button", class: "tab", role: "tab" }, "Room chat");
    const tabFeed = el("button", { type: "button", class: "tab", role: "tab" }, "My public feed");
    const chatTabs = el("div", { class: "tabs2", role: "tablist" }, tabRoom, tabFeed);
    const feedLead = el("p", { class: "lead" });
    const feedSaid = el("p", { class: "said", role: "status" });
    const chatClose = el("button", { type: "button", "aria-label": "Put this away" }, icon("close"));
    const chatLines = el("ol", { "aria-live": "polite" });
    const ROOM_EMPTY = "Nobody has written anything yet. What is written here goes to the people in this room, and is kept nowhere.";
    const chatEmpty = el("p", { class: "empty" }, ROOM_EMPTY);
    const chatField = el("input", { type: "text", autocomplete: "off", enterkeyhint: "send", "aria-label": "Write to the room", placeholder: "Write to the room" });
    const chatHint = el("p", { class: "hint", role: "status" });
    const chatSend = el("button", { type: "submit" }, "Send");
    const chatForm = el("form", {}, chatField, chatSend);
    const chat = el("section", { class: "chat", "aria-label": "Room chat", "data-state": "closed", "data-tab": "room" }, el("div", { class: "frame glass" }, el("header", {}, chatTitle, chatTabs, chatClose), feedLead, chatEmpty, chatLines, chatHint, feedSaid, chatForm));
    root.append(style, el("i", { class: "corner a", "aria-hidden": "true" }), el("i", { class: "corner b", "aria-hidden": "true" }), id, menu2, quiet, says, chat, sheet, el("div", { class: "low" }, target2, hotbar));
    (opts.parent ?? document.body).append(host);
    let open2 = false;
    let section = "";
    let chose = false;
    let drawn = "";
    const press = (item) => controls2.run(item.id);
    const drawCard = (card) => {
      const face = el("span", { class: "face", "aria-hidden": "true" }, [...card.title][0]?.toUpperCase() ?? "");
      if (card.color) face.style.setProperty("--c", card.color);
      if (card.picture) {
        void loadPicture(card.picture).then((drawn2) => {
          if (!drawn2 || !face.isConnected) return;
          const copy = document.createElement("canvas");
          copy.width = drawn2.width;
          copy.height = drawn2.height;
          copy.getContext("2d")?.drawImage(drawn2, 0, 0);
          face.replaceChildren(copy);
        });
      }
      const copyKey = card.copy ? el("button", { type: "button" }, "Copy key") : null;
      copyKey?.addEventListener("click", () => {
        void (navigator.clipboard?.writeText(card.copy) ?? Promise.reject(new Error("no clipboard"))).then(
          () => controls2.say("The key is copied, in full."),
          () => controls2.say(`The key: ${card.copy}`)
        );
      });
      return el(
        "div",
        { class: "card", role: "group", "aria-label": `About ${card.title}` },
        face,
        el("h3", {}, card.title, card.tag && el("span", { class: card.proven ? "tag proven" : "tag" }, card.tag)),
        el("div", { class: "keyline" }, el("span", { class: card.copy ? "mono" : "" }, card.sub), copyKey),
        card.text && el("blockquote", {}, card.text),
        card.now.length > 0 && el("p", { class: "now" }, card.now.join(", "))
      );
    };
    let chatState = "closed";
    let dockTab = "room";
    let chatDrawn = "";
    let chatNewest = "";
    let peekTimer;
    let goingTimer;
    const PEEK_LINES = 4;
    const PEEK_MS = 9e3;
    const setChatState = (next) => {
      clearTimeout(peekTimer);
      clearTimeout(goingTimer);
      chat.classList.remove("going");
      chatState = next;
      if (next === "peek") {
        goingTimer = setTimeout(() => chat.classList.add("going"), PEEK_MS - 700);
        peekTimer = setTimeout(() => {
          if (chatState === "peek") setChatState("closed");
          draw();
        }, PEEK_MS);
      }
    };
    const drawChat = (view2) => {
      const c = view2.chat;
      const f = view2.feed;
      if (chatState === "open" && !(dockTab === "feed" ? f.ready : c.ready)) {
        if (dockTab === "feed" ? c.ready : f.ready) dockTab = dockTab === "feed" ? "room" : "feed";
        else setChatState("closed");
      }
      if (chatState === "peek" && !c.ready) setChatState("closed");
      const newest = c.lines[c.lines.length - 1]?.key ?? "";
      if (c.ready && newest && newest !== chatNewest && chatState !== "open" && !c.lines[c.lines.length - 1].mine) setChatState("peek");
      chatNewest = newest;
      const showing = chatState === "open" ? dockTab : "room";
      const now = JSON.stringify([chatState, showing, c.version, c.ready, f.version, f.ready, showing === "feed" ? [Math.floor(Date.now() / 6e4), f.lead] : 0]);
      if (now === chatDrawn) return;
      chatDrawn = now;
      chat.dataset.state = chatState;
      chat.dataset.tab = showing;
      chat.setAttribute("aria-label", showing === "feed" ? f.title : "Room chat");
      const both = c.ready && f.ready;
      chatTabs.hidden = !both;
      chatTitle.hidden = both;
      chatTitle.textContent = showing === "feed" ? f.title : c.title;
      tabRoom.textContent = c.unread && showing !== "room" ? `Room chat: ${c.unread} new` : "Room chat";
      tabRoom.setAttribute("aria-selected", String(showing === "room"));
      tabFeed.setAttribute("aria-selected", String(showing === "feed"));
      feedLead.hidden = showing !== "feed";
      feedSaid.hidden = showing !== "feed";
      chatField.maxLength = showing === "feed" ? f.limit : c.limit;
      const words2 = showing === "feed" ? "Write a post" : "Write to the room";
      chatField.placeholder = words2;
      chatField.setAttribute("aria-label", words2);
      chatSend.textContent = showing === "feed" ? "Send out a post" : "Send";
      if (showing === "feed") {
        feedLead.textContent = f.lead;
        feedSaid.textContent = f.said;
        const nowSec = Math.floor(Date.now() / 1e3);
        chatLines.replaceChildren(...f.posts.map((p) => el("li", { class: `post ${p.state}` }, p.text, el("small", {}, p.state === "sending" ? "Sending\u2026" : p.state === "failed" ? "Not sent" : ago(p.at, nowSec)))));
        chatEmpty.textContent = f.loading ? "Fetching your posts\u2026" : "Nothing here yet. What you send out appears here, and on Nostr for anyone to read.";
        chatEmpty.hidden = f.posts.length > 0;
        chatLines.hidden = f.posts.length === 0;
        return;
      }
      const lines = chatState === "peek" ? c.lines.slice(-PEEK_LINES) : c.lines;
      const atEnd = chatLines.scrollHeight - chatLines.scrollTop - chatLines.clientHeight < 40;
      chatLines.replaceChildren(
        ...lines.map((line) => {
          const li = el("li", { class: line.note ? "aside" : line.mine ? "mine" : "" }, !line.note && el("b", {}, line.mine ? "You" : line.who), line.note ? "" : " ", line.text);
          if (line.color && !line.mine) li.style.setProperty("--who", line.color);
          return li;
        })
      );
      chatEmpty.textContent = ROOM_EMPTY;
      chatEmpty.hidden = lines.length > 0;
      chatLines.hidden = lines.length === 0;
      if (chatState === "open" && (atEnd || lines[lines.length - 1]?.mine)) chatLines.scrollTop = chatLines.scrollHeight;
      if (chatState === "open") controls2.chat.seen();
    };
    const setChatOpen = (next, tab) => {
      if (next) {
        const c = controls2.chat.view();
        const f = controls2.feed.view();
        const want = tab ?? (chatState === "open" ? dockTab : c.ready ? "room" : "feed");
        if (!(want === "feed" ? f.ready : c.ready) || host.hidden || controls2.view().presence === "hidden") return;
        const was = chatState === "open";
        if (was && want === dockTab) return;
        dockTab = want;
        if (want === "feed") controls2.feed.opened();
        chatHint.textContent = "";
        if (!was) {
          if (open2) setOpen(false);
          chatCameFrom = focused();
          setChatState("open");
        }
        draw();
        chatLines.scrollTop = want === "feed" ? 0 : chatLines.scrollHeight;
        chatField.focus({ preventScroll: true });
        controls2.signal(want === "feed" ? "feedOpen" : "chatOpen");
        return;
      }
      if (chatState !== "open") return;
      setChatState("closed");
      draw();
      controls2.signal("chatClose");
      const back = chatCameFrom;
      chatCameFrom = null;
      if (back?.isConnected && back !== document.body && !chat.contains(back) && getComputedStyle(back).display !== "none") back.focus({ preventScroll: true });
      else focused()?.blur();
    };
    let chatCameFrom = null;
    chatClose.addEventListener("click", () => setChatOpen(false));
    tabRoom.addEventListener("click", () => setChatOpen(true, "room"));
    tabFeed.addEventListener("click", () => setChatOpen(true, "feed"));
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatField.value;
      if (!text.trim()) return setChatOpen(false);
      const trouble = dockTab === "feed" ? controls2.feed.send(text) : controls2.chat.send(text);
      chatHint.textContent = trouble ?? "";
      if (!trouble) chatField.value = "";
      if (!trouble && dockTab === "feed") chatLines.scrollTop = 0;
      chatField.focus({ preventScroll: true });
    });
    chatField.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        e.preventDefault();
        setChatOpen(false);
      }
    });
    chatField.addEventListener("keypress", (e) => e.stopPropagation());
    const vv = typeof visualViewport === "undefined" ? null : visualViewport;
    const onViewport = () => {
      if (!vv) return;
      const covered = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
      host.classList.toggle("keys-up", covered > 80 && chatState === "open");
      host.style.setProperty("--kb", `${covered}px`);
    };
    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", onViewport);
    const draw = () => {
      const view2 = controls2.view();
      const t = view2.theme;
      host.style.setProperty("--accent", rgb(t.accent));
      host.style.setProperty("--ink", rgb(t.ink));
      host.style.setProperty("--glass", rgb(t.glass));
      host.style.setProperty("--warn", rgb(t.warn));
      host.style.setProperty("--s", String(t.scale));
      host.classList.toggle("moving", t.motion);
      host.dataset.presence = view2.presence;
      host.dataset.corner = view2.corner;
      host.classList.toggle("no-menu-key", view2.keys.menu === null);
      host.classList.toggle("no-hotbar-keys", !view2.keys.hotbar);
      const key = menu2.querySelector("kbd");
      if (key && view2.keys.menu) key.textContent = view2.keys.menu.toUpperCase();
      title.textContent = view2.title;
      address.textContent = view2.address;
      const shown3 = [view2.target, ...view2.detail].join("\n");
      if (target2.dataset.shown !== shown3) {
        target2.dataset.shown = shown3;
        target2.classList.toggle("card", view2.detail.length > 0);
        if (view2.detail.length) target2.replaceChildren(el("b", {}, view2.target), ...view2.detail.map((line) => el("span", {}, line)));
        else target2.textContent = view2.target;
      }
      drawChat(view2);
      if (!view2.sections.some((s) => s.id === section)) section = view2.sections[0]?.id ?? "";
      const now = JSON.stringify([view2.hotbar, view2.sections, section, open2, view2.presence]);
      if (now === drawn) return;
      drawn = now;
      hotbar.replaceChildren(
        ...view2.hotbar.map((item, i) => {
          const b = el(
            "button",
            { class: `key ${item.tone}`, type: "button", "aria-label": item.label, ...item.on === null ? {} : { "aria-pressed": String(item.on) } },
            el("span", { class: "arch" }, icon(item.icon ?? "door")),
            el("span", { class: "sill" }),
            el("span", { class: "name" }, item.short),
            el("kbd", { class: "num mono" }, item.key)
          );
          b.style.setProperty("--i", String(i));
          b.addEventListener("click", () => press(item));
          return b;
        })
      );
      hotbar.hidden = view2.hotbar.length === 0;
      tabs.replaceChildren(
        ...view2.sections.map((s) => {
          const b = el("button", { class: "tab", type: "button", role: "tab", "aria-selected": String(s.id === section) }, icon(s.icon), s.label);
          b.addEventListener("click", () => {
            section = s.id;
            chose = true;
            draw();
            tabs.querySelector('[aria-selected="true"]')?.focus();
          });
          return b;
        })
      );
      const showing = open2 ? section : "";
      const bring = showing !== tabsShowing;
      tabsShowing = showing;
      requestAnimationFrame(() => {
        const chosen = tabs.querySelector('[aria-selected="true"]');
        if (bring && open2 && chosen) {
          const clear = 46;
          const left = chosen.offsetLeft - clear;
          const right = chosen.offsetLeft + chosen.offsetWidth + clear - tabs.clientWidth;
          if (tabs.scrollLeft > left) tabs.scrollLeft = Math.max(0, left);
          else if (tabs.scrollLeft < right) tabs.scrollLeft = right;
        }
        tendTabs();
      });
      const current = view2.sections.find((s) => s.id === section);
      const drawSwatch = (item) => {
        const b = el("button", { class: "swatch", type: "button", "aria-label": item.label, "aria-pressed": String(item.on === true) }, el("i"), el("u"), item.label);
        b.style.setProperty("--c", item.color);
        b.addEventListener("click", () => press(item));
        return b;
      };
      const swatches = (current?.items ?? []).filter((i) => i.kind === "swatch");
      rows.replaceChildren(
        current?.card ? drawCard(current.card) : "",
        swatches.length ? el("div", { class: "swatches" }, ...swatches.map(drawSwatch)) : "",
        ...(current?.items ?? []).filter((i) => i.kind !== "swatch").map((item) => {
          const b = el(
            "button",
            { class: `row ${item.tone}`, type: "button", ...item.on === null ? {} : { "aria-pressed": String(item.on) } },
            icon(item.icon),
            el("span", { class: "grow" }, item.label),
            item.on !== null && el("span", { class: "state" }, item.on ? "On" : "Off"),
            item.key ? el("kbd", { class: "mono" }, item.key) : null
          );
          b.addEventListener("click", () => press(item));
          return b;
        })
      );
      rows.hidden = !current?.items.length && !current?.card;
      note.textContent = current?.note ?? "";
      sheet.hidden = !open2;
      menu2.setAttribute("aria-expanded", String(open2));
      quiet.setAttribute("aria-expanded", String(open2));
    };
    const focused = () => {
      let at = document.activeElement;
      while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
      return at;
    };
    let cameFrom = null;
    const setOpen = (next, at) => {
      if (next && at) {
        section = at;
        chose = true;
        if (open2) return void draw();
      }
      if (open2 === next) return;
      if (next) {
        if (chatState === "open") setChatOpen(false);
        cameFrom = focused();
        if (!chose) section = "";
      }
      open2 = next;
      controls2.signal(open2 ? "menuOpen" : "menuClose");
      draw();
      if (open2) return void tabs.querySelector('[aria-selected="true"]')?.focus();
      const back = cameFrom;
      cameFrom = null;
      if (back?.isConnected && back !== document.body && getComputedStyle(back).display !== "none") back.focus({ preventScroll: true });
      else focused()?.blur();
    };
    menu2.addEventListener("click", () => setOpen(!open2));
    quiet.addEventListener("click", () => setOpen(!open2));
    close.addEventListener("click", () => setOpen(false));
    const onKey = (e) => {
      if (host.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      const at = e.composedPath()[0];
      if (at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable)) return;
      if (e.key === "Escape" && open2) return setOpen(false);
      const view2 = controls2.view();
      if (view2.keys.menu && e.key.toLowerCase() === view2.keys.menu && view2.presence !== "hidden") return setOpen(!open2);
      if (view2.keys.chat && view2.chat.ready && view2.presence !== "hidden" && !open2 && !e.repeat && (e.key.toLowerCase() === view2.keys.chat || e.key === "Enter" && at?.tagName !== "BUTTON" && at?.tagName !== "A")) {
        e.preventDefault();
        return setChatOpen(true);
      }
      if (!view2.keys.hotbar || view2.presence !== "full") return;
      const item = view2.hotbar.find((i) => i.key === e.key);
      if (item) press(item);
    };
    addEventListener("keydown", onKey);
    const onSummonKey = (e) => {
      if (e.code !== SUMMON_KEY || host.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      const at = e.composedPath()[0];
      if (at && (at.tagName === "INPUT" || at.tagName === "TEXTAREA" || at.isContentEditable)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) setOpen(!open2);
    };
    const swallow = (e) => {
      if (e.code === SUMMON_KEY && !host.hidden && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopImmediatePropagation();
    };
    const hold = createHoldWatch({
      onHeld: () => {
        if (!host.hidden) setOpen(!open2);
      }
    });
    const onTouch = (e) => hold.touches([...e.touches].map((t) => ({ x: t.clientX, y: t.clientY })));
    const listening = { capture: true };
    const watching2 = { capture: true, passive: true };
    addEventListener("keydown", onSummonKey, listening);
    addEventListener("keyup", swallow, listening);
    for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) addEventListener(type, onTouch, watching2);
    const stopSay = controls2.onSay((text) => {
      const line = el("div", { class: "say glass" }, text);
      says.append(line);
      while (says.childElementCount > 3) says.firstElementChild?.remove();
      setTimeout(() => line.classList.add("going"), 3600);
      setTimeout(() => line.remove(), 4200);
    });
    const stop = controls2.subscribe(draw);
    const stopAsking = controls2.onSignal((name) => {
      if (name.startsWith("show:") && !host.hidden) setOpen(true, name.slice(5));
      if (name === "toggle:chat" && !host.hidden) setChatOpen(!(chatState === "open" && dockTab === "room"), "room");
      if (name === "toggle:feed" && !host.hidden) setChatOpen(!(chatState === "open" && dockTab === "feed"), "feed");
    });
    const tick = setInterval(draw, 400);
    host.classList.add("arriving");
    setTimeout(() => host.classList.remove("arriving"), 1200);
    draw();
    return {
      element: host,
      get open() {
        return open2;
      },
      setOpen,
      get chatOpen() {
        return chatState === "open";
      },
      get chatTab() {
        return dockTab;
      },
      setChatOpen,
      bounds() {
        if (host.hidden) return [];
        return [id, menu2, quiet, hotbar, target2, sheet, ...chatState === "open" ? [chat] : []].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }));
      },
      cover() {
        if (host.hidden || controls2.presence !== "full") return { top: 0, bottom: 0 };
        const low = hotbar.getBoundingClientRect();
        const high = id.getBoundingClientRect();
        return { top: Math.round(high.bottom), bottom: Math.round(innerHeight - Math.min(low.top, target2.getBoundingClientRect().top)) };
      },
      setHidden(hidden) {
        host.hidden = hidden;
        if (hidden) {
          setOpen(false);
          setChatOpen(false);
        }
      },
      remove() {
        clearInterval(tick);
        tabsWatch?.disconnect();
        clearTimeout(peekTimer);
        clearTimeout(goingTimer);
        vv?.removeEventListener("resize", onViewport);
        vv?.removeEventListener("scroll", onViewport);
        stop();
        stopAsking();
        stopSay();
        removeEventListener("keydown", onKey);
        removeEventListener("keydown", onSummonKey, listening);
        removeEventListener("keyup", swallow, listening);
        for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) removeEventListener(type, onTouch, watching2);
        hold.cancel();
        host.remove();
      }
    };
  }

  // packages/sdk/src/ui/chat.ts
  var CHAT_KEY = "nswp:chat";
  var shown2 = null;
  var watchers2 = /* @__PURE__ */ new Set();
  function showsChat() {
    if (shown2 !== null) return shown2;
    const came = arrivedSettings().chat;
    let kept = null;
    try {
      kept = localStorage.getItem(CHAT_KEY);
    } catch {
    }
    shown2 = came ?? kept !== "0";
    if (came !== void 0) keep3(shown2);
    reportSettings("chat", () => ({ chat: showsChat() }));
    return shown2;
  }
  var keep3 = (on) => {
    try {
      if (on) localStorage.removeItem(CHAT_KEY);
      else localStorage.setItem(CHAT_KEY, "0");
    } catch {
    }
  };
  function onChatChange(cb) {
    watchers2.add(cb);
    return () => void watchers2.delete(cb);
  }
  function createUiChat(changed) {
    let send = null;
    let title = "Room chat";
    let lines = [];
    let unread = 0;
    let version = 0;
    let count = 0;
    const bump2 = () => {
      version++;
      changed();
    };
    onChatChange(() => {
      if (!showsChat()) {
        lines = [];
        unread = 0;
      }
      bump2();
    });
    return {
      attach(fn, opts = {}) {
        send = fn;
        title = opts.title ?? "Room chat";
        lines = [];
        unread = 0;
        bump2();
      },
      detach() {
        if (!send && !lines.length) return;
        send = null;
        lines = [];
        unread = 0;
        bump2();
      },
      add(line) {
        if (!send || !showsChat()) return;
        const text = cleanChat(line.text);
        if (!text) return;
        lines.push({ key: `${line.id ?? "n"}-${++count}`, who: line.note ? "" : cleanChat(line.who ?? "").slice(0, 48), text, mine: !!line.mine, note: !!line.note, color: line.color ?? "", at: Date.now() });
        if (lines.length > CHAT_LIMITS.kept) lines = lines.slice(-CHAT_LIMITS.kept);
        if (!line.mine && !line.note) unread++;
        bump2();
      },
      send(text) {
        if (!send || !showsChat()) return "There is nobody to write to: join the room first.";
        if (!cleanChat(text)) return null;
        return send(text) ?? null;
      },
      seen() {
        if (!unread) return;
        unread = 0;
        bump2();
      },
      view() {
        return { ready: !!send && showsChat(), title, lines, unread, limit: CHAT_LIMITS.chars, version };
      }
    };
  }

  // packages/sdk/src/ui/model.ts
  var PRESENCES = ["full", "quiet", "hidden"];
  var CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"];
  function cleanKeys2(now, k) {
    const out = { ...now };
    if (k && (k.menu === null || typeof k.menu === "string" && k.menu.length === 1)) out.menu = k.menu === null ? null : k.menu.toLowerCase();
    if (k && typeof k.hotbar === "boolean") out.hotbar = k.hotbar;
    if (k && (k.chat === null || typeof k.chat === "string" && k.chat.length === 1)) out.chat = k.chat === null ? null : k.chat.toLowerCase();
    return out;
  }
  var read = (t) => typeof t === "function" ? t() : t ?? "";
  var STANDARD = [
    { id: "travel", label: "Travel", icon: "door" },
    // Who the visitor is here. It has something in it only for one who came through a client (ui/identity.ts).
    { id: "you", label: "You", icon: "you" },
    // How other people see them. A visitor's own client fills this in, in its own place: a look is changed there and
    // nowhere else (ui/identity.ts, protocol/05-looks.md). In a world it is empty, and isn't shown.
    { id: "figure", label: "Your look", icon: "look" },
    { id: "room", label: "Room", icon: "room" },
    { id: "people", label: "People", icon: "people" },
    { id: "camera", label: "Camera", icon: "camera" },
    { id: "panels", label: "Panels", icon: "panel" },
    { id: "view", label: "View", icon: "vr" },
    { id: "moving", label: "Moving", icon: "step" },
    { id: "sound", label: "Sound", icon: "sound" },
    // How the controls themselves look. Called "Display", since "your look" is how other people see you.
    { id: "look", label: "Display", icon: "look", note: "How these controls look to you: their colour, the size of their text, whether things move. They go with you from world to world." },
    { id: "help", label: "Help", icon: "help" }
  ];
  var STANDARD_ORDER = ["back", "home", "go-home", "doors", "list", "vr", "room-join", "room-mic", "room-chat", "jump"];
  var rank = (id) => {
    const i = STANDARD_ORDER.indexOf(id);
    return i === -1 ? STANDARD_ORDER.length : i;
  };
  var inOrder = (list) => list.map((a, i) => [a, i]).sort((x, y) => rank(x[0].id) - rank(y[0].id) || x[1] - y[1]).map((x) => x[0]);
  function createControls(opts) {
    const sections = STANDARD.map((s) => ({ ...s }));
    for (const s of opts.sections ?? []) addSection(s);
    const actions = [];
    const listeners = /* @__PURE__ */ new Set();
    const sayers = /* @__PURE__ */ new Set();
    const signals = /* @__PURE__ */ new Set();
    let visitor = loadVisitorTheme();
    const came = arrivedSettings();
    const brought = { ...came.text !== void 0 ? { scale: came.text } : {}, ...came.motion !== void 0 ? { motion: came.motion } : {}, ...came.wrist !== void 0 ? { wrist: came.wrist } : {} };
    if (Object.keys(brought).length) {
      visitor = { ...visitor, ...brought };
      saveVisitorTheme(visitor);
    }
    reportSettings("look", () => ({ ...visitor.scale !== void 0 ? { text: visitor.scale } : {}, ...visitor.motion !== void 0 ? { motion: visitor.motion } : {}, ...visitor.wrist !== void 0 ? { wrist: visitor.wrist } : {} }));
    let theme = resolveTheme(opts.theme, visitor);
    let target2 = "";
    let detail = [];
    let presence2 = PRESENCES.includes(opts.presence) ? opts.presence : "full";
    let corner = CORNERS.includes(opts.corner) ? opts.corner : "top-left";
    let keys = cleanKeys2({ menu: "m", hotbar: true, chat: "t" }, opts.keys);
    let claimed = false;
    const changed = () => {
      for (const fn of listeners) fn();
    };
    const chat = createUiChat(changed);
    const feed = createUiFeed(changed);
    function addSection(s) {
      const i = sections.findIndex((x) => x.id === s.id);
      if (i === -1) sections.push({ ...s });
      else sections[i] = { ...sections[i], ...s };
    }
    const controls2 = {
      get theme() {
        return theme;
      },
      add(...more) {
        for (const a of more) {
          const i = actions.findIndex((x) => x.id === a.id);
          if (i === -1) actions.push(a);
          else actions[i] = a;
        }
        changed();
      },
      has: (id) => actions.some((x) => x.id === id),
      remove(id) {
        const i = actions.findIndex((x) => x.id === id);
        if (i !== -1) actions.splice(i, 1);
        changed();
      },
      addSection(s) {
        addSection(s);
        changed();
      },
      get presence() {
        return presence2;
      },
      setPresence(next) {
        if (!PRESENCES.includes(next) || next === presence2) return;
        presence2 = next;
        changed();
      },
      setCorner(next) {
        if (!CORNERS.includes(next) || next === corner) return;
        corner = next;
        changed();
      },
      setKeys(next) {
        keys = cleanKeys2(keys, next);
        changed();
      },
      claimInput(next) {
        if (claimed === next) return;
        claimed = next;
        changed();
      },
      setTarget(text, more = []) {
        const next = text ? more.filter((line) => typeof line === "string" && line.trim()).slice(0, 4) : [];
        if (text === target2 && next.join("\n") === detail.join("\n")) return;
        target2 = text;
        detail = next;
        changed();
      },
      say(text) {
        for (const fn of sayers) fn(text);
      },
      run(id) {
        const a = actions.find((x) => x.id === id);
        if (!a || a.hidden?.()) return false;
        for (const fn of signals) fn("press");
        void Promise.resolve().then(() => a.act()).catch(() => {
        }).finally(changed);
        return true;
      },
      setTheme(patch, keep5 = false) {
        if (keep5) {
          visitor = { ...visitor, ...patch };
          saveVisitorTheme(visitor);
        }
        theme = resolveTheme({ ...opts.theme, ...keep5 ? {} : patch }, visitor);
        changed();
      },
      view() {
        const showing = inOrder(actions.filter((a) => !a.hidden?.()));
        const bar = showing.filter((a) => a.hotbar).slice(0, 6);
        const item = (a) => {
          const slot = bar.indexOf(a);
          return { id: a.id, label: read(a.label), icon: (typeof a.icon === "function" ? a.icon() : a.icon) ?? null, on: a.on ? a.on() : null, tone: a.tone ?? "normal", key: slot === -1 ? "" : String(slot + 1), short: read(a.short) || read(a.label), kind: a.kind ?? "button", color: read(a.color) };
        };
        const known = new Set(sections.map((s) => s.id));
        const extra = [...new Set(showing.map((a) => a.section ?? "travel").filter((id) => !known.has(id)))].map((id) => ({ id, label: id }));
        return {
          title: opts.title,
          address: opts.address ?? "",
          target: target2,
          detail,
          sections: [...sections, ...extra].map((s) => ({ id: s.id, label: s.label, icon: s.icon ?? null, note: read(s.note), card: s.card?.() ?? null, items: showing.filter((a) => (a.section ?? "travel") === s.id).map(item) })).filter((s) => s.items.length > 0 || s.note || s.card),
          hotbar: bar.map(item),
          theme,
          presence: presence2,
          corner,
          keys: claimed ? { menu: null, hotbar: false, chat: null } : keys,
          chat: chat.view(),
          feed: feed.view()
        };
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      signal(name) {
        for (const fn of signals) {
          try {
            fn(name);
          } catch {
          }
        }
      },
      onSignal(fn) {
        signals.add(fn);
        return () => signals.delete(fn);
      },
      onSay(fn) {
        sayers.add(fn);
        return () => sayers.delete(fn);
      },
      chat,
      feed
    };
    const keep4 = (patch) => controls2.setTheme(patch, true);
    controls2.add(
      ...UI_PRESETS.map(
        (p) => ({ id: `look-${p.id}`, section: "look", kind: "swatch", color: p.accent, label: p.label, on: () => theme.accent === p.accent, act: () => keep4({ accent: p.accent }) })
      ),
      { id: "look-size", section: "look", icon: "size", label: () => theme.scale > 1 ? "Text: larger" : "Text: normal", on: () => theme.scale > 1, act: () => keep4({ scale: theme.scale > 1 ? 1 : 1.25 }) },
      { id: "look-motion", section: "look", icon: "motion", label: () => theme.motion ? "Motion: on" : "Motion: off", on: () => theme.motion, act: () => keep4({ motion: !theme.motion }) },
      {
        id: "look-wrist",
        section: "look",
        icon: "menu",
        label: () => theme.wrist === "off" ? "Wrist console: off" : `Wrist console: ${theme.wrist} hand`,
        on: () => theme.wrist !== "off",
        act: () => keep4({ wrist: theme.wrist === "left" ? "right" : theme.wrist === "right" ? "off" : "left" })
      },
      { id: "look-reset", section: "look", icon: "turn", label: "Back to this world's look", hidden: () => Object.keys(visitor).length === 0, act: () => {
        visitor = {};
        saveVisitorTheme({});
        theme = resolveTheme(opts.theme, visitor);
      } }
    );
    return controls2;
  }

  // packages/sdk/src/engine-menu.ts
  var read2 = (text) => {
    try {
      const v = typeof text === "string" && text ? JSON.parse(text) : text;
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  };
  var words = (v, most) => typeof v === "string" ? v.slice(0, most) : "";
  var queue = [];
  var tell = (event) => {
    if (queue.length < 64) queue.push(event);
  };
  var controls = null;
  var hud = null;
  var sounds = null;
  var moving = "casual";
  var vr = { supported: false, presenting: false };
  var doors = /* @__PURE__ */ new Map();
  function kit() {
    return JSON.stringify({
      walkSpeed: WALK_SPEED,
      // The fastest anyone goes on foot: a run. However an engine moves its visitor, never faster than this.
      topSpeed: TOP_SPEED,
      tapReach: TAP_REACH,
      sprint: SPRINT,
      // Both as the visitor has set them: the kit's own speed times theirs. Read again when a `changed` event comes.
      dragLook: DRAG_LOOK * lookScale(),
      lookSpeed: LOOK_SPEED * lookScale(),
      // How wide they asked to see at a desk, in degrees top to bottom, or 0 for the world's own.
      fov: visitorFov() ?? 0,
      pitchLimit: PITCH_LIMIT,
      doubleTap: DOUBLE_TAP,
      jumpHeight: JUMP_HEIGHT,
      jumpGravity: JUMP_GRAVITY,
      gateWidth: PORTAL_WIDTH,
      gateHeight: PORTAL_HEIGHT,
      gateSpring: PORTAL_SPRING,
      gateSignHeight: PORTAL_SIGN_HEIGHT,
      doorReach: DOOR_REACH,
      cues: CUES
    });
  }
  function check(url) {
    const c = checkDestination(typeof url === "string" ? url : "");
    if (!c.ok) return JSON.stringify({ ok: false, code: c.error.code, domain: "", prefix: "", host: "" });
    return JSON.stringify({ ok: true, code: "", domain: c.value.registrableDomain ?? c.value.hostname, prefix: c.value.hostPrefix, host: c.value.hostname });
  }
  function menu(options) {
    if (controls) return JSON.stringify({ moving, mouse: hasMouse() });
    const o = read2(options);
    const title = words(o.title, 80) || "A world";
    const accent = /^#[0-9a-f]{6}$/i.test(String(o.accent)) ? String(o.accent) : void 0;
    const c = controls = createControls({ title, address: location.host, ...accent ? { theme: { accent } } : {} });
    const h = hud = mountHud(c);
    const s = sounds = createSounds({
      seed: title,
      ...typeof o.kit === "string" && o.kit ? { kit: o.kit } : {},
      ...o.sounds && typeof o.sounds === "object" ? { theme: o.sounds } : {}
    });
    addSoundControls(c, s);
    const atHome = arrival.atHome();
    c.add({
      id: "home",
      section: "travel",
      icon: "home",
      hotbar: true,
      label: atHome ? "Your doors" : "Go home",
      short: atHome ? "Doors" : "Home",
      hidden: () => portal.airlockFor() === null,
      act: () => tell({ type: atHome ? "doors" : "home" })
    });
    if (identityHost()) {
      c.addSection(identitySection());
      c.add(
        { id: "figure", section: "you", icon: "look", label: "Change how you look", short: "Look", act: () => tell({ type: "figure" }) },
        { id: "identity", section: "you", icon: "you", label: () => identityWords().label, short: () => identityWords().short, act: () => tell({ type: "identity" }) }
      );
    }
    const context = arrival.read().context;
    moving = startsIntense(context?.moving === "intense") ? "intense" : "casual";
    if (hasMouse()) reportSettings("moving", () => ({ intense: moving === "intense" }));
    c.add({
      id: "fps",
      section: "moving",
      icon: "step",
      on: () => moving === "intense",
      hidden: () => !hasMouse() || vr.presenting,
      label: () => moving === "intense" ? DESK_WORDS.intense : DESK_WORDS.casual,
      act: () => {
        moving = moving === "intense" ? "casual" : "intense";
        keepIntense(moving === "intense");
        tell({ type: "moving", moving });
        c.say(moving === "intense" ? DESK_WORDS.nowIntense : DESK_WORDS.nowCasual);
      }
    });
    c.add({
      id: "jump",
      section: "moving",
      icon: "step",
      label: "Jump",
      short: "Jump",
      hotbar: !hasMouse(),
      hidden: () => vr.presenting,
      act: () => tell({ type: "jump" })
    });
    c.add(
      {
        id: "vr",
        section: "view",
        icon: "vr",
        tone: "primary",
        hotbar: true,
        hidden: () => !vr.supported,
        label: () => vr.presenting ? "Leave VR" : "Enter VR",
        short: "VR",
        // A browser starts a headset session only on a press. This is one, and the engine hears of it within a frame.
        act: () => tell({ type: "vr", enter: !vr.presenting })
      },
      fullscreenAction(c, () => vr.presenting)
    );
    addDeskControls(c, { presenting: () => vr.presenting });
    document.addEventListener("fullscreenchange", () => c.setTarget(""));
    c.addSection({
      id: "help",
      label: "Help",
      icon: "help",
      note: words(o.help, 600) || "Drag to look around. Walk with W, A, S, D, or click the floor to step there: twice to run. Shift runs and Space jumps. The key left of 1 brings these controls up in any world, whatever is on screen; on a touch screen, hold two fingers still. Walk into a doorway to go through it: your own Airlock shows where it really leads, and asks, before you go. These controls are this world's own: your headset's or browser's own controls always get you out."
    });
    let told = 0;
    c.subscribe(() => {
      const now = performance.now();
      if (now - told < 120) return;
      told = now;
      tell({ type: "changed" });
    });
    let closedAt = -1;
    c.onSignal((name) => {
      if (name === "menuOpen") tell({ type: "menu", open: true });
      if (name === "menuClose") {
        closedAt = performance.now();
        tell({ type: "menu", open: false });
        document.querySelector("canvas")?.focus();
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement || moving !== "intense" || vr.presenting || h.open) return;
      if (performance.now() - closedAt > 80) h.setOpen(true);
    });
    addEventListener("keydown", (e) => {
      if (e.code !== "Escape" || moving !== "intense" || vr.presenting || h.open || document.pointerLockElement) return;
      if (performance.now() - closedAt > 80) h.setOpen(true);
    });
    return JSON.stringify({ moving, mouse: hasMouse() });
  }
  function events() {
    if (!queue.length) return "[]";
    const out = JSON.stringify(queue);
    queue.length = 0;
    return out;
  }
  function play(cue) {
    if (CUES.includes(cue)) sounds?.play(cue);
  }
  function moved(metres) {
    if (typeof metres === "number" && Number.isFinite(metres) && metres > 0) sounds?.moved(metres);
  }
  function bump() {
    sounds?.bump();
  }
  function say(text) {
    const t = words(text, 300);
    if (t) controls?.say(t);
  }
  function target(name, detail) {
    let lines = [];
    try {
      const d = detail ? JSON.parse(detail) : [];
      if (Array.isArray(d)) lines = d.filter((l) => typeof l === "string").slice(0, 6).map((l) => l.slice(0, 200));
    } catch {
    }
    controls?.setTarget(words(name, 120), lines);
  }
  function headset(state) {
    const s = read2(state);
    vr.supported = s.supported === true;
    vr.presenting = s.presenting === true;
    hud?.setHidden(vr.presenting);
    controls?.setTarget("");
  }
  function view() {
    if (!controls) return JSON.stringify({ sections: [], hotbar: [], open: false });
    const v = controls.view();
    const item = (i) => ({ id: i.id, label: i.label, short: i.short, on: i.on, tone: i.tone });
    return JSON.stringify({
      title: v.title,
      address: v.address,
      presence: v.presence,
      open: hud?.open ?? false,
      sections: v.sections.map((s) => ({ id: s.id, label: s.label, note: s.note, items: s.items.map(item) })),
      hotbar: v.hotbar.map(item)
    });
  }
  function run(id) {
    return typeof id === "string" && !!controls?.run(id);
  }
  function open(on) {
    hud?.setOpen(on === true || on === "true" || on === "1" || on === 1);
  }
  function presence(level2) {
    if (level2 === "full" || level2 === "quiet" || level2 === "hidden") controls?.setPresence(level2);
  }
  function claim(on) {
    controls?.claimInput(on === true || on === "true" || on === "1" || on === 1);
  }
  function door(entry) {
    const d = read2(entry);
    const id = words(d.id, 60);
    if (!id || !controls) return;
    const menuId = `door-${id}`;
    if (d.remove === true) {
      doors.delete(id);
      controls.remove(menuId);
      return;
    }
    if (doors.has(id) || doors.size >= 24) return;
    doors.set(id, words(d.label, 80) || "A door");
    controls.add({ id: menuId, section: "travel", icon: "door", label: () => doors.get(id) ?? "A door", short: "Door", act: () => tell({ type: "door", id }) });
  }

  // packages/sdk/src/engine.ts
  var VERSION = 7;
  var KIT = KIT_VERSION;
  var read3 = (text) => {
    try {
      const v = typeof text === "string" && text ? JSON.parse(text) : text;
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  };
  function stateOf(text) {
    const s = read3(text);
    return {
      immersive: s.immersive === true,
      ...s.joined === true ? { joined: true, ...s.mic === true ? { mic: true } : {} } : {},
      ...s.moving === "intense" ? { moving: "intense" } : {},
      ...Array.isArray(s.blocked) ? { blocked: s.blocked.filter((k) => typeof k === "string") } : {}
    };
  }
  function arrival2() {
    const { context, warnings } = arrival.read();
    const who = arrival.identity();
    return JSON.stringify({
      arrived: !!context,
      entry: context?.entry ?? "",
      immersive: context?.immersive === true,
      home: arrival.atHome(),
      joined: context?.joined === true,
      mic: context?.mic === true,
      moving: context?.moving ?? "casual",
      form: startingForm(),
      settings: context?.settings ?? {},
      blocked: context?.blocked ?? [],
      look: arrival.look() ?? "",
      guest: !who,
      name: who?.name ?? "",
      pubkey: who?.pubkey ?? "",
      canGoHome: portal.airlockFor() !== null,
      warnings: warnings.map((w) => w.code)
    });
  }
  function start(options) {
    const o = read3(options);
    if (typeof o.airlock === "string" && o.airlock) configure({ defaultAirlock: o.airlock });
    return arrival2();
  }
  function go(destination, state) {
    const d = read3(destination);
    const dest = {
      ...typeof d.url === "string" ? { url: d.url } : {},
      ...typeof d.naddr === "string" ? { naddr: d.naddr } : {},
      ...typeof d.entryPoint === "string" ? { entryPoint: d.entryPoint } : {}
    };
    if (!dest.url && !dest.naddr) return "no_destination";
    if (dest.url) {
      const checked = checkDestination(dest.url);
      if (!checked.ok) return checked.error.code;
    }
    void portal.go(dest, stateOf(state)).catch(() => {
    });
    return "";
  }
  function home(state) {
    if (portal.airlockFor() === null) return false;
    void portal.home(stateOf(state));
    return true;
  }
  function signIn(state) {
    if (portal.airlockFor() === null) return false;
    void portal.signIn(stateOf(state));
    return true;
  }
  function changeLook(state) {
    if (portal.airlockFor() === null) return false;
    void portal.changeLook(stateOf(state));
    return true;
  }
  function doors2(state) {
    if (portal.airlockFor() === null) return false;
    void portal.doors(stateOf(state));
    return true;
  }
  return __toCommonJS(engine_exports);
})();

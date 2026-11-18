/** Speaking instead of typing (speech.ts): the parts that need no microphone. */
import { describe, expect, it } from "vitest";
import { browserVoice, cleanSpoken, createVoice, toPcm16, type Hearing, type VoiceSource } from "../src/speech.js";

describe("what a microphone heard", () => {
  it("is made into 16-bit samples at the rate a recogniser wants", () => {
    const three = new Float32Array(48000).fill(0.5);
    const out = toPcm16(three, 48000);
    expect(out.length).toBe(16000);
    expect(out[0]).toBe(Math.round(0.5 * 32767));
    // Each new sample is the average of the ones it covers, so a fast wobble isn't mistaken for a slow one.
    expect(toPcm16(Float32Array.from([1, -1, 1, 1, 0.5, 0.5]), 3, 1)).toEqual(Int16Array.from([Math.round(32767 / 3), Math.round((2 / 3) * 32767)]));
    expect(toPcm16(Float32Array.from([2, -2, 0]), 16000)).toEqual(Int16Array.from([32767, -32767, 0]));
    expect(toPcm16(new Float32Array(0), 44100).length).toBe(0);
    expect(toPcm16(three, 0).length).toBe(0);
  });

  it("comes back as words on one line", () => {
    expect(cleanSpoken("  make  a\nnew file ")).toBe("make a new file");
    expect(cleanSpoken("go\r")).toBe("go");
  });
});

/** A source that hears whatever the test says it heard. */
const fake = (name: string, isPrivate: boolean) => {
  const calls: { lang: string; stopped: boolean; cancelled: boolean; finish(text: string | null, why?: string | null): void }[] = [];
  const source: VoiceSource = {
    name,
    private: isPrivate,
    hear(o) {
      const call = { lang: o.lang, stopped: false, cancelled: false, finish: (text: string | null, why: string | null = null) => (text && o.onText(text), o.onEnd(why)) };
      calls.push(call);
      const hearing: Hearing = { stop: () => void (call.stopped = true), cancel: () => void (call.cancelled = true) };
      return hearing;
    },
  };
  return { source, calls };
};
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const none = Promise.resolve(null);

describe("the one button", () => {
  it("listens, then works out the words, then types them", () => {
    const voice = createVoice({ lang: "en-GB", storage: store(), browser: none });
    const mine = fake("your computer", true);
    voice.add(mine.source);
    const typed: string[] = [];
    const said: string[] = [];
    const press = () => voice.toggle({ onText: (t) => typed.push(t), say: (m) => said.push(m) });
    press();
    expect(voice.state).toBe("listening");
    expect(mine.calls[0]!.lang).toBe("en-GB");
    expect(said.at(-1)).toMatch(/^Listening, with your computer/);
    press();
    expect(voice.state).toBe("working");
    expect(mine.calls[0]!.stopped).toBe(true);
    press(); // pressed again while it works: nothing
    expect(mine.calls.length).toBe(1);
    mine.calls[0]!.finish("list the files");
    expect(typed).toEqual(["list the files"]);
    expect(voice.state).toBe("idle");
  });

  it("prefers the visitor's own devices to anything that sends their voice away", () => {
    const voice = createVoice({ storage: store(), browser: none });
    const browser = fake("this browser", false);
    voice.add(browser.source);
    expect(voice.source?.name).toBe("this browser");
    const mine = fake("your computer", true);
    const remove = voice.add(mine.source);
    expect(voice.source?.name).toBe("your computer");
    remove();
    expect(voice.source?.name).toBe("this browser");
  });

  it("says, once and before a word is heard, when the voice may leave the device", () => {
    const kept = store();
    const voice = createVoice({ storage: kept, browser: none });
    const browser = fake("this browser", false);
    voice.add(browser.source);
    const said: string[] = [];
    const press = () => voice.toggle({ onText: () => {}, say: (m) => said.push(m) });
    press();
    expect(voice.state).toBe("asking");
    expect(browser.calls.length).toBe(0); // nothing has been heard
    expect(said.at(-1)).toMatch(/may send your voice to its maker/);
    press();
    expect(voice.state).toBe("listening");
    browser.calls[0]!.finish("hello");
    // Next time it isn't asked again, here or after a reload.
    press();
    expect(voice.state).toBe("listening");
    browser.calls[1]!.finish(null, "Nothing was heard.");
    expect(said.at(-1)).toBe("Nothing was heard.");
    const later = createVoice({ storage: kept, browser: none });
    later.add(fake("this browser", false).source);
    later.toggle({ onText: () => {}, say: () => {} });
    expect(later.state).toBe("listening");
  });

  it("says so when nothing can listen, and can be called off", () => {
    const voice = createVoice({ storage: store(), browser: none });
    const said: string[] = [];
    voice.toggle({ onText: () => {}, say: (m) => said.push(m) });
    expect(said).toEqual(["Nothing here can turn speech into text."]);
    const mine = fake("your computer", true);
    voice.add(mine.source);
    let told = 0;
    voice.subscribe(() => told++);
    voice.toggle({ onText: () => {}, say: () => {} });
    voice.cancel();
    expect(mine.calls[0]!.cancelled).toBe(true);
    expect(voice.state).toBe("idle");
    expect(told).toBeGreaterThanOrEqual(2);
  });
});

describe("a browser's own recogniser", () => {
  class Recogniser {
    static made: Recogniser[] = [];
    lang = "";
    continuous = false;
    interimResults = true;
    processLocally?: boolean;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      Recogniser.made.push(this);
    }
    start() {}
    stop() {
      this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: "open the  door" }], { isFinal: true }), Object.assign([{ transcript: "not yet sure" }], { isFinal: false })] });
      this.onend?.();
    }
    abort() {
      this.onerror?.({ error: "aborted" });
      this.onend?.();
    }
  }

  it("is nothing where the browser has none", async () => {
    expect(await browserVoice("en", {})).toBeNull();
  });

  it("is not private unless the browser says it can do the work on the device, and is then told it must", async () => {
    const away = (await browserVoice("en", { webkitSpeechRecognition: Recogniser }))!;
    expect(away.private).toBe(false);
    const onDevice = (await browserVoice("en", { SpeechRecognition: Object.assign(Recogniser, { available: async () => "available" }) }))!;
    expect(onDevice.private).toBe(true);
    const texts: string[] = [];
    const ends: (string | null)[] = [];
    const h = onDevice.hear({ lang: "en-GB", onText: (t) => texts.push(t), onEnd: (w) => ends.push(w) });
    const rec = Recogniser.made.at(-1)!;
    expect([rec.lang, rec.continuous, rec.interimResults, rec.processLocally]).toEqual(["en-GB", true, false, true]);
    h.stop();
    expect(texts).toEqual(["open the door"]); // only what it was sure of
    expect(ends).toEqual([null]);
    // Called off: nothing is typed, and nothing is complained of.
    const dropped: string[] = [];
    onDevice.hear({ lang: "en", onText: (t) => dropped.push(t), onEnd: (w) => ends.push(w) }).cancel();
    expect(dropped).toEqual([]);
    expect(ends).toEqual([null, null]);
    // "downloadable" is not "available": the sound would have to go away, so it isn't called private.
    expect((await browserVoice("en", { SpeechRecognition: Object.assign(Recogniser, { available: async () => "downloadable" }) }))!.private).toBe(false);
  });

  it("puts a failure in plain words", async () => {
    class Refused extends Recogniser {
      override start() {
        this.onerror?.({ error: "not-allowed" });
        this.onend?.();
      }
    }
    const ends: (string | null)[] = [];
    (await browserVoice("en", { SpeechRecognition: Refused }))!.hear({ lang: "en", onText: () => {}, onEnd: (w) => ends.push(w) });
    expect(ends).toEqual(["The microphone isn't allowed here."]);
  });
});

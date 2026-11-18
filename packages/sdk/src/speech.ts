/**
 * Speaking instead of typing.
 *
 * Something has to turn the sound into words, and who does that is the whole
 * question. There are two that this kit will use:
 *
 * - **The visitor's own computer**, where a terminal is connected to a Bridge
 *   that listens (browser/bridge.md). The sound goes to their computer over
 *   the connection the terminal already has, and nowhere else.
 * - **The browser itself**, where it has speech recognition. Some browsers do
 *   this on the device. Others send the sound to their maker's service, so
 *   the visitor is told, once, before the first word is heard.
 *
 * Their own computer is preferred whenever it is there. Whatever was said
 * comes back as plain words on one line: speaking types, and never presses
 * Enter.
 */

/** Samples as a microphone gives them, turned into 16-bit at the rate a recogniser wants. Each new sample is the average of the old ones it covers. */
export function toPcm16(samples: Float32Array, fromRate: number, toRate = 16000): Int16Array {
  if (!(fromRate > 0) || !(toRate > 0)) return new Int16Array(0);
  const step = fromRate / toRate;
  const out = new Int16Array(step <= 1 ? samples.length : Math.floor(samples.length / step));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    let n = 0;
    const from = step <= 1 ? i : Math.floor(i * step);
    const to = step <= 1 ? i + 1 : Math.min(samples.length, Math.floor((i + 1) * step));
    for (let j = from; j < to; j++) {
      sum += samples[j]!;
      n++;
    }
    const v = Math.max(-1, Math.min(1, n ? sum / n : 0));
    out[i] = Math.round(v * 32767);
  }
  return out;
}

/** Words as they may be typed: one line, nothing hidden. */
export function cleanSpoken(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

export interface Hearing {
  /** They have finished: work out the words. */
  stop(): void;
  /** Never mind. Nothing is typed. */
  cancel(): void;
}

export interface VoiceSource {
  /** Who turns the speech into words, as the visitor is told it. */
  name: string;
  /** Whether what is said stays on the visitor's own devices. */
  private: boolean;
  hear(o: { lang: string; onText(text: string): void; onEnd(why: string | null): void }): Hearing;
}

const MIC_REFUSED = "The microphone isn't allowed here.";

/** Record from the microphone until told to stop. What comes back is ready for a recogniser. */
export async function recordVoice(maxSeconds = 90): Promise<{ stop(): Promise<Int16Array>; cancel(): void }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  // The old way to read samples. It needs no file of its own, which a page's security rules would have to allow.
  const reader = ctx.createScriptProcessor(4096, 1, 1);
  const quiet = ctx.createGain();
  quiet.gain.value = 0;
  const chunks: Float32Array[] = [];
  let length = 0;
  const most = maxSeconds * ctx.sampleRate;
  reader.onaudioprocess = (e) => {
    if (length >= most) return;
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    length += data.length;
  };
  source.connect(reader);
  reader.connect(quiet);
  quiet.connect(ctx.destination);
  const end = () => {
    reader.onaudioprocess = null;
    source.disconnect();
    reader.disconnect();
    for (const track of stream.getTracks()) track.stop();
    void ctx.close();
  };
  return {
    async stop() {
      const rate = ctx.sampleRate;
      end();
      const all = new Float32Array(length);
      let at = 0;
      for (const c of chunks) {
        all.set(c.subarray(0, Math.min(c.length, length - at)), at);
        at += c.length;
      }
      return toPcm16(all, rate);
    },
    cancel: end,
  };
}

/** The visitor's own computer, through a connection that will turn sound into words. */
export function computerVoice(name: string, transcribe: (pcm: Int16Array, lang: string) => Promise<string>): VoiceSource {
  return {
    name,
    private: true,
    hear(o) {
      let recording: Awaited<ReturnType<typeof recordVoice>> | null = null;
      let over = false;
      const started = recordVoice().then(
        (r) => {
          if (over) r.cancel();
          else recording = r;
        },
        () => {
          over = true;
          o.onEnd(MIC_REFUSED);
        },
      );
      return {
        stop() {
          if (over) return;
          over = true;
          void started.then(async () => {
            if (!recording) return;
            try {
              const text = cleanSpoken(await transcribe(await recording.stop(), o.lang));
              if (text) o.onText(text);
              o.onEnd(text ? null : "Nothing was heard.");
            } catch (e) {
              o.onEnd(e instanceof Error && e.message ? e.message : "Your computer couldn't make that out.");
            }
          });
        },
        cancel() {
          if (over) return;
          over = true;
          void started.then(() => recording?.cancel());
          o.onEnd(null);
        },
      };
    },
  };
}

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionClass = { new (): Recognition; available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string> };

const SORRY: Record<string, string> = {
  "not-allowed": MIC_REFUSED,
  "service-not-allowed": "This browser won't turn speech into text here.",
  network: "This browser couldn't reach the service it uses to turn speech into text.",
  "no-speech": "Nothing was heard.",
  "audio-capture": "No microphone was found.",
  "language-not-supported": "This browser can't turn that language into text.",
};

/**
 * The browser's own speech recognition, or null where it has none. It is
 * `private` only where the browser says it can do the work on the device, and
 * is then told it must.
 */
export async function browserVoice(lang: string, scope: unknown = globalThis): Promise<VoiceSource | null> {
  const w = scope as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Recognition) return null;
  let local = false;
  try {
    local = (await Recognition.available?.({ langs: [lang], processLocally: true })) === "available";
  } catch {
    /* a browser that can't say is one that sends it away */
  }
  return {
    name: local ? "this browser, on this device" : "this browser",
    private: local,
    hear(o) {
      const rec = new Recognition();
      rec.lang = o.lang;
      rec.continuous = true;
      rec.interimResults = false;
      if (local) rec.processLocally = true;
      let text = "";
      let why: string | null = null;
      let dropped = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) text += `${e.results[i]![0]!.transcript} `;
      };
      rec.onerror = (e) => {
        if (e.error !== "aborted") why = SORRY[e.error] ?? "This browser couldn't turn that into text.";
      };
      rec.onend = () => {
        const said = dropped ? "" : cleanSpoken(text);
        if (said) o.onText(said);
        o.onEnd(dropped ? null : (why ?? (said ? null : "Nothing was heard.")));
      };
      try {
        rec.start();
      } catch {
        o.onEnd("This browser couldn't start listening.");
      }
      return {
        stop: () => rec.stop(),
        cancel() {
          dropped = true;
          rec.abort();
        },
      };
    },
  };
}

export type VoiceState = "idle" | "asking" | "listening" | "working";

export interface Voice {
  /** Offer another way to turn speech into words. Returns how to take it back. */
  add(source: VoiceSource): () => void;
  /** The one that would be used now: the visitor's own devices first. Null when there is none. */
  readonly source: VoiceSource | null;
  readonly state: VoiceState;
  /**
   * The one button: start listening, or finish. `onText` gets the words;
   * `say` gets a line to show the visitor about what is happening. The first
   * time a source that sends sound away would be used, it asks, and a second
   * press goes ahead.
   */
  toggle(o: { onText(text: string): void; say(message: string): void }): void;
  cancel(): void;
  /** Be told when the state or the sources change. Returns how to stop being told. */
  subscribe(fn: () => void): () => void;
}

const AGREED = "nswp:speech-may-leave";

export function createVoice(o: { lang?: string; storage?: Pick<Storage, "getItem" | "setItem"> | null; browser?: Promise<VoiceSource | null> } = {}): Voice {
  const lang = o.lang ?? (typeof navigator === "undefined" ? "en" : navigator.language || "en");
  const sources: VoiceSource[] = [];
  const heard = new Set<() => void>();
  let state: VoiceState = "idle";
  let hearing: Hearing | null = null;
  let askedAt = 0;
  let storage: Pick<Storage, "getItem" | "setItem"> | null = null;
  try {
    storage = o.storage === undefined ? localStorage : o.storage;
  } catch {
    /* asked every time, then */
  }
  const tell = () => heard.forEach((fn) => fn());
  const set = (next: VoiceState) => {
    state = next;
    tell();
  };
  const pick = () => sources.find((s) => s.private) ?? sources[0] ?? null;
  const add = (source: VoiceSource) => {
    sources.push(source);
    tell();
    return () => {
      const at = sources.indexOf(source);
      if (at >= 0) sources.splice(at, 1);
      tell();
    };
  };
  void (o.browser ?? browserVoice(lang)).then((b) => b && add(b));

  return {
    add,
    get source() {
      return pick();
    },
    get state() {
      return state;
    },
    toggle({ onText, say }) {
      if (state === "listening") {
        set("working");
        say("Working out what you said…");
        return hearing?.stop();
      }
      if (state === "working") return;
      const source = pick();
      if (!source) return say("Nothing here can turn speech into text.");
      if (!source.private) {
        let agreed = false;
        try {
          agreed = storage?.getItem(AGREED) === "yes";
        } catch {
          /* ask */
        }
        // Said once, before a word is heard. A second press within a little while is the yes.
        if (!agreed && !(state === "asking" && Date.now() - askedAt < 20_000)) {
          askedAt = Date.now();
          set("asking");
          return say("Your browser turns speech into text itself, and may send your voice to its maker to do it. Press again to go ahead.");
        }
        try {
          storage?.setItem(AGREED, "yes");
        } catch {
          /* asked again next time */
        }
      }
      set("listening");
      say(`Listening, with ${source.name}. Press again when you have finished.`);
      hearing = source.hear({
        lang,
        onText,
        onEnd(why) {
          hearing = null;
          set("idle");
          say(why ?? "");
        },
      });
    },
    cancel() {
      const was = hearing;
      hearing = null;
      was?.cancel();
      if (state !== "idle") set("idle");
    },
    subscribe(fn) {
      heard.add(fn);
      return () => heard.delete(fn);
    },
  };
}

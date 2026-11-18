/**
 * Turning speech into text, on this computer.
 *
 * What a microphone in the owner's home heard arrives over the same sealed
 * connection the terminal uses. It is written to a file only this user can
 * read, handed to a program on this computer, and deleted. It goes nowhere
 * else: no service is called by anything here.
 *
 * Two ways to listen. `whisperEars` keeps OpenAI's Whisper (the program many
 * people already have, `pip install openai-whisper`) loaded, so each thing
 * said takes a moment and not a model's start-up. `commandEars` runs any
 * command of the owner's choosing once per thing said.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type Transcribe = (pcm: Buffer, o: { rate: number; lang: string }) => Promise<string>;

/** Sixteen-bit, one-channel samples as a WAV file, which every such program reads. */
export function wav(pcm: Buffer, rate: number): Buffer {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // plain samples
  head.writeUInt16LE(1, 22); // one channel
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** Keep what was said in a file for as long as `use` needs it, and not a moment longer. */
async function withFile<T>(pcm: Buffer, rate: number, use: (path: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "nswp-bridge-voice-")); // made for this user only
  const path = join(dir, "said.wav");
  try {
    writeFileSync(path, wav(pcm, rate), { mode: 0o600 });
    return await use(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Any command: it is given the file's path as its last word, and what it prints is the text. */
export function commandEars(command: string, timeoutMs = 120_000): Transcribe {
  return (pcm, o) =>
    withFile(
      pcm,
      o.rate,
      (path) =>
        new Promise<string>((resolve, reject) => {
          const child = spawn("/bin/sh", ["-c", `${command} "$0"`, path], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, NSWP_VOICE_LANG: o.lang } });
          let out = "";
          const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
          child.stdout.on("data", (d: Buffer) => (out += d.toString()).length > 100_000 && child.kill("SIGKILL"));
          child.on("error", reject);
          child.on("exit", (code) => {
            clearTimeout(timer);
            if (code === 0) resolve(out);
            else reject(new Error(`the command ended with ${code}`));
          });
        }),
    );
}

const HELPER = String.raw`
import json, sys, wave

def say(what):
    print(json.dumps(what), flush=True)

try:
    import numpy as np
    import whisper
except Exception as e:
    say({"error": "Whisper isn't installed for this Python: %s" % e})
    sys.exit(3)

name = sys.argv[1]
try:
    model = whisper.load_model(name)
except Exception as e:
    say({"error": "The model %s couldn't be loaded: %s" % (name, e)})
    sys.exit(4)
say({"ready": True})

for line in sys.stdin:
    path, _, lang = line.rstrip("\n").partition("\t")
    try:
        with wave.open(path, "rb") as w:
            audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        # A model that knows only English is told nothing else.
        lang = "en" if name.endswith(".en") else (lang.split("-")[0].lower() or None)
        # One pass. Whisper's way of trying again, hotter, when it is unsure makes someone wait many times as long
        # for a few words, and they are reading the result before they press Enter anyway.
        result = model.transcribe(audio, fp16=False, language=lang, condition_on_previous_text=False, temperature=0.0, without_timestamps=True)
        say({"text": result.get("text", "")})
    except Exception as e:
        say({"error": str(e)})
`;

export interface Ears {
  transcribe: Transcribe;
  /** Settles when the model is loaded. Rejects, with words for the owner, if it can't be. */
  ready: Promise<void>;
  close(): void;
}

/** Whisper, kept loaded. The first time a model is used, Whisper itself downloads it; it says so on this screen. */
export function whisperEars(o: { model: string; python?: string }): Ears {
  // Not -I here: Whisper is usually installed for the user, and -I would hide it.
  const child = spawn(o.python ?? "python3", ["-c", HELPER, o.model], { stdio: ["pipe", "pipe", "inherit"] });
  const waiting: { resolve(text: string): void; reject(e: Error): void }[] = [];
  let ended: Error | null = null;
  let isReady: () => void = () => undefined;
  let notReady: (e: Error) => void = () => undefined;
  const ready = new Promise<void>((resolve, reject) => {
    isReady = resolve;
    notReady = reject;
  });
  ready.catch(() => undefined); // heard by whoever asked for it
  createInterface({ input: child.stdout }).on("line", (line) => {
    let said: { ready?: boolean; text?: string; error?: string };
    try {
      said = JSON.parse(line) as typeof said;
    } catch {
      return; // a library talking to itself
    }
    if (said.ready) return isReady();
    const next = waiting.shift();
    if (said.error && !next) return notReady(new Error(said.error));
    if (typeof said.text === "string") next?.resolve(said.text);
    else next?.reject(new Error(said.error ?? "nothing came back"));
  });
  const end = (why: string) => {
    ended = new Error(why);
    notReady(ended);
    for (const w of waiting.splice(0)) w.reject(ended);
  };
  child.on("error", () => end("Python couldn't be started."));
  child.on("exit", () => end("The program that listens has stopped."));
  child.stdin.on("error", () => undefined);
  return {
    ready,
    transcribe: (pcm, opts) =>
      withFile(
        pcm,
        opts.rate,
        (path) =>
          new Promise<string>((resolve, reject) => {
            if (ended) return reject(ended);
            waiting.push({ resolve, reject });
            child.stdin.write(`${path}\t${opts.lang}\n`);
          }),
      ),
    close: () => void child.kill(),
  };
}

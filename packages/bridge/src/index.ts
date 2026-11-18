#!/usr/bin/env node
/**
 * nswp-bridge: a terminal on this computer, opened from your home.
 * See browser/bridge.md for what it trusts and how it connects.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";
import { DEFAULT_RELAYS, decodeNpub, encodeNpub, getPublicKey } from "@nswp/core";
import { createBridge } from "./bridge.js";
import { commandEars, whisperEars, type Ears, type Transcribe } from "./ears.js";

export { createBridge, type Bridge, type BridgeOptions, type AskAbout } from "./bridge.js";

const HELP = `nswp-bridge: a terminal on this computer, opened from your home.

  nswp-bridge --owner <npub>        the one key it answers (kept after the first run)

  --command "<program>"   run this instead of your shell, for example "claude"
  --cwd <folder>          start there instead of your home folder
  --tmux                  lasting terminals that outlive the connection (needs tmux)
  --voice                 turn what you say in your home into text, here, with Whisper
  --voice-model <name>    which Whisper model: base.en unless told (tiny.en is quicker)
  --transcribe "<cmd>"    or with any command: it is given a .wav file, and prints the words
  --allow-for <minutes>   after you say yes once, don't ask again for this long
  --relays <a,b,c>        where to be found (default: the four NSWP uses)
  --home <address>        your home, for the pairing link
  --dir <folder>          where its key and settings are kept (default ~/.config/nswp)

It asks here, on this screen, before every session unless told --allow-for.
Whoever can open a terminal can do anything you can. Read browser/bridge.md.`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parse(argv: string[]) {
  const o: Record<string, string | boolean> = {};
  const takes = new Set(["owner", "command", "cwd", "allow-for", "relays", "home", "dir", "voice-model", "transcribe"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) fail(`Unexpected "${a}".\n\n${HELP}`);
    const name = a.slice(2);
    if (name === "help" || name === "tmux" || name === "voice") o[name] = true;
    else if (takes.has(name)) {
      const value = argv[++i];
      if (value === undefined) fail(`--${name} needs a value.`);
      o[name] = value;
    } else fail(`Unknown option ${a}.\n\n${HELP}`);
  }
  return o;
}

const stamp = () => new Date().toTimeString().slice(0, 5);

function main() {
  const args = parse(process.argv.slice(2));
  if (args.help) return console.log(HELP);

  // Read what was asked before anything is made: a mistyped command leaves nothing behind.
  let asked: string | undefined;
  if (typeof args.owner === "string") {
    try {
      asked = decodeNpub(args.owner);
    } catch {
      // The commonest mistake is running an example as it was written.
      fail(/…|\.\.\.|<|>/.test(args.owner) ? `"${args.owner}" is the example. Put your own public key in its place: the whole of it, starting npub1 and 63 characters long.` : `--owner isn't a public key. One starts npub1 and is 63 characters long, or is 64 hex characters.`);
    }
  }

  const dir = typeof args.dir === "string" ? args.dir : process.env.NSWP_BRIDGE_DIR ?? join(homedir(), ".config", "nswp");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const keyFile = join(dir, "bridge.key");
  const settingsFile = join(dir, "bridge.json");

  // Its own key: made once, readable by this user only, never sent anywhere.
  if (!existsSync(keyFile)) writeFileSync(keyFile, `${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
  chmodSync(keyFile, 0o600);
  const hex = readFileSync(keyFile, "utf8").trim();
  if (!/^[0-9a-f]{64}$/.test(hex)) fail(`${keyFile} isn't a key. Move it away and run this again to make a new one.`);
  const key = Uint8Array.from(Buffer.from(hex, "hex"));

  let kept: { owner?: string } = {};
  try {
    kept = JSON.parse(readFileSync(settingsFile, "utf8")) as { owner?: string };
  } catch {
    /* first run */
  }
  let owner = typeof kept.owner === "string" && /^[0-9a-f]{64}$/.test(kept.owner) ? kept.owner : undefined;
  if (asked !== undefined) {
    // Changing whose computer this is must be something a person does on purpose.
    if (owner && owner !== asked) fail(`This computer already answers ${encodeNpub(owner)}.\nTo give it to another key, delete ${settingsFile} and run this again.`);
    owner = asked;
    writeFileSync(settingsFile, `${JSON.stringify({ owner }, null, 2)}\n`, { mode: 0o600 });
  }
  if (!owner) fail(`Say whose computer this is: nswp-bridge --owner npub1…\n\n${HELP}`);
  if (owner === getPublicKey(key)) fail("The owner's key and this computer's key can't be the same.");

  const allowFor = typeof args["allow-for"] === "string" ? Number(args["allow-for"]) : 0;
  if (!Number.isFinite(allowFor) || allowFor < 0 || allowFor > 24 * 60) fail("--allow-for is a number of minutes, at most 1440.");
  const plain = typeof args.command === "string" ? ["/bin/sh", "-c", args.command] : [process.env.SHELL || "/bin/sh", "-l"];
  // With tmux each of the few terminals is a lasting one of its own, found again by its number.
  const command = args.tmux ? (slot: number) => ["tmux", "new-session", "-A", "-s", `nswp-bridge-${slot}`] : plain;
  const cwd = typeof args.cwd === "string" ? args.cwd : homedir();
  if (!existsSync(cwd)) fail(`There is no folder ${cwd}.`);
  const relays = typeof args.relays === "string" ? args.relays.split(",").map((r) => r.trim()).filter(Boolean) : DEFAULT_RELAYS;
  if (!relays.length || relays.some((r) => !/^wss?:\/\//.test(r))) fail("--relays is a list of wss:// addresses, separated by commas.");
  const home = typeof args.home === "string" ? args.home : "https://portal.bitblocks.network/walk/";

  // Speech becomes text on this computer, or not at all.
  const model = typeof args["voice-model"] === "string" ? args["voice-model"] : "base.en";
  if (!/^[a-zA-Z0-9._-]{1,40}$/.test(model)) fail("--voice-model is a Whisper model's name, like base.en or small.");
  let ears: Ears | null = null;
  let transcribe: Transcribe | undefined;
  if (typeof args.transcribe === "string") transcribe = commandEars(args.transcribe);
  else if (args.voice) {
    ears = whisperEars({ model });
    transcribe = ears.transcribe;
    ears.ready.then(
      () => console.log(`[${stamp()}] Voice is ready: Whisper (${model}), on this computer.`),
      (e: Error) => console.log(`[${stamp()}] Voice is off. ${e.message}`),
    );
  }

  // Answers are typed here. Nothing a page sends can reach this.
  const lines = createInterface({ input: process.stdin });
  let waiting: ((yes: boolean) => void) | null = null;
  let nobody = false;
  lines.on("line", (line) => {
    const answer = waiting;
    waiting = null;
    answer?.(/^y(es)?$/i.test(line.trim()));
  });
  lines.on("close", () => {
    nobody = true;
    waiting?.(false);
    waiting = null;
  });

  // Whether a home can find this computer at all is worth saying, once it is known and whenever it stops or starts being true.
  let reached = -1;
  let settled = false;
  const sayRelays = () => {
    const n = bridge.state().relays;
    if (n === reached) return;
    const was = reached;
    reached = n;
    if (n === 0) console.log(`[${stamp()}] No relay can be reached. Your home can't find this computer until one can. It keeps trying.`);
    else if (was <= 0) console.log(`[${stamp()}] Listening on ${n} of ${relays.length} relays. Your home can find this computer.`);
  };
  setTimeout(() => {
    settled = true;
    sayRelays();
  }, 4000).unref();

  const bridge = createBridge({
    key,
    owner,
    relays,
    onRelays: () => settled && sayRelays(),
    command,
    cwd,
    allowForSec: allowFor * 60,
    ...(transcribe ? { transcribe } : {}),
    log: (line) => console.log(`[${stamp()}] ${line}`),
    ask({ code, open, replaces }) {
      if (nobody) {
        console.log(`[${stamp()}] A terminal was asked for, and there is nobody here to ask. Run this in a terminal of its own.`);
        return Promise.resolve(false);
      }
      waiting?.(false);
      process.stdout.write(`\u0007\n[${stamp()}] Your home is asking to open a terminal on this computer.\n        The code is ${code}. It should be the one showing in your home.\n${replaces ? `        ${open} terminals are open, which is as many as there may be. Saying yes closes the one that has been quiet longest.\n` : open ? `        ${open === 1 ? "One terminal is" : `${open} terminals are`} open already. This would be another.\n` : ""}        Open it? Type y and press Enter. Anything else says no: `);
      return new Promise((resolve) => {
        waiting = resolve;
      });
    },
  });

  const me = encodeNpub(bridge.pubkey);
  console.log(`NSWP Bridge 0.1

  This computer   ${me}
  Answers only    ${encodeNpub(owner)}
  A terminal runs ${args.tmux ? "tmux (lasting terminals: nswp-bridge-1, -2, …)" : typeof args.command === "string" ? args.command : plain[0]}
  Starting in     ${cwd}
  Voice           ${typeof args.transcribe === "string" ? "heard by your own command, on this computer" : args.voice ? `Whisper (${model}), on this computer. It is loading` : "off (--voice turns it on)"}
  ${allowFor ? `After you say yes once, it opens without asking for ${allowFor} minutes.` : "It asks here before every session."}

To add this computer to your home, open this while signed in as that key:

  ${home}#bridge=${me}${typeof args.relays === "string" ? relays.map((r) => `&relay=${encodeURIComponent(r)}`).join("") : ""}

Whoever can open a terminal here can do anything you can. Ctrl-C stops it.
`);
  bridge.start();

  const stop = () => {
    console.log(`\n[${stamp()}] Stopping.`);
    ears?.close();
    void bridge.stop().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

// Run as a program, not when a test brings in createBridge.
if (process.argv[1] && /nswp-bridge(\.mjs)?$|bridge[\\/]src[\\/]index\.ts$/.test(process.argv[1])) main();

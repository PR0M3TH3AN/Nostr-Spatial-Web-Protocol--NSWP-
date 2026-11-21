// What every trial here shares: where this repository is, and this machine's address on its own network, which is
// where the local sites are served (scripts/serve-local.mjs --lan --https). Nothing in a trial names a machine.
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The repository's own folder. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** This machine's address on its network: LOCAL_HOST if given, else the first one that isn't the machine itself. */
export const HOST =
  process.env.LOCAL_HOST ??
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === "IPv4" && !i.internal)?.address ??
  "127.0.0.1";
/** Where screenshots go: a folder git doesn't keep. */
export const SHOTS = process.env.SHOTS ?? join(ROOT, ".shots");

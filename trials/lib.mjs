// What every trial here shares: where this repository is, and this machine's address on its own network, which is
// where the local sites are served (scripts/serve-local.mjs --lan --https). Nothing in a trial names a machine.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { anyAddress, lanAddress } from "../scripts/lan-address.mjs";

/** The repository's own folder. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/**
 * This machine's address on its network: LOCAL_HOST if given, else the one the local sites are served at, chosen the
 * same way (scripts/lan-address.mjs: a private address, never a VPN's).
 */
export const HOST = process.env.LOCAL_HOST ?? lanAddress() ?? anyAddress() ?? "127.0.0.1";
/** Where screenshots go: a folder git doesn't keep. */
export const SHOTS = process.env.SHOTS ?? join(ROOT, ".shots");

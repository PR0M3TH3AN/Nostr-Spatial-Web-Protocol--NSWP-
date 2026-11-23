// This machine's address on its own network: the one address the local sites are served at
// (scripts/serve-local.mjs --lan --https) and the trials look at them by (trials/lib.mjs).
//
// A machine has several addresses, and the first one it lists is not always the network's. On 2026-11-23 the first
// was a VPN's (Tailscale's 100.121.92.77, up before the Wi-Fi at boot): the sites redirected to an address the
// certificate doesn't cover and no other device on the network can reach. So an address is chosen, not taken:
//
// - only a private one (192.168/16, 10/8, 172.16/12): what a home or office network gives out;
// - never one that is the only address of its network (a /32: a VPN's own end, such as WireGuard's);
// - never one on an interface that is a VPN's or a machine-in-a-machine's by its name (tailscale, wg, tun, tap,
//   docker, a bridge, a virtual machine's network);
// - of what is left, 192.168 before 10 before 172.16, and otherwise the order the machine gives.
//
// At start the network may not be up yet, so `waitForLanAddress` asks again for a while before giving up.
import { networkInterfaces } from "node:os";

const RANGES = [/^192\.168\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./];
/** An interface that is never the network other devices are on, by its name. */
const NOT_THE_NETWORK = /^(lo|tailscale|ts|wg|tun|tap|utun|zt|docker|br-|virbr|veth|vmnet|vboxnet|vEthernet|podman|cni|flannel|lxc|lxd)/i;
const onlyOne = (i) => i.netmask === "255.255.255.255" || /\/32$/.test(i.cidr ?? "");

/**
 * The address to serve at, from what the machine says of its interfaces (`os.networkInterfaces()`), or null where
 * it has none on a network of its own yet.
 */
export function lanAddress(interfaces = networkInterfaces()) {
  const found = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (NOT_THE_NETWORK.test(name)) continue;
    for (const i of list ?? []) {
      if (!i || i.internal || (i.family !== "IPv4" && i.family !== 4) || onlyOne(i)) continue;
      const rank = RANGES.findIndex((r) => r.test(i.address));
      if (rank >= 0) found.push({ rank, address: i.address });
    }
  }
  // A stable sort: the order the machine gave is kept among addresses of the same kind.
  return found.sort((a, b) => a.rank - b.rank)[0]?.address ?? null;
}

/** What was done before this: the first address that isn't the machine's own, whatever it is. Null where there is none. */
export function anyAddress(interfaces = networkInterfaces()) {
  return (
    Object.values(interfaces)
      .flat()
      .find((i) => i && (i.family === "IPv4" || i.family === 4) && !i.internal)?.address ?? null
  );
}

/**
 * The network address, asked for again every `everyMs` for up to `waitMs` while there is none (a machine starting
 * up brings its VPN up before its Wi-Fi). Then whatever address there is, with `fellBack` true so the caller can
 * say so; or null with none at all.
 */
export async function waitForLanAddress({ waitMs = 30_000, everyMs = 500, read = networkInterfaces, sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)) } = {}) {
  for (let waited = 0; ; waited += everyMs) {
    const address = lanAddress(read());
    if (address) return { address, fellBack: false };
    if (waited >= waitMs) break;
    await sleep(everyMs);
  }
  return { address: anyAddress(read()), fellBack: true };
}

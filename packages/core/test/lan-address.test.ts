import { describe, expect, it } from "vitest";
// @ts-expect-error a plain script, with no types of its own
import { anyAddress, lanAddress, waitForLanAddress } from "../../../scripts/lan-address.mjs";

/**
 * Which address the local sites are served at (scripts/lan-address.mjs). On 2026-11-23 the first address this
 * machine listed at boot was a VPN's, and the sites redirected to one the certificate doesn't cover. These are that
 * machine's own interfaces, in the orders it can list them in.
 */
const v4 = (address: string, netmask: string, cidr: string) => ({ address, netmask, family: "IPv4", internal: false, cidr });
const lo = { lo: [{ address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", internal: true, cidr: "127.0.0.1/8" }] };
const tailscale = { tailscale0: [v4("100.121.92.77", "255.255.255.255", "100.121.92.77/32")] };
const mullvad = { "wg0-mullvad": [v4("10.143.230.235", "255.255.255.255", "10.143.230.235/32")] };
const wifi = { wlp170s0: [v4("192.168.68.84", "255.255.252.0", "192.168.68.84/22"), { address: "fe80::1", netmask: "ffff:ffff:ffff:ffff::", family: "IPv6", internal: false, cidr: "fe80::1/64" }] };
const virtual = { virbr0: [v4("192.168.122.1", "255.255.255.0", "192.168.122.1/24")], docker0: [v4("172.17.0.1", "255.255.0.0", "172.17.0.1/16")] };

describe("this machine's address on its own network", () => {
  it("is the Wi-Fi's, wherever the VPNs and the virtual networks come in the list", () => {
    expect(lanAddress({ ...lo, ...tailscale, ...mullvad, ...virtual, ...wifi })).toBe("192.168.68.84");
    expect(lanAddress({ ...lo, ...wifi, ...virtual, ...tailscale, ...mullvad })).toBe("192.168.68.84");
    // What was done before would have taken Tailscale's.
    expect(anyAddress({ ...lo, ...tailscale, ...wifi })).toBe("100.121.92.77");
  });

  it("is never a VPN's own end, a virtual machine's network or a container's, even when that is all there is", () => {
    expect(lanAddress({ ...lo, ...tailscale, ...mullvad, ...virtual })).toBeNull();
    // A VPN's /32 isn't taken whatever its interface is called.
    expect(lanAddress({ ...lo, nordlynx: [v4("10.5.0.2", "255.255.255.255", "10.5.0.2/32")] })).toBeNull();
    expect(lanAddress({ ...lo })).toBeNull();
    expect(lanAddress({})).toBeNull();
  });

  it("takes a wire's address too, and 192.168 before 10 before 172.16", () => {
    expect(lanAddress({ ...lo, eth0: [v4("10.0.0.7", "255.255.255.0", "10.0.0.7/24")] })).toBe("10.0.0.7");
    expect(lanAddress({ ...lo, eth1: [v4("172.20.1.4", "255.255.0.0", "172.20.1.4/16")], eth0: [v4("10.0.0.7", "255.255.255.0", "10.0.0.7/24")], wlan0: [v4("192.168.1.20", "255.255.255.0", "192.168.1.20/24")] })).toBe("192.168.1.20");
    // An address that isn't private (a public one, a carrier's) is never taken.
    expect(lanAddress({ ...lo, eth0: [v4("203.0.113.9", "255.255.255.0", "203.0.113.9/24")] })).toBeNull();
  });

  it("waits at start for the network to come up, and only then falls back, saying so", async () => {
    // The VPN is up first; the Wi-Fi comes up on the third look.
    let looks = 0;
    const slept: number[] = [];
    const early = await waitForLanAddress({ waitMs: 5000, everyMs: 500, read: () => (++looks < 3 ? { ...lo, ...tailscale } : { ...lo, ...tailscale, ...wifi }), sleep: async (ms: number) => void slept.push(ms) });
    expect(early).toEqual({ address: "192.168.68.84", fellBack: false });
    expect(slept).toEqual([500, 500]);
    // It never comes: after the wait, whatever there is, marked as a fallback.
    const never = await waitForLanAddress({ waitMs: 1000, everyMs: 500, read: () => ({ ...lo, ...tailscale }), sleep: async () => {} });
    expect(never).toEqual({ address: "100.121.92.77", fellBack: true });
    expect(await waitForLanAddress({ waitMs: 0, read: () => ({ ...lo }), sleep: async () => {} })).toEqual({ address: null, fellBack: true });
  });
});

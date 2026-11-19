/**
 * The reference Airlock (spec §6.2–§6.5). A static page: the destination
 * arrives in the fragment, nothing is sent to a server we run, and the user
 * confirms before leaving. Phase 0 offers anonymous entry only; sign-in comes
 * with BitLogin in Phase 2.
 */
import {
  buildArrivalUrl,
  checkDestination,
  DEFAULT_RELAYS,
  fetchManifest,
  fromLocal,
  latestAddressable,
  parseAirlockFragment,
  parseWorldEvent,
  queryRelays,
  toLocal,
  verifyOrigin,
  WORLD_KIND,
  type Issue,
  type Manifest,
  type Verification,
  type World,
} from "@nswp/core";

import sites from "../../sites.json";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SELF = `${location.origin}${location.pathname}`;
const REFERENCE_ORIGINS = new Set(Object.values(sites.worlds).map((w) => new URL(w.url).origin));

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function readJson<T>(key: string, fallback: T): T {
  try {
    const v = store()?.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: features degrade, page still works */
  }
}

const PINS = "nswp:publisher-pins"; // origin -> verified publisher pubkey (spec §7.3)
const APPROVED = "nswp:approved"; // "origin|pubkey|d" -> true (spec §6.5 fast path)

function el(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...children);
  return e;
}

function chip(text: string, kind: "ok" | "warn" | "bad" | "plain" = "plain"): HTMLElement {
  return el("span", { class: `chip ${kind}` }, text);
}

function issueList(issues: Issue[], kind: "warn" | "bad"): HTMLElement {
  return el("ul", { class: `issues ${kind}` }, ...issues.map((i) => el("li", {}, i.message)));
}

interface Assessment {
  url: string;
  origin: string;
  hostPrefix: string;
  domain: string;
  world: World | null;
  manifest: Manifest | null;
  verification: Verification | null;
  warnings: Issue[];
  blockers: Issue[];
  relayStatus: Record<string, string>;
  publisherChanged: boolean;
}

async function assess(): Promise<Assessment | { fatal: Issue }> {
  const req = parseAirlockFragment(location.hash);
  if (!req) return { fatal: { code: "no_destination", path: "", message: "" } };
  const warnings: Issue[] = [];
  let world: World | null = null;
  let relayStatus: Record<string, string> = {};

  // 1. Resolve the world announcement, if the portal named one.
  if (req.to.startsWith("naddr1") && !req.naddr) return { fatal: { code: "naddr_invalid", path: "to", message: "The portal's world reference is malformed." } };
  if (req.naddr) {
    const relays = [...new Set([...(req.naddr.relays ?? []), ...DEFAULT_RELAYS])].slice(0, 5);
    const res = await queryRelays(relays, { kinds: [WORLD_KIND], authors: [req.naddr.pubkey], "#d": [req.naddr.identifier] });
    relayStatus = res.relays;
    const latest = latestAddressable(res.events)[0];
    if (latest) {
      const parsed = parseWorldEvent(latest);
      if (parsed.ok) {
        world = parsed.value;
        warnings.push(...parsed.warnings);
      } else warnings.push({ code: "announcement_invalid", path: "", message: "The world's announcement is invalid, so it is treated as unlisted." });
    } else warnings.push({ code: "announcement_not_found", path: "", message: "This world's announcement wasn't found on your relays, so it can't be verified." });
  }

  // 2. Decide the URL. The announcement wins; a differing portal URL is a warning.
  const url = world?.url ?? req.url;
  if (!url) return { fatal: { code: "destination_unresolved", path: "", message: "The world couldn't be found and the portal gave no URL." } };
  if (world && req.url && checkDestination(req.url).ok && new URL(req.url).href !== new URL(world.url).href) {
    warnings.push({ code: "portal_url_mismatch", path: "", message: "The portal's URL differs from the world's announcement. The announcement's URL is used." });
  }
  const dest = checkDestination(url);
  if (!dest.ok) return { fatal: dest.error };
  warnings.push(...dest.warnings);

  // 3. The origin's manifest decides verification (spec §7.3).
  const m = await fetchManifest(dest.value.url);
  let verification: Verification | null = null;
  if (m.manifest && world) verification = verifyOrigin(world, m.manifest, m.url);
  if (!m.manifest) warnings.push({ code: "no_manifest", path: "", message: "This site has no readable NSWP manifest, so no publisher can be verified for it." });
  if (!world) warnings.push({ code: "unlisted", path: "", message: "This destination isn't a listed world. Check the address carefully." });

  // 4. Publisher pinning: warn if the verified publisher for this origin changed.
  const pins = readJson<Record<string, string>>(PINS, {});
  let publisherChanged = false;
  if (verification?.verified && world?.pubkey) {
    const pinned = pins[dest.value.origin];
    if (pinned && pinned !== world.pubkey) {
      publisherChanged = true;
      warnings.push({
        code: "publisher_changed",
        path: "",
        message: "The verified publisher for this site has changed since your last visit. A lapsed domain bought by someone else looks exactly like this.",
      });
    }
  }

  return {
    url: dest.value.url,
    origin: dest.value.origin,
    hostPrefix: dest.value.hostPrefix,
    domain: dest.value.registrableDomain ?? dest.value.hostname,
    world,
    manifest: m.manifest ?? null,
    verification,
    warnings,
    blockers: [],
    relayStatus,
    publisherChanged,
  };
}

function entryFromFragment(): string | undefined {
  return parseAirlockFragment(location.hash)?.entryPoint;
}

async function render(): Promise<void> {
  const main = $("main");
  const req = parseAirlockFragment(location.hash);
  if (!req) {
    $("landing").hidden = false;
    $("checking").hidden = true;
    return;
  }
  $("landing").hidden = true;
  $("checking").hidden = false;
  const started = performance.now();
  const a = await assess();
  $("checking").hidden = true;
  if ("fatal" in a) {
    main.append(
      el("section", { class: "card blocked" }, el("h1", {}, "This portal is blocked"), el("p", {}, a.fatal.message), el("p", { class: "muted" }, `Reason code: ${a.fatal.code}`), backButton()),
    );
    return;
  }

  const verified = !!a.verification?.verified;
  const entry = entryFromFragment();
  const approvalKey = a.world?.pubkey ? `${a.origin}|${a.world.pubkey}|${a.world.d}` : null;
  const approved = readJson<Record<string, boolean>>(APPROVED, {});
  const fastPath = verified && !!approvalKey && approved[approvalKey] === true && !a.publisherChanged && a.warnings.length === 0;

  const host = el("p", { class: "host" }, el("span", { class: "prefix" }, a.hostPrefix), el("strong", {}, a.domain));
  const status = verified
    ? chip("Verified for this site", "ok")
    : a.world
      ? chip("Listed, not verified", "warn")
      : chip("Unlisted destination", "warn");
  const chips = el("div", { class: "chips" }, status);
  const w = a.world;
  // What kind of place this is, and whether this device can run it (spec §6.7).
  const vr = navigator.xr ? await navigator.xr.isSessionSupported("immersive-vr").catch(() => false) : false;
  if (w) {
    const kinds = [w.modes.includes("immersive-vr") && "VR", w.modes.includes("immersive-ar") && "AR", w.modes.includes("inline-3d") && "3D in your browser"].filter(Boolean);
    const kind = kinds.length > 0 ? kinds.join(", ") : w.modes.includes("2d") ? "An ordinary web page" : "";
    if (kind) chips.append(chip(kind));
    const immersiveOnly = w.modes.length > 0 && w.modes.every((m) => m === "immersive-vr" || m === "immersive-ar");
    if (immersiveOnly && !vr) chips.append(chip("Needs a VR headset", "warn"));
  }
  if (w?.comfort.intensity) chips.append(chip(`Intensity: ${w.comfort.intensity}`, w.comfort.intensity === "high" ? "warn" : "plain"));
  if (w?.comfort.locomotion) chips.append(chip(`Movement: ${w.comfort.locomotion}`));
  if (w?.comfort.seated) chips.append(chip(`Seated: ${w.comfort.seated}`));
  if (w?.perf) chips.append(chip(`Runs on: ${w.perf} and up`));
  if (w?.status && w.status !== "live") chips.append(chip(`Status: ${w.status}`, w.status === "retired" ? "bad" : "plain"));
  if (w?.contentWarning !== undefined) chips.append(chip(`Content warning${w.contentWarning ? `: ${w.contentWarning}` : ""}`, "bad"));

  const device = el("p", { class: "muted" }, vr ? "This device can enter VR. You'll press Enter VR again on arrival." : "This device can't enter VR; the world opens in your browser.");

  const card = el(
    "section",
    { class: "card" },
    el("p", { class: "eyebrow" }, "You're leaving for"),
    host,
    el("p", { class: "full-url muted" }, a.url),
    w ? el("h1", {}, w.title) : el("h1", {}, "An unlisted site"),
    w?.summary ? el("p", {}, w.summary) : "",
    chips,
    device,
  );
  if (a.warnings.length) card.append(issueList(a.warnings, "warn"));

  const identity = el(
    "fieldset",
    { class: "identity" },
    el("legend", {}, "Enter as"),
    el("label", {}, el("input", { type: "radio", name: "identity", value: "anonymous", checked: "" }), " Anonymous"),
    el("label", { class: "muted" }, el("input", { type: "radio", name: "identity", value: "main", disabled: "" }), " Your Nostr identity (sign-in arrives in Phase 2)"),
  );
  card.append(identity);

  const remember = el(
    "div",
    { class: "remember" },
    el("input", {
      type: "checkbox",
      id: "remember",
      ...(verified ? {} : { disabled: "" }),
      ...(approvalKey && approved[approvalKey] ? { checked: "" } : {}),
    }),
    el("label", { for: "remember" }, " Skip this screen next time for this world"),
  );
  if (!verified) remember.append(el("span", { class: "muted" }, " (only for verified worlds)"));
  card.append(remember);

  // Test aid for people without a headset; only the reference worlds understand ?xr=emulate.
  const isReferenceWorld = REFERENCE_ORIGINS.has(a.origin);
  if (isReferenceWorld) {
    card.append(
      el(
        "div",
        { class: "remember muted" },
        el("input", { type: "checkbox", id: "emulate" }),
        el("label", { for: "emulate" }, " Testing: emulate a headset at the destination"),
      ),
    );
  }

  const go = el("button", { class: "primary", id: "continue" }, `Continue to ${a.domain}`) as HTMLButtonElement;
  const leave = async () => {
    if (verified && approvalKey) {
      // Ticked remembers this world; unticking an earlier approval forgets it.
      const next = { ...readJson<Record<string, boolean>>(APPROVED, {}) };
      if (($("remember") as HTMLInputElement).checked) next[approvalKey] = true;
      else delete next[approvalKey];
      writeJson(APPROVED, next);
    }
    if (verified && w?.pubkey) writeJson(PINS, { ...readJson<Record<string, string>>(PINS, {}), [a.origin]: w.pubkey });
    let target = a.url;
    if (isReferenceWorld && ($("emulate") as HTMLInputElement).checked) {
      const u = new URL(target);
      u.searchParams.set("xr", "emulate");
      target = u.href;
    }
    // A visitor who left a headset session is offered the way back into one first, at the other end.
    const immersive = parseAirlockFragment(location.hash)?.immersive;
    // On a development server the visitor goes to the local copy, and this Airlock gives its real address as the way back (core, local.ts).
    const arrival = buildArrivalUrl(target, { ...(entry ? { entry } : {}), airlock: await fromLocal(SELF), ...(immersive ? { immersive: true as const } : {}) });
    location.assign(await toLocal(arrival));
  };
  go.addEventListener("click", () => void leave());
  card.append(el("div", { class: "actions" }, backButton(), go));

  const timing = el("p", { class: "muted small" }, `Checked in ${Math.round(performance.now() - started)} ms`);
  if (Object.keys(a.relayStatus).length) timing.append(` · relays: ${Object.entries(a.relayStatus).map(([r, s]) => `${r.replace("wss://", "")} ${s}`).join(", ")}`);
  card.append(timing);
  main.append(card);

  if (fastPath) {
    let n = 3;
    const bar = el("div", { class: "fast" }, el("span", { id: "countdown" }, `Continuing in ${n}…`), el("button", { id: "cancel-fast" }, "Cancel"));
    card.prepend(bar);
    const timer = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(timer);
        leave();
      } else $("countdown").textContent = `Continuing in ${n}…`;
    }, 1000);
    $("cancel-fast").addEventListener("click", () => {
      clearInterval(timer);
      bar.remove();
    });
  }
  go.focus();
}

function backButton(): HTMLElement {
  const b = el("button", {}, "Go back");
  b.addEventListener("click", () => history.back());
  return b;
}

addEventListener("hashchange", () => location.reload());
void render();

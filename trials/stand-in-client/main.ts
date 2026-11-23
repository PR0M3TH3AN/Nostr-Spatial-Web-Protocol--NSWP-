// A stand-in client: a page that keeps a world in a frame and draws the visitor's menu above it, from this checkout's
// own kit (docs/plans/the-clients-menu.md, section 15: "a page that frames a world's build and mounts the menu from
// this checkout"). It is what the kit's half of the client's menu is tried in, so that it never waits on BitPortal's
// shell. It is not a client anyone uses: it has no sign-in, no bag and no room of its own, only a way home.
//
// Bundled and served by the trial that uses it (trials/menu-client.mjs). `?home=` is where its Home goes.
import { addDeskControls, addSoundControls, chatSwitch, createSounds, deskMovingSwitch, helpWords, modelsSwitch, mountMenu, picturesSwitch, portBelow, signInRows } from "nswp-sdk/menu";
import { parseItem } from "../../packages/core/src/index.js";
import { addBagControls } from "../../packages/sdk/src/bagging.js";
import { mayHold, scriptAllowed } from "../../packages/sdk/src/play.js";
import BLASTER from "../../sites/items/dart-blaster.event.json";
import { createControls } from "nswp-sdk/ui";

const frame = document.getElementById("view") as HTMLIFrameElement;
const home = new URL(location.href).searchParams.get("home") ?? "/home.html";

// The visitor's own tabs. Display comes with the controls; the way home is this page's own.
const controls = createControls({ title: "A stand-in client" });
const below = portBelow(frame, {
  controls,
  // Until a client runs Following and Messages itself, it takes them from a world.
  also: ["following", "messages"],
  home: (left) => {
    if (left) controls.say("You are home. What was in your hand was left behind: the place you were in didn't answer.");
    frame.src = home;
  },
});
controls.add({ id: "home", section: "travel", icon: "home", label: "Home", hotbar: true, act: () => below.leave() });
// The rows that change a setting the visitor carries from world to world are the client's own, wherever they stand:
// look speed (Moving) and how wide they see (View), and the switches for people's pictures, people's own models
// (People) and what people write (Room). The world leaves these out of what it describes. The three switches are
// shown only where the world fills that tab: there is nobody's picture to see in a place with no people.
const worldFills = (tab: string) => !!below.world?.sections.some((s) => s.id === tab);
addDeskControls(controls, { presenting: () => !!below.world?.state.headset.presenting });
// Moving is a tab both fill. How they move at a desk is the client's own switch; the world moves them that way, and
// adds what it does for them (a jump) below, under its name.
controls.add(deskMovingSwitch(controls, { presenting: () => !!below.world?.state.headset.presenting }));
controls.add(
  { ...picturesSwitch(controls), hidden: () => !worldFills("people") },
  { ...modelsSwitch(controls), hidden: () => !worldFills("people") },
  { ...chatSwitch((text) => controls.say(text)), hidden: () => !worldFills("room") },
);

// Sound and Help are tabs both fill. The client's part of Sound: the volumes, the visitor's own music (chosen and
// played here, so it doesn't stop at a door), and the switch for a place's hum, shown where the world says it has
// one. This page has no music or hum of its own. The menu's own sounds (a press, the menu coming and going) are made
// here, and a world whose client has the menu doesn't make them too.
const sounds = createSounds({ theme: { music: null, hum: null } });
addSoundControls(controls, sounds, { hasHum: () => below.world?.state.hum === true });
// The client's part of Help: how to move, and how to bring these controls up. What a world says of itself comes
// after, under the world's name.
controls.addSection({ id: "help", label: "Help", icon: "help", note: helpWords("client") });

// You is the client's own. The rows for signing in to the world in the frame, and out of it, are the menu's own
// words, made from the facts the world says. A real client opens its sign-in address's panel; this one only notes
// that it was asked.
const asked: string[] = [];
controls.add(...signInRows(below, { ask: () => void asked.push("ask") }));

// The Bag is the client's own tab, drawn by the kit's own code in this page, which isn't a world. With `?bag=1`
// the visitor is someone made up whose bag holds one real item (the dart blaster, by its own signed description).
// What is in hand is the world's to say; taking something up here tells the world, and waits for it to say so.
// A thing that does things of its own is asked about here, by the kit's own rule, before it is first held (the
// second press on Hold is the visitor's yes): the Bag is this page's, so the asking is too. The world is then told
// which script they let run, and runs that one and no other unasked.
if (new URL(location.href).searchParams.get("bag")) {
  const blaster = parseItem(BLASTER as never)!;
  const has = [blaster.id];
  const askedAbout = { sha: "" };
  const refuse = async () => ({ ok: false, said: "This bag is a stand-in: it can't be changed." });
  const bagging = addBagControls(controls, {
    bag: { items: () => [...has], load: async () => [...has], canChange: () => false, add: refuse, remove: refuse, tints: () => ({}), setTints: () => {}, onChange: () => () => {} } as never,
    items: { known: (c: string) => (c === blaster.id ? blaster : null), describe: async (c: string) => (c === blaster.id ? blaster : null) } as never,
    me: () => "e".repeat(64),
    rule: () => below.world?.state.items ?? "allowed",
    place: () => below.world?.title || "this place",
    holding: () => below.world?.state.holding ?? "",
    hold: async (item, tints) => {
      if (!item) return (await below.hold("")) ? { ok: true, said: "Put away." } : { ok: false, said: "This place still has it in your hand." };
      const may = mayHold(blaster, { rule: below.world?.state.items ?? "allowed", scripts: true, asked: askedAbout });
      if (!may.ok) return may;
      const script = blaster.script?.sha256;
      return (await below.hold(item, { ...(tints ? { tints } : {}), ...(script && scriptAllowed(script) ? { script } : {}) })) ? { ok: true, said: "In your hand." } : { ok: false, said: "This place didn't take it in hand." };
    },
  });
  below.onChange(() => bagging.refresh());
}

const menu = mountMenu(below.port);
below.attach(menu);
// A client draws no menu over a page that doesn't speak the words: such a page draws its own. Before any page has
// said anything, the menu is up: it is there before the world is.
const show = () => menu.setHidden(below.origin !== "" && !below.speaks);
below.onChange(show);
show();
// Whenever a page comes into the frame it is given the keys, as a client does.
frame.addEventListener("load", () => frame.focus());

(window as unknown as { __client: unknown }).__client = { below, menu, controls, sounds, asked };

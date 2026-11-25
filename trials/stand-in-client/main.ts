// A stand-in client: a page that keeps a world in a frame and draws the visitor's menu above it, from this checkout's
// own kit (docs/plans/the-clients-menu.md, section 15: "a page that frames a world's build and mounts the menu from
// this checkout"). It is what the kit's half of the client's menu is tried in, so that it never waits on BitPortal's
// shell. It is not a client anyone uses: it has no sign-in, no bag and no room of its own, only a way home.
//
// Bundled and served by the trial that uses it (trials/menu-client.mjs). `?home=` is where its Home goes.
// Only the kit's entries, as a client with a copy of the kit would load them: never a path into the kit's own files.
// (It used to reach four things by path, and a real client then found they could not be had from an entry at all.)
import { addDeskControls, addSoundControls, askDeskMoving, chatSwitch, createSounds, currentSettings, deskMovingSwitch, helpWords, modelsSwitch, mountMenu, picturesSwitch, portBelow, signInRows } from "nswp-sdk/menu";
import { addBagControls, createItemStore, mayHold, scriptAllowed } from "nswp-sdk/bag";
import { createControls } from "nswp-sdk/ui";

const frame = document.getElementById("view") as HTMLIFrameElement;
const home = new URL(location.href).searchParams.get("home") ?? "/home.html";

// The visitor's own tabs. Display comes with the controls; the way home is this page's own.
const controls = createControls({ title: "A stand-in client" });
// The visitor's own music is chosen and played in this page, so it doesn't stop at a door. This page has no music
// or hum of its own. The menu's own sounds (a press, the menu coming and going) are made here too, and a world
// whose client has the menu doesn't make them as well.
const sounds = createSounds({ theme: { music: null, hum: null } });
const below = portBelow(frame, {
  controls,
  // A world is told when their own music starts and stops here, so that its own steps back meanwhile.
  playing: () => sounds.jukebox.playing,
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
// The one-time question, "how you move at a desk": whoever draws the console asks, and here that is this page. The
// answer is kept on this site and said to every world, so it is asked once and never again, in this world or the next.
askDeskMoving(controls, { presenting: () => !!below.world?.state.headset.presenting });
controls.add(
  { ...picturesSwitch(controls), hidden: () => !worldFills("people") },
  { ...modelsSwitch(controls), hidden: () => !worldFills("people") },
  { ...chatSwitch((text) => controls.say(text)), hidden: () => !worldFills("room") },
);

// Sound and Help are tabs both fill. The client's part of Sound: the volumes, the visitor's own music, and the
// switch for a place's hum, shown where the world says it has one.
addSoundControls(controls, sounds, { hasHum: () => below.world?.state.hum === true });
// The client's part of Help: how to move, and how to bring these controls up. What a world says of itself comes
// after, under the world's name.
controls.addSection({ id: "help", label: "Help", icon: "help", note: helpWords("client") });

// You is the client's own. The rows for signing in to the world in the frame, and out of it, are the menu's own
// words, made from the facts the world says. A real client opens its sign-in address's panel; this one only notes
// that it was asked.
const asked: string[] = [];
controls.add(...signInRows(below, { ask: () => void asked.push("ask") }));

// The Bag is the client's own tab, drawn by the kit's own code in this page, which isn't a world. With `?bag=`
// the visitor is someone made up whose bag holds one real item, by its address (the trial gives the dart
// blaster's). What the item is, is looked up by the kit's own item store, taken from `nswp-sdk/bag` like the rest:
// asked of a relay (a stand-in, named here, which the trial answers for), its description checked as really signed
// by its maker. Nothing about the item is built into this page.
// What is in hand is the world's to say; taking something up here tells the world, and waits for it to say so.
// A thing that does things of its own is asked about here, by the kit's own rule, before it is first held (the
// second press on Hold is the visitor's yes): the Bag is this page's, so the asking is too. The world is then told
// which script they let run, and runs that one and no other unasked.
const inBag = new URL(location.href).searchParams.get("bag");
if (inBag) {
  const items = createItemStore({ relays: ["wss://relay.stand-in.test"], viewer: () => null });
  const has = [inBag];
  const askedAbout = { sha: "" };
  const refuse = async () => ({ ok: false, said: "This bag is a stand-in: it can't be changed." });
  const bagging = addBagControls(controls, {
    bag: { items: () => [...has], load: async () => [...has], canChange: () => false, add: refuse, remove: refuse, start: refuse, tints: () => ({}), setTints: () => {}, onChange: () => () => {} } as never,
    items,
    me: () => "e".repeat(64),
    rule: () => below.world?.state.items ?? "allowed",
    place: () => below.world?.title || "this place",
    holding: () => below.world?.state.holding ?? "",
    hold: async (item, tints) => {
      if (!item) return (await below.hold("")) ? { ok: true, said: "Put away." } : { ok: false, said: "This place still has it in your hand." };
      const described = await items.describe(item);
      if (!described) return { ok: false, said: "That item's description couldn't be found." };
      const may = mayHold(described, { rule: below.world?.state.items ?? "allowed", scripts: true, asked: askedAbout });
      if (!may.ok) return may;
      const script = described.script?.sha256;
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

(window as unknown as { __client: unknown }).__client = { below, menu, controls, sounds, asked, settings: () => currentSettings() };

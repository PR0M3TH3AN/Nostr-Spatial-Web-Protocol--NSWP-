// A stand-in client: a page that keeps a world in a frame and draws the visitor's menu above it, from this checkout's
// own kit (docs/plans/the-clients-menu.md, section 15: "a page that frames a world's build and mounts the menu from
// this checkout"). It is what the kit's half of the client's menu is tried in, so that it never waits on BitPortal's
// shell. It is not a client anyone uses: it has no sign-in, no bag and no room of its own, only a way home.
//
// Bundled and served by the trial that uses it (trials/menu-client.mjs). `?home=` is where its Home goes.
import { addDeskControls, addSoundControls, chatSwitch, createSounds, helpWords, modelsSwitch, mountMenu, picturesSwitch, portBelow } from "nswp-sdk/menu";
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

const menu = mountMenu(below.port);
below.attach(menu);
// A client draws no menu over a page that doesn't speak the words: such a page draws its own. Before any page has
// said anything, the menu is up: it is there before the world is.
const show = () => menu.setHidden(below.origin !== "" && !below.speaks);
below.onChange(show);
show();
// Whenever a page comes into the frame it is given the keys, as a client does.
frame.addEventListener("load", () => frame.focus());

(window as unknown as { __client: unknown }).__client = { below, menu, controls, sounds };

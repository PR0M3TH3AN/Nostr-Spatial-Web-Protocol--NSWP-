// A stand-in client: a page that keeps a world in a frame and draws the visitor's menu above it, from this checkout's
// own kit (docs/plans/the-clients-menu.md, section 15: "a page that frames a world's build and mounts the menu from
// this checkout"). It is what the kit's half of the client's menu is tried in, so that it never waits on BitPortal's
// shell. It is not a client anyone uses: it has no sign-in, no bag and no room of its own, only a way home.
//
// Bundled and served by the trial that uses it (trials/menu-client.mjs). `?home=` is where its Home goes.
import { mountMenu, portBelow } from "nswp-sdk/menu";
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

const menu = mountMenu(below.port);
below.attach(menu);
// A client draws no menu over a page that doesn't speak the words: such a page draws its own. Before any page has
// said anything, the menu is up: it is there before the world is.
const show = () => menu.setHidden(below.origin !== "" && !below.speaks);
below.onChange(show);
show();
// Whenever a page comes into the frame it is given the keys, as a client does.
frame.addEventListener("load", () => frame.focus());

(window as unknown as { __client: unknown }).__client = { below, menu, controls };

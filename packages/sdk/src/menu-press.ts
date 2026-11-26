/**
 * What a press on the headset's menu does (docs/plans/headset-menu.md): one place, for every way the menu is shown in
 * a headset. The kit's own scene (console-sheet.ts) and an engine that isn't JavaScript's (engine-console.ts) ask
 * this, so a press does the same in a Three.js world as in a Godot one.
 *
 * What is pressed is said by a box's id from the drawing's layout (`MenuDrawing`): "tab:<id>", "tabs-left",
 * "tabs-right", "pin", "close", "act:<item>", or a key on the bar, "bar:act:<item>" or "bar:tab:<id>".
 */
import { MENU_LIMITS, menuFileKind } from "@nswp/core";
import { boxAt, sliderTrack, type Measure, type MenuDrawing } from "./menu-drawing.js";
import type { Controls } from "./ui/model.js";
import { outOfVr, whenScreenGone } from "./ui/vr-aside.js";

/** Ask for words on a keyboard in the headset (the kit's, keyboard.ts): null where there is none, or they gave up. */
export type AskWords = (o: { title: string; maxLength?: number; multiline?: boolean }) => Promise<string | null>;

export interface PressOptions {
  /** Where on the sheet the press landed, in the flat menu's pixels: where a press along a song's bar lands. */
  at?: { x: number; y: number };
  /** A keyboard, for a row to type in. Left out, the row is told of the press and asks its own way, as before. */
  ask?: AskWords;
  measure: Measure;
  /** The tab that is up, and making another the tab that is up. */
  section(): string;
  setSection(id: string): void;
}

/** A row that takes a file: from the headset's own storage, which only a flat page can offer, out of VR a moment. */
export function pickFile(controls: Controls, item: { id: string; accept?: readonly string[] }): void {
  const accept = item.accept ?? [];
  outOfVr(
    controls,
    () => {
      const picker = document.createElement("input");
      picker.type = "file";
      picker.accept = accept.map((k) => `${k}/*`).join(",");
      picker.hidden = true;
      const done = () => picker.remove();
      picker.addEventListener("cancel", done);
      picker.addEventListener("change", () => {
        const file = picker.files?.[0];
        done();
        if (!file) return;
        const kind = menuFileKind(file.type);
        if (!kind || !accept.includes(kind)) return controls.say("That kind of file can't go here.");
        if (file.size > MENU_LIMITS.file) return controls.say("That file is too large to hand over: 64 MB at most.");
        if (file.size < 1) return controls.say("That file is empty.");
        controls.run(item.id, undefined, file);
      });
      document.body.append(picker);
      picker.click();
      return { shown: true, gone: whenScreenGone(false) };
    },
    "file",
  );
}

/** Do what pressing the thing with this id does. Says "close" where the press puts the menu away. */
export function pressMenu(controls: Controls, d: MenuDrawing, id: string, o: PressOptions): "close" | void {
  const view = controls.view();
  if (id.startsWith("bar:")) {
    const key = id.slice(4);
    if (key.startsWith("tab:")) {
      // A tab kept on the bar: the menu on that tab, or put away where it is already up on it.
      if (o.section() === key.slice(4)) return "close";
      o.setSection(key.slice(4));
    } else if (key.startsWith("act:")) controls.run(key.slice(4));
    return;
  }
  if (id === "close") return "close";
  if (id.startsWith("tab:")) return o.setSection(id.slice(4));
  if (id === "tabs-left" || id === "tabs-right") {
    d.tabsScroll = Math.max(0, d.tabsScroll + (id === "tabs-left" ? -240 : 240));
    return;
  }
  if (id === "pin") {
    const here = view.sections.find((x) => x.id === o.section());
    if (here) controls.setPinned(here.id, !here.pinned);
    return;
  }
  if (!id.startsWith("act:")) return;
  const item = view.sections.flatMap((x) => x.items).find((i) => i.id === id.slice(4));
  if (item?.kind === "copy") {
    const words = item.copy ?? "";
    void (navigator.clipboard?.writeText(words) ?? Promise.reject(new Error("no clipboard"))).then(
      () => controls.say("Copied."),
      () => controls.say(words),
    );
  } else if (item?.kind === "field" && o.ask) {
    // A row to type in: the keyboard asks for the words, and they go where the flat menu's box sends them.
    void o.ask({ title: `${item.label}: what you type goes to ${view.title}.`, maxLength: MENU_LIMITS.field }).then((text) => {
      if (text?.trim()) controls.run(item.id, text);
    });
  } else if (item?.kind === "slider" && item.slider) {
    // A song's bar: pressed along, it is moved to there.
    const L = d.sheetLayout;
    const b = L ? boxAt(L, id, d.rowsScroll) : null;
    if (b && o.at) {
      const track = sliderTrack(b, item.slider.text?.() ?? "", o.measure, view.theme.scale || 1);
      const at = Math.max(0, Math.min(1, (o.at.x - track.left) / Math.max(1, track.wide)));
      controls.run(item.id, String(Math.round(at * item.slider.max())));
    }
  } else if (item?.kind === "file") pickFile(controls, item);
  else controls.run(id.slice(4));
}

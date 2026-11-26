/**
 * The headset's menu as the flat one (docs/plans/headset-menu.md, step 3): the sheet drawn by `createMenuDrawing`,
 * hung 1.0 m wide where the console opens, the bar under it leaning back to the eyes, and whatever is pointed at come
 * forward off it. Behind `?menu=sheet` for now; the console (console.ts) hosts it, with its Menu button, its wrist and
 * where it stands, and asks it what a ray points at and what a press does.
 *
 * Drawn over the room and under the visitor's own hands (`MENU_ORDER`, then `HANDS_ORDER`, input.ts), as the
 * console is.
 */
import * as THREE from "three";
import { MENU_LIMITS, menuFileKind } from "@nswp/core";
import { boxAt, chatAt, chatSides, createMenuDrawing, drawBar, drawChat, drawSheet, layChat, sliderTrack, type ChatLayout, type ChatSide, type MenuBox, type MenuDrawing } from "./menu-drawing.js";
import { outOfVr, whenScreenGone } from "./ui/vr-aside.js";
import type { Controls } from "./ui/model.js";
import { SHEET_LOOK as LOOK } from "./ui/sheet-look.js";

/** The sheet's width, in metres, floating (the owner's B) and on the wrist. */
export const SHEET_M = { floating: 1.0, wrist: 0.36 } as const;
/** How far a thing pointed at comes forward, in metres, and how long it takes, in seconds. */
export const FORWARD = { by: 0.035, takes: 0.12, clear: 0.01 } as const;
/** The bar: how far under the sheet, and how far it leans back to face the eyes. */
const BAR_GAP = 0.05;
const BAR_TILT = (28 * Math.PI) / 180;
/** The sheet's top, above where the console stands. */
const TOP = 0.3;
/** Canvas pixels to each of the flat menu's: sharper than a Quest 3S shows the sheet. */
const SCALE = 2;
/**
 * The most the sheet may be tall, in the flat menu's pixels: floating, 520 (0.67 m, about 35° down at 1.05 m with
 * the bar, the design's B); on the wrist, a phone's 640 (0.48 m). A longer tab scrolls, as on a flat screen.
 */
export const SHEET_MOST = { floating: 520, wrist: LOOK.sheet.tall.narrow } as const;

export interface SheetMenu {
  /** Its meshes, to add to the console's group. */
  readonly root: THREE.Group;
  /** The tab that is up. */
  section: string;
  /** Draw it for this mount, where anything it shows has changed. */
  paint(mount: "wrist" | "floating"): void;
  /** What this ray points at: "sheet:<id>", "bar:<id>", "pane" (the glass, nothing on it), or null. */
  pick(raycaster: THREE.Raycaster): string | null;
  aim(hit: string | null): void;
  /** Do what pressing it does. Says "close" where it closed the menu. */
  press(hit: string): "close" | void;
  /** Each frame while open: scrolls by the sticks, brings the thing pointed at forward. */
  update(dt: number, session: XRSession | null | undefined, mount: "wrist" | "floating", presence: string): void;
  /** Whether a ray rests on it: the sticks are its, and don't walk or turn the visitor. */
  readonly holding: boolean;
  /** For tests: the tabs, and the pressable things of the open tab, by their words. */
  describe(): { sections: string[]; buttons: string[]; lines: string[]; note: string; card: string; section: string };
  /** For tests: press the thing with these words. */
  pressLabelled(label: string): boolean;
  /**
   * For tests: where the thing with these words is in the room, its middle: a tab, a row, "Close", "Keep this tab on
   * your bar", or "bar:<words>" for a key on the bar. Null where it isn't shown.
   */
  whereIs(label: string): [number, number, number] | null;
  /** For tests: how far the list is scrolled, whether something has come forward and how far, and the chat panel's side. */
  readonly state: { rowsScroll: number; forward: string; lifted: number; chat: string };
}

const MENU_ORDER = 30;

/** The panel of chat, posts and letters beside the sheet: how far from its edge, and how far it is turned to the eyes. */
const CHAT_GAP = 0.03;
const CHAT_TURN = (20 * Math.PI) / 180;

export interface SheetMenuOptions {
  menuOrder?: number;
  motion: () => boolean;
  shown: () => boolean;
  /** Ask for words on the kit's keyboard (keyboard.ts, `ask`), for a typed row and the chat panel. Null: no keyboard. */
  ask?: (o: { title: string; maxLength?: number; multiline?: boolean }) => Promise<string | null>;
  /** Bring the menu up: the chat panel stands beside it, so asking for the panel brings it up too. */
  open?: () => void;
}

export function createSheetMenu(controls: Controls, opts: SheetMenuOptions): SheetMenu {
  const order = opts.menuOrder ?? MENU_ORDER;
  const root = new THREE.Group();
  root.name = "nswp-menu-sheet";
  const desk = createMenuDrawing(controls, { width: LOOK.sheet.wide, scale: SCALE, glass: 0.95, most: SHEET_MOST.floating, shown: opts.shown });
  const narrow = createMenuDrawing(controls, { width: LOOK.sheet.narrow, scale: SCALE, glass: 0.95, most: SHEET_MOST.wrist, shown: opts.shown });
  let mount: "wrist" | "floating" = "floating";
  const drawing = (): MenuDrawing => (mount === "wrist" ? narrow : desk);

  const plane = (name: string, renderOrder: number) => {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.name = name;
    mesh.renderOrder = renderOrder;
    return mesh;
  };
  const sheet = plane("sheet", order);
  const bar = plane("bar", order);
  const piece = plane("forward", order + 1);
  const chat = plane("chat", order);
  bar.rotation.x = -BAR_TILT;
  piece.visible = false;
  chat.visible = false;
  chat.rotation.y = -CHAT_TURN;
  root.add(sheet, bar, piece, chat);
  const chatCanvas = document.createElement("canvas");
  const chatG = chatCanvas.getContext("2d")!;
  const measureG = document.createElement("canvas").getContext("2d")!;
  const measure = (text: string, f: string) => {
    measureG.font = f;
    return measureG.measureText(text).width;
  };
  /** Which side of the panel is up, or null while it is put away; and what it was last drawn as. */
  let chatSide: ChatSide | null = null;
  let chatLayout: ChatLayout | null = null;
  let chatDrawn = "";
  let chatHot: string | null = null;
  /** Where on the sheet the last ray met it, in the flat menu's pixels: where a press along a song's bar lands. */
  let lastPoint = { x: 0, y: 0 };

  /** A canvas to a material: a new texture where its size has changed, the same one told to load again where not. */
  const upload = (mesh: THREE.Mesh, canvas: HTMLCanvasElement) => {
    const material = mesh.material as THREE.MeshBasicMaterial;
    const had = material.map as THREE.CanvasTexture | null;
    if (had && had.image === canvas && had.userData.w === canvas.width && had.userData.h === canvas.height) {
      had.needsUpdate = true;
      return;
    }
    had?.dispose();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.userData = { w: canvas.width, h: canvas.height };
    material.map = texture;
    material.needsUpdate = true;
  };

  /** Metres to each of the flat menu's pixels, for the mount it is on. */
  const perPx = () => SHEET_M[mount] / (drawing().sheetLayout?.width ?? LOOK.sheet.wide);

  const place = () => {
    const d = drawing();
    const L = d.sheetLayout;
    if (!L) return;
    const per = perPx();
    const h = L.height * per;
    sheet.scale.set(L.width * per, h, 1);
    sheet.position.set(0, mount === "wrist" ? 0 : TOP - h / 2, 0);
    if (chatLayout) {
      const cw = chatLayout.width * per;
      const ch = chatLayout.height * per;
      chat.scale.set(cw, ch, 1);
      chat.position.set((L.width * per) / 2 + CHAT_GAP + (cw / 2) * Math.cos(CHAT_TURN), TOP - ch / 2, (cw / 2) * Math.sin(CHAT_TURN));
    }
    const B = d.barLayout;
    if (B && mount === "floating") {
      const bh = B.height * per;
      bar.scale.set(B.width * per, bh, 1);
      bar.position.set(0, TOP - h - BAR_GAP - (bh / 2) * Math.cos(BAR_TILT), 0.03 + (bh / 2) * Math.sin(BAR_TILT));
    }
  };

  let aimed: string | null = null;
  let lift = 0;
  let pieceFor = "";
  let barShown = false;

  /** The thing come forward: its own piece of the same picture, lit, lifted off the sheet or the bar. */
  const makePiece = (hit: string) => {
    const d = drawing();
    const view = controls.view();
    const onBar = hit.startsWith("bar:");
    const id = hit.slice(onBar ? 4 : 6);
    let box: MenuBox | null = null;
    const full = document.createElement("canvas");
    const g = full.getContext("2d")!;
    if (onBar) {
      const B = d.barLayout;
      box = B?.keys.find((k) => k.id === id) ?? null;
      if (!B || !box) return false;
      full.width = Math.round(B.width * SCALE);
      full.height = Math.round(B.height * SCALE);
      drawBar(g, view, B, { scale: SCALE, glass: 0.95, hot: id, open: d.section });
      box = { ...box, y: box.y - 6, h: box.h + 6 };
    } else {
      const L = d.sheetLayout;
      if (!L) return false;
      box = boxAt(L, id, d.rowsScroll);
      if (!box) return false;
      full.width = Math.round(L.width * SCALE);
      full.height = Math.round(L.height * SCALE);
      drawSheet(g, view, L, { scale: SCALE, glass: 0.95, hot: id, rowsScroll: d.rowsScroll });
    }
    const cut = document.createElement("canvas");
    cut.width = Math.max(1, Math.round(box.w * SCALE));
    cut.height = Math.max(1, Math.round(box.h * SCALE));
    cut.getContext("2d")!.drawImage(full, box.x * SCALE, box.y * SCALE, box.w * SCALE, box.h * SCALE, 0, 0, cut.width, cut.height);
    upload(piece, cut);
    const per = perPx();
    const from = onBar ? bar : sheet;
    // Where its middle is, on the sheet or the bar, in the console's own space.
    const L = onBar ? d.barLayout! : d.sheetLayout!;
    const local = new THREE.Vector3(((box.x + box.w / 2) / L.width - 0.5), 0.5 - (box.y + box.h / 2) / L.height, 0);
    from.updateMatrix();
    local.applyMatrix4(from.matrix);
    piece.position.copy(local);
    piece.rotation.copy(from.rotation);
    piece.scale.set(box.w * per * 1.03, box.h * per * 1.03, 1);
    piece.userData.normal = new THREE.Vector3(0, 0, 1).applyEuler(from.rotation);
    piece.userData.base = local.clone();
    return true;
  };

  /** The chat panel, beside the floating sheet, while a side of it is up and there is a side to show. */
  const paintChat = () => {
    const view = controls.view();
    const sides = chatSides(view);
    if (chatSide && !sides.includes(chatSide)) chatSide = sides[0] ?? null;
    const L = drawing().sheetLayout;
    const show = !!chatSide && mount === "floating" && !!L;
    chat.visible = show;
    if (!show || !chatSide || !L) return;
    const sig = JSON.stringify([chatSide, view.theme, view.chat.version, view.feed.version, view.letters.version, sides, chatHot, L.height, Math.floor(Date.now() / 60000)]);
    if (sig === chatDrawn) return;
    chatDrawn = sig;
    chatLayout = layChat(view, chatSide, { measure, height: L.height });
    chatCanvas.width = Math.round(chatLayout.width * SCALE);
    chatCanvas.height = Math.round(chatLayout.height * SCALE);
    drawChat(chatG, view, chatLayout, { scale: SCALE, glass: 0.95, hot: chatHot });
    upload(chat, chatCanvas);
    place();
    if (chatSide === "room") controls.chat.seen();
    if (chatSide === "letters") controls.letters.seen();
  };
  /** Asked for by the world as a flat menu is: the room's chat, the visitor's feed, a conversation. */
  controls.onSignal((name) => {
    const side: ChatSide | null = name === "toggle:chat" ? "room" : name === "toggle:feed" ? "feed" : name === "open:letters" ? "letters" : null;
    if (!side || !opts.shown()) return;
    chatSide = name === "open:letters" || chatSide !== side ? side : null;
    if (chatSide === "feed") controls.feed.opened();
    if (chatSide) opts.open?.();
    s.paint(mount);
  });
  /** Words from the kit's keyboard, for where to write in the panel: sent, and anything said of it said. */
  const writeInChat = () => {
    if (!opts.ask || !chatSide) return;
    const view = controls.view();
    const side = chatSide;
    const ask =
      side === "feed"
        ? { title: "Write a post. Done sends it out, for anyone to read.", maxLength: view.feed.limit }
        : side === "letters"
          ? { title: `Write to ${view.letters.with}. Only they can read it. Done sends it.`, maxLength: view.letters.limit, multiline: true }
          : { title: "Write to the room. Done sends it.", maxLength: view.chat.limit };
    void opts.ask(ask).then((text) => {
      if (!text?.trim()) return;
      const trouble = side === "feed" ? controls.feed.send(text) : side === "letters" ? controls.letters.send(text) : controls.chat.send(text);
      if (trouble) controls.say(trouble);
    });
  };
  /** A row that takes a file: from the headset's own storage, which only a flat page can offer, out of VR a moment. */
  const pickFile = (item: { id: string; accept?: readonly string[] }) => {
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
  };

  const s: SheetMenu = {
    root,
    get section() {
      return desk.section;
    },
    set section(id: string) {
      desk.section = id;
      narrow.section = id;
      desk.rowsScroll = 0;
      narrow.rowsScroll = 0;
    },
    paint(next) {
      mount = next;
      const d = drawing();
      const forward = opts.motion();
      const hit = aimed;
      d.aimed = hit?.startsWith("sheet:") ? hit.slice(6) : null;
      d.barAimed = hit?.startsWith("bar:") ? hit.slice(4) : null;
      // Come forward, its place is an empty slot: its words aren't seen twice. Still, for someone who turned movement
      // down: it is lit where it is, as on a flat screen.
      d.hollow = forward ? d.aimed : null;
      d.barHollow = forward ? d.barAimed : null;
      const before = [d.sheet.width, d.sheet.height, d.bar.width, d.bar.height].join();
      if (d.paint()) {
        upload(sheet, d.sheet);
        if (d.barLayout?.keys.length) upload(bar, d.bar);
        void before;
        place();
      }
      paintChat();
      const wantPiece = forward && hit && hit !== "pane" && !hit.startsWith("chat:") ? hit : "";
      if (wantPiece !== pieceFor) {
        pieceFor = wantPiece;
        lift = 0;
        piece.visible = !!wantPiece && makePiece(wantPiece);
      }
    },
    pick(raycaster) {
      const d = drawing();
      const L = d.sheetLayout;
      if (!L) return null;
      if (chat.visible && chatLayout) {
        const onChat = raycaster.intersectObject(chat, false)[0];
        if (onChat?.uv) {
          const id = chatAt(chatLayout, onChat.uv.x * chatLayout.width, (1 - onChat.uv.y) * chatLayout.height);
          return id ? `chat:${id}` : "pane";
        }
      }
      const onSheet = raycaster.intersectObject(sheet, false)[0];
      if (onSheet?.uv) {
        const x = onSheet.uv.x * L.width;
        const y = (1 - onSheet.uv.y) * L.height;
        lastPoint = { x, y };
        // What has come forward stays so until the ray is a centimetre clear of it: no flicker as the hand shakes.
        if (aimed?.startsWith("sheet:")) {
          const keep = boxAt(L, aimed.slice(6), d.rowsScroll);
          const clear = FORWARD.clear / perPx();
          if (keep && x >= keep.x - clear && x <= keep.x + keep.w + clear && y >= keep.y - clear && y <= keep.y + keep.h + clear) return aimed;
        }
        const id = d.sheetAt(x, y);
        return id ? `sheet:${id}` : "pane";
      }
      const B = d.barLayout;
      if (barShown && bar.visible && B) {
        const onBar = raycaster.intersectObject(bar, false)[0];
        if (onBar?.uv) {
          const id = d.barAt(onBar.uv.x * B.width, (1 - onBar.uv.y) * B.height);
          return id ? `bar:${id}` : "pane";
        }
      }
      return null;
    },
    aim(hit) {
      if (hit === aimed) return;
      aimed = hit;
      chatHot = hit?.startsWith("chat:") ? hit.slice(5) : null;
      s.paint(mount);
    },
    press(hit) {
      const d = drawing();
      const view = controls.view();
      if (hit.startsWith("bar:")) {
        const id = hit.slice(4);
        if (id.startsWith("tab:")) {
          // A tab kept on the bar: the menu on that tab, or put away where it is already up on it.
          if (s.section === id.slice(4)) return "close";
          s.section = id.slice(4);
        } else if (id.startsWith("act:")) controls.run(id.slice(4));
        s.paint(mount);
        return;
      }
      if (hit.startsWith("chat:")) {
        const id = hit.slice(5);
        if (id.startsWith("chat-tab:")) chatSide = id.slice(9) as ChatSide;
        else if (id === "chat-close") chatSide = null;
        else if (id === "chat-write") writeInChat();
        if (chatSide === "feed") controls.feed.opened();
        s.paint(mount);
        return;
      }
      const id = hit.startsWith("sheet:") ? hit.slice(6) : hit;
      if (id === "close") return "close";
      if (id.startsWith("tab:")) s.section = id.slice(4);
      else if (id === "tabs-left" || id === "tabs-right") d.tabsScroll += id === "tabs-left" ? -240 : 240;
      else if (id === "pin") {
        const here = view.sections.find((x) => x.id === s.section);
        if (here) controls.setPinned(here.id, !here.pinned);
      } else if (id.startsWith("act:")) {
        const item = view.sections.flatMap((x) => x.items).find((i) => i.id === id.slice(4));
        if (item?.kind === "copy") {
          const words = item.copy ?? "";
          void (navigator.clipboard?.writeText(words) ?? Promise.reject(new Error("no clipboard"))).then(
            () => controls.say("Copied."),
            () => controls.say(words),
          );
        } else if (item?.kind === "field" && opts.ask) {
          // A row to type in: the kit's keyboard asks for the words, and they go where the flat menu's box sends them.
          void opts.ask({ title: `${item.label}: what you type goes to ${view.title}.`, maxLength: MENU_LIMITS.field }).then((text) => {
            if (text?.trim()) controls.run(item.id, text);
          });
        } else if (item?.kind === "slider" && item.slider) {
          // A song's bar: pressed along, it is moved to there.
          const L = d.sheetLayout;
          const b = L ? boxAt(L, id, d.rowsScroll) : null;
          if (b) {
            const track = sliderTrack(b, item.slider.text?.() ?? "", measure, view.theme.scale || 1);
            const at = Math.max(0, Math.min(1, (lastPoint.x - track.left) / Math.max(1, track.wide)));
            controls.run(item.id, String(Math.round(at * item.slider.max())));
          }
        } else if (item?.kind === "file") pickFile(item);
        else controls.run(id.slice(4));
      }
      s.paint(mount);
    },
    update(dt, session, next, presence) {
      mount = next;
      barShown = next === "floating" && presence === "full" && (drawing().barLayout?.keys.length ?? 0) > 0;
      bar.visible = barShown;
      // The sticks, while a ray is on the sheet: up and down the list, or along the strip of tabs.
      if (aimed && aimed !== "pane" ? aimed.startsWith("sheet:") : aimed === "pane") {
        let x = 0;
        let y = 0;
        for (const source of session?.inputSources ?? []) {
          const axes = source.gamepad?.axes ?? [];
          const sx = axes[2] ?? 0;
          const sy = axes[3] ?? 0;
          if (Math.abs(sx) > Math.abs(x)) x = sx;
          if (Math.abs(sy) > Math.abs(y)) y = sy;
        }
        const d = drawing();
        const L = d.sheetLayout;
        if (L && Math.abs(y) > 0.15 && L.rowsAt) {
          const most = Math.max(0, L.rowsContent - L.rowsAt.h);
          const was = d.rowsScroll;
          d.rowsScroll = Math.max(0, Math.min(most, d.rowsScroll + y * dt * 600));
          if (d.rowsScroll !== was) s.paint(mount);
        } else if (L && Math.abs(x) > 0.3 && aimed?.startsWith("sheet:tab")) {
          d.tabsScroll = Math.max(0, d.tabsScroll + x * dt * 600);
          s.paint(mount);
        }
      }
      // Coming forward, eased, over its time.
      if (piece.visible && piece.userData.base) {
        lift = Math.min(1, lift + dt / FORWARD.takes);
        const eased = 1 - (1 - lift) * (1 - lift);
        piece.position.copy(piece.userData.base as THREE.Vector3).addScaledVector(piece.userData.normal as THREE.Vector3, eased * FORWARD.by);
      }
    },
    get holding() {
      return aimed !== null && !aimed.startsWith("chat:");
    },
    describe() {
      const view = controls.view();
      const current = view.sections.find((x) => x.id === s.section) ?? view.sections[0];
      return {
        sections: view.sections.map((x) => x.label),
        section: current?.id ?? "",
        buttons: current?.items.filter((i) => i.kind !== "line").map((i) => i.label) ?? [],
        lines: current?.items.filter((i) => i.kind === "line").map((i) => i.label) ?? [],
        note: current?.note ?? "",
        card: current?.card?.title ?? "",
      };
    },
    whereIs(label) {
      const d = drawing();
      const view = controls.view();
      const L = d.sheetLayout;
      const B = d.barLayout;
      if (!L) return null;
      let box: MenuBox | null = null;
      let on: THREE.Mesh = sheet;
      let size = { w: L.width, h: L.height };
      if (label.startsWith("chat:")) {
        // The chat panel's own: "chat:write", "chat:close", "chat:tab:<side>".
        if (!chat.visible || !chatLayout) return null;
        const id = `chat-${label.slice(5)}`;
        const b = [...chatLayout.tabs, chatLayout.close, chatLayout.write].find((x) => x.id === id) ?? null;
        if (!b) return null;
        root.updateMatrixWorld(true);
        return chat.localToWorld(new THREE.Vector3((b.x + b.w / 2) / chatLayout.width - 0.5, 0.5 - (b.y + b.h / 2) / chatLayout.height, 0)).toArray() as [number, number, number];
      }
      const along = /^(.*)@([\d.]+)$/.exec(label);
      if (along) {
        // A song's bar, at a share of the way along it: "<its words>@0.75".
        const item = view.sections.find((x) => x.id === s.section)?.items.find((i) => i.label === along[1] && i.kind === "slider");
        const b = item ? boxAt(L, `act:${item.id}`, d.rowsScroll) : null;
        if (!item || !b) return null;
        const track = sliderTrack(b, item.slider?.text?.() ?? "", measure, view.theme.scale || 1);
        const x = track.left + Number(along[2]) * track.wide;
        root.updateMatrixWorld(true);
        return sheet.localToWorld(new THREE.Vector3(x / L.width - 0.5, 0.5 - (b.y + b.h - 18) / L.height, 0)).toArray() as [number, number, number];
      }
      if (label.startsWith("bar:")) {
        const words = label.slice(4);
        box = B?.keys.find((k) => (k.lines ?? []).join(" ") === words) ?? null;
        on = bar;
        size = { w: B?.width ?? 1, h: B?.height ?? 1 };
        if (!bar.visible) return null;
      } else if (label === "Close") box = L.close;
      else if (label === "tabs-left" || label === "tabs-right") box = boxAt(L, label, d.rowsScroll);
      else if (L.pin && label === L.pin.lines?.[0]) box = L.pin;
      else {
        const tab = view.sections.find((x) => x.label === label);
        const item = view.sections.find((x) => x.id === s.section)?.items.find((i) => i.label === label && i.kind !== "line");
        const id = tab ? `tab:${tab.id}` : item ? `act:${item.id}` : null;
        box = id ? boxAt(L, id, d.rowsScroll) : null;
      }
      if (!box) return null;
      root.updateMatrixWorld(true);
      const local = new THREE.Vector3((box.x + box.w / 2) / size.w - 0.5, 0.5 - (box.y + box.h / 2) / size.h, 0);
      return on.localToWorld(local).toArray() as [number, number, number];
    },
    get state() {
      return { chat: chat.visible ? (chatSide ?? "") : "", rowsScroll: drawing().rowsScroll, forward: piece.visible ? pieceFor : "", lifted: piece.visible ? Math.round(((piece.userData.base as THREE.Vector3 | undefined)?.distanceTo(piece.position) ?? 0) * 1000) / 1000 : 0 };
    },
    pressLabelled(label) {
      const view = controls.view();
      if (label === "Close") return s.press("sheet:close") === "close";
      const tab = view.sections.find((x) => x.label === label);
      if (tab) {
        s.press(`sheet:tab:${tab.id}`);
        return true;
      }
      const current = view.sections.find((x) => x.id === s.section);
      const item = current?.items.find((i) => i.label === label && i.kind !== "line");
      if (!item) return false;
      s.press(`sheet:act:${item.id}`);
      return true;
    },
  };
  return s;
}

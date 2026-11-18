/**
 * A menu a visitor can reach inside a headset.
 *
 * In an immersive session the page around the scene is gone, and every HTML
 * button with it: the way home, the room's controls, the microphone. This puts
 * the same actions in the scene. Closed, it is one small "Menu" button that
 * keeps to the visitor's side, low and in front. Selecting it opens a short
 * column of large buttons.
 *
 * It needs only `select`, so it works with controllers, hand pinches and
 * gaze-and-pinch alike (spec §21.2). A wrist menu would need a tracked hand,
 * which not every headset gives a web page.
 *
 * It is drawn by the world. It is the world's own menu and nothing more: it is
 * not a trusted surface, and a visitor's real way out of any world is their
 * headset's own controls (spec §3.2).
 *
 *   const menu = createWorldMenu({ items: [{ label: "Go home", act: () => portal.home() }] });
 *   scene.add(menu.group);
 *   // each frame:        menu.update(dt, camera, renderer.xr.isPresenting)
 *   // when aiming a ray: const hit = menu.pick(raycaster); menu.aim(hit);
 *   // on select:         if (hit) menu.press(hit);
 */
import * as THREE from "three";

export interface MenuItem {
  /** What the button says. A function is read again while the menu is open, so the words can follow what they describe. */
  label: string | (() => string);
  act(): void | Promise<void>;
  /** Leave the button out while this returns true. */
  hidden?: () => boolean;
}

export interface WorldMenuOptions {
  items: MenuItem[];
  /** A line or two above the buttons, such as a room's status. Read again while the menu is open. */
  note?: () => string;
  textColor?: string;
}

export interface WorldMenu {
  /** Add this to the scene (not to the camera or the rig). */
  group: THREE.Group;
  readonly open: boolean;
  setOpen(open: boolean): void;
  /** The menu button this ray points at, or null. */
  pick(raycaster: THREE.Raycaster): THREE.Mesh | null;
  /** Say which button is being pointed at, so it can show it. */
  aim(button: THREE.Mesh | null): void;
  /** Press a button that pick() returned. */
  press(button: THREE.Mesh): void;
  /** Call every frame. `showing` is normally whether a headset session is running: on a flat screen the page has its own buttons. */
  update(dt: number, camera: THREE.Camera, showing: boolean): void;
  /** What the menu shows right now, in words. For tests. */
  describe(): { showing: boolean; open: boolean; buttons: string[]; note: string };
  /** Press the showing button with these words. For tests. Returns false if there is none. */
  pressLabelled(label: string): boolean;
}

/** A button on the page as a menu item: it says what the button says and presses it. One piece of logic serves both. */
export function menuItemFor(button: HTMLButtonElement): MenuItem {
  return { label: () => button.textContent ?? "", hidden: () => button.hidden !== false || button.disabled, act: () => button.click() };
}

const ROW_W = 0.56;
const ROW_H = 0.13;
const GAP = 0.025;

function drawPill(canvas: HTMLCanvasElement, text: string, color: string): void {
  const g = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgba(16,18,23,0.94)";
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(5, 5, w - 10, h - 10, (h - 10) / 2);
  g.fill();
  g.stroke();
  g.fillStyle = color;
  g.font = `600 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 2, w - 70);
}

function drawNote(canvas: HTMLCanvasElement, text: string, color: string): number {
  const g = canvas.getContext("2d")!;
  const w = canvas.width;
  const size = 34;
  g.font = `400 ${size}px system-ui, sans-serif`;
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width <= w - 48 || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  lines.length = Math.min(lines.length, 4);
  const h = 32 + lines.length * (size + 8);
  canvas.height = h; // also clears it
  g.fillStyle = "rgba(10,12,18,0.82)";
  g.beginPath();
  g.roundRect(0, 0, w, h, 20);
  g.fill();
  g.font = `400 ${size}px system-ui, sans-serif`;
  g.fillStyle = color;
  g.textBaseline = "top";
  lines.forEach((l, i) => g.fillText(l, 24, 18 + i * (size + 8)));
  return h / w;
}

interface Row {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  text: string;
}

export function createWorldMenu(opts: WorldMenuOptions): WorldMenu {
  const color = opts.textColor ?? "#f2f3f6";
  const group = new THREE.Group();
  group.name = "world-menu";
  group.visible = false;
  const rowGeo = new THREE.PlaneGeometry(ROW_W, ROW_H);

  const makeRow = (): Row => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = Math.round((768 * ROW_H) / ROW_W);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // Drawn over the scene: a menu behind a wall is no use to anyone.
    const mesh = new THREE.Mesh(rowGeo, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false }));
    mesh.renderOrder = 20;
    group.add(mesh);
    return { mesh, canvas, texture, text: "" };
  };
  const write = (row: Row, text: string) => {
    if (row.text === text) return;
    row.text = text;
    drawPill(row.canvas, text, color);
    row.texture.needsUpdate = true;
  };

  const opener = makeRow();
  write(opener, "Menu");
  opener.mesh.scale.setScalar(0.62);
  const closer = makeRow();
  write(closer, "Close");
  const rows = opts.items.map(() => makeRow());

  const noteCanvas = document.createElement("canvas");
  noteCanvas.width = 768;
  const noteTexture = new THREE.CanvasTexture(noteCanvas);
  noteTexture.colorSpace = THREE.SRGBColorSpace;
  const note = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: noteTexture, transparent: true, depthTest: false }));
  note.renderOrder = 20;
  group.add(note);
  let noteText = "";

  let open = false;
  let placed = false;
  let settling = false;
  let aimed: THREE.Mesh | null = null;
  let sinceRead = 1;
  let shown: THREE.Mesh[] = [];
  const head = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const want = new THREE.Vector3();

  /** Read the labels again and stack what is showing, top to bottom. */
  const layout = () => {
    opener.mesh.visible = !open;
    closer.mesh.visible = open;
    note.visible = false;
    for (const r of rows) r.mesh.visible = false;
    if (!open) {
      opener.mesh.position.set(0, 0, 0);
      shown = [opener.mesh];
      return;
    }
    const showing: Row[] = [];
    opts.items.forEach((item, i) => {
      if (item.hidden?.()) return;
      const row = rows[i]!;
      write(row, typeof item.label === "function" ? item.label() : item.label);
      row.mesh.visible = true;
      showing.push(row);
    });
    showing.push(closer);
    const text = opts.note?.().trim() ?? "";
    let noteH = 0;
    if (text) {
      if (text !== noteText) {
        noteText = text;
        const ratio = drawNote(noteCanvas, text, color);
        noteTexture.needsUpdate = true;
        note.scale.set(ROW_W * 1.25, ROW_W * 1.25 * ratio, 1);
      }
      noteH = note.scale.y + GAP;
      note.visible = true;
    }
    const total = noteH + showing.length * ROW_H + (showing.length - 1) * GAP;
    let y = total / 2;
    if (text) {
      note.position.set(0, y - note.scale.y / 2, 0);
      y -= noteH;
    }
    for (const row of showing) {
      row.mesh.position.set(0, y - ROW_H / 2, 0);
      y -= ROW_H + GAP;
    }
    shown = showing.map((r) => r.mesh);
  };

  /** Where the menu belongs for a head here, facing this way. */
  const place = () => {
    const flat = Math.hypot(facing.x, facing.z) || 1;
    const reach = open ? 1.0 : 0.75;
    // Closed: low, where a hand points without it sitting in the view. Open: a little below eye level.
    want.set(head.x + (facing.x / flat) * reach, Math.max(0.4, head.y - (open ? 0.22 : 0.52)), head.z + (facing.z / flat) * reach);
  };
  const face = () => {
    group.rotation.y = Math.atan2(head.x - group.position.x, head.z - group.position.z);
  };

  const menu = {
    group,
    get open() {
      return open;
    },
    setOpen(next) {
      if (open === next) return;
      open = next;
      placed = false; // it opens in front of the visitor, wherever they are looking now
      sinceRead = 0;
      layout();
    },
    pick(raycaster) {
      if (!group.visible) return null;
      const hit = raycaster.intersectObjects(shown, false)[0];
      return (hit?.object as THREE.Mesh | undefined) ?? null;
    },
    aim(button) {
      aimed = button;
    },
    press(button) {
      if (button === opener.mesh) return menu.setOpen(true);
      if (button === closer.mesh) return menu.setOpen(false);
      const i = rows.findIndex((r) => r.mesh === button);
      const item = opts.items[i];
      if (!item) return;
      void Promise.resolve(item.act())
        .catch(() => {})
        .finally(() => {
          sinceRead = 1; // the words may have changed
        });
    },
    update(dt, camera, showing) {
      if (!showing) {
        if (group.visible) {
          group.visible = false;
          open = false;
          placed = false;
          layout();
        }
        return;
      }
      camera.getWorldPosition(head);
      camera.getWorldDirection(facing);
      place();
      if (!placed) {
        group.position.copy(want);
        placed = true;
        settling = false;
        layout();
      } else if (open) {
        // An open menu stays where it was opened, so it can be aimed at. Walk away and it closes.
        if (Math.hypot(head.x - group.position.x, head.z - group.position.z) > 2.5) menu.setOpen(false);
      } else {
        // The closed button keeps to the visitor's side, but lazily: it only moves once they have turned or walked well away from it.
        if (group.position.distanceTo(want) > 0.6) settling = true;
        if (settling) {
          group.position.lerp(want, Math.min(1, dt * 6));
          if (group.position.distanceTo(want) < 0.02) settling = false;
        }
      }
      face();
      group.visible = true;
      if (open && (sinceRead += dt) > 0.3) {
        sinceRead = 0;
        layout();
      }
      for (const mesh of shown) {
        const base = mesh === opener.mesh ? 0.62 : 1;
        mesh.scale.setScalar(base * (mesh === aimed ? 1.08 : 1));
      }
    },
  } as WorldMenu;
  const labelOf = (mesh: THREE.Mesh) => [opener, closer, ...rows].find((r) => r.mesh === mesh)?.text ?? "";
  menu.describe = () => ({ showing: group.visible, open, buttons: shown.map(labelOf), note: open && note.visible ? noteText : "" });
  menu.pressLabelled = (label) => {
    const mesh = shown.find((m) => labelOf(m) === label);
    if (!mesh) return false;
    menu.press(mesh);
    return true;
  };
  layout();
  return menu;
}

/**
 * Turn the visitor on the spot, in one step. A turn in one step is the
 * comfortable kind; a slow spin of the whole view makes people ill. It is also
 * the only way to face the other way for someone seated who can't turn round.
 */
export function turnVisitor(rig: THREE.Object3D, camera: THREE.Camera, degrees: number): void {
  const head = camera.getWorldPosition(new THREE.Vector3());
  const a = THREE.MathUtils.degToRad(degrees);
  const dx = rig.position.x - head.x;
  const dz = rig.position.z - head.z;
  // Swing the rig round the head, so the head stays where it is.
  rig.position.x = head.x + dx * Math.cos(a) + dz * Math.sin(a);
  rig.position.z = head.z - dx * Math.sin(a) + dz * Math.cos(a);
  rig.rotation.y += a;
}

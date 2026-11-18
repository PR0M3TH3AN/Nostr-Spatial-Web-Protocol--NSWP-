/**
 * A visitor's figure, drawn from their look (spec §4.2).
 *
 * A look is a few choices from closed lists and three colours. This turns
 * one into a head, a body and two hands, modelled with the kit (mesh.ts). It
 * is what other people in a room are drawn as, the same in every world that
 * uses it.
 *
 * A world that wants its visitors to match its own art can re-dress the
 * figure: its own material, its own palette, parts left off. The shapes stay,
 * so people can still tell each other apart. Or it can read the look and draw
 * something of its own entirely.
 */
import * as THREE from "three";
import { generatedLook, markGrid, type Look } from "@nswp/core";
import { createAlloy, type Alloy } from "./alloy.js";
import { MeshBuilder, type Paint } from "./mesh.js";

export interface FigureStyle {
  /**
   * Draw the figure in a material of the world's own. The geometry carries
   * plain vertex colours (`vertexColors: true`), with the look's lights
   * already in them. Called once per figure, with the look's light colour.
   */
  material?: (light: THREE.Color, look: Look) => THREE.Material;
  /** Keep to the world's own colours: each of the look's three becomes the nearest of these. */
  palette?: THREE.ColorRepresentation[];
  /** Parts to leave off: a world with hats of its own, say. */
  omit?: ("accessory" | "shoulders" | "mark")[];
}

/** What is known about the person, as opposed to how they chose to look. */
export interface FigureFacts {
  /**
   * Their pass checked out (protocol/10-identity.md), so the mark is their
   * identity key's. It is drawn with a lit ring round it. Never set this on
   * anyone's say-so.
   */
  proven?: boolean;
}

export interface Figure {
  group: THREE.Group;
  /** Faces -Z, like a camera. Its origin is between the eyes. */
  head: THREE.Group;
  torso: THREE.Mesh;
  hands: [THREE.Mesh, THREE.Mesh];
  /** What it is drawn in: alloy, unless a style supplied something else. */
  metal: THREE.Material;
  look: Look;
  /** Call each frame with seconds since the start, so its lights move. */
  tick(t: number): void;
  dispose(): void;
}

const DARK = new THREE.Color(0x0a0f15);
/** How much of a chosen colour shows on a surface that is also catching light. */
const DEPTH = 0.4;

function nearest(color: THREE.Color, palette: THREE.Color[]): THREE.Color {
  let best = palette[0]!;
  let far = Infinity;
  for (const p of palette) {
    const d = (p.r - color.r) ** 2 + (p.g - color.g) ** 2 + (p.b - color.b) ** 2;
    if (d < far) [best, far] = [p, d];
  }
  return best.clone();
}

/** Where a head's face sits and how wide it is, so the face and what is worn on top fit any head. */
interface HeadFit {
  front: number;
  top: number;
  half: number;
}

function buildHead(b: MeshBuilder, look: Look, main: THREE.Color, accent: THREE.Color, omit: Set<string>): void {
  let fit: HeadFit;
  const shade = (row: number) => ({ color: main, shade: 0.85 + row * 0.1 });
  switch (look.head) {
    case "square":
      b.box([0.24, 0.24, 0.24], [0, 0, 0], { color: main, bevel: 0.03, panel: { margin: 0.045, depth: 0.012, faces: "x+ x- z+ y+" } });
      fit = { front: 0.12, top: 0.12, half: 0.085 };
      break;
    case "tall":
      b.lathe([[0.0005, -0.14], [0.09, -0.13], [0.115, -0.02], [0.105, 0.14], [0.06, 0.2], [0.0005, 0.21]], [0, 0, 0], 6, shade);
      fit = { front: 0.098, top: 0.21, half: 0.058 };
      break;
    case "wedge":
      // Three sides, the flat one forward: it comes to an edge at the back.
      b.lathe([[0.0005, -0.12], [0.17, -0.1], [0.18, 0.09], [0.0005, 0.12]], [0, 0, 0], 3, shade, { turn: Math.PI / 2 });
      fit = { front: 0.088, top: 0.12, half: 0.11 };
      break;
    case "flat":
      b.lathe([[0.0005, -0.085], [0.15, -0.06], [0.165, 0.03], [0.09, 0.085], [0.0005, 0.09]], [0, 0, 0], 10, shade);
      fit = { front: 0.152, top: 0.09, half: 0.09 };
      break;
    case "faceted":
      b.lathe([[0.0005, -0.15], [0.1, -0.07], [0.14, 0.03], [0.08, 0.13], [0.0005, 0.165]], [0, 0, 0], 5, (row) => ({ color: main, shade: 0.8 + row * 0.16 }), { turn: Math.PI / 10 });
      fit = { front: 0.108, top: 0.165, half: 0.064 };
      break;
    default:
      b.lathe([[0.0005, -0.135], [0.07, -0.125], [0.118, -0.05], [0.13, 0.02], [0.112, 0.085], [0.06, 0.128], [0.0005, 0.14]], [0, 0, 0], 8, shade, { turn: Math.PI / 8 });
      fit = { front: 0.122, top: 0.14, half: 0.075 };
  }
  // A lit ring where the head meets the neck.
  b.lathe([[0.06, -0.135], [0.075, -0.125]], [0, 0, 0], 8, () => ({ glow: 0.8 }), { turn: Math.PI / 8 });

  // The face: a dark housing let into the front, and light cut into it in one of six ways.
  const { front, half } = fit;
  const tallFace = look.face === "tee" || look.face === "wide";
  b.box([half * 2 + 0.03, tallFace ? 0.13 : 0.085, 0.03], [0, tallFace ? 0 : 0.02, -(front - 0.006)], { color: DARK, bevel: 0.008 });
  const z = -(front + 0.0095);
  const lit = (w: number, h: number, x: number, y: number) => b.quad([x - w / 2, y - h / 2, z], [x + w / 2, y - h / 2, z], [x + w / 2, y + h / 2, z], [x - w / 2, y + h / 2, z], { glow: 1 }, [0, 0, -1]);
  switch (look.face) {
    case "split":
      lit(half * 0.72, 0.04, -half * 0.52, 0.02);
      lit(half * 0.72, 0.04, half * 0.52, 0.02);
      break;
    case "dots":
      lit(0.036, 0.036, -half * 0.5, 0.02);
      lit(0.036, 0.036, half * 0.5, 0.02);
      break;
    case "tee":
      lit(half * 1.9, 0.03, 0, 0.035);
      lit(0.03, 0.075, 0, -0.018);
      break;
    case "slit":
      lit(half * 2, 0.014, 0, 0.02);
      break;
    case "wide":
      lit(half * 1.8, 0.085, 0, 0);
      break;
    default:
      lit(half * 1.9, 0.04, 0, 0.02);
  }

  if (omit.has("accessory")) return;
  const t = fit.top;
  switch (look.accessory) {
    case "antenna":
      b.lathe([[0.012, t - 0.03], [0.006, t + 0.2]], [fit.half * 0.8, 0, 0.02], 4, () => ({ color: accent }));
      b.box([0.024, 0.024, 0.024], [fit.half * 0.8, t + 0.21, 0.02], { glow: 1 });
      break;
    case "halo":
      b.lathe([[0.13, t + 0.08], [0.165, t + 0.08], [0.165, t + 0.098], [0.13, t + 0.098], [0.13, t + 0.08]], [0, 0, 0], 12, () => ({ glow: 1 }));
      break;
    case "hat":
      b.lathe([[0.09, t - 0.012], [0.21, t - 0.012], [0.21, t + 0.004], [0.1, t + 0.01], [0.1, t + 0.035], [0.09, t + 0.035], [0.085, t + 0.12], [0.0005, t + 0.125]], [0, 0, 0], 10, (row) => (row === 4 ? { glow: 0.8 } : { color: accent, shade: row === 2 ? 1.2 : 0.95 }));
      break;
    case "crest":
      b.box([0.022, 0.09, 0.22], [0, t + 0.02, 0.01], { color: accent, bevel: 0.006 });
      b.box([0.012, 0.01, 0.2], [0, t + 0.068, 0.01], { glow: 1 });
      break;
    case "fins":
      for (const side of [-1, 1]) {
        b.box([0.016, 0.13, 0.1], [side * (fit.half + 0.068), 0.035, 0.02], { color: accent, bevel: 0.005 });
        b.box([0.008, 0.11, 0.012], [side * (fit.half + 0.078), 0.035, 0.066], { glow: 1 });
      }
      break;
  }
}

function buildBody(b: MeshBuilder, look: Look, main: THREE.Color, accent: THREE.Color, omit: Set<string>, proven = false): void {
  const k = look.build === "slight" ? 0.86 : look.build === "broad" ? 1.2 : 1;
  /** How the two colours are laid on: by height (`row` of `rows`) and by which way a face points (`side` of `sides`). */
  const cloth = (row: number, rows: number, side: number, sides: number, turn = 0): THREE.Color => {
    const a = ((side + 0.5) / sides) * Math.PI * 2 + turn;
    switch (look.pattern) {
      case "halves":
        return Math.cos(a) > 0 ? accent : main;
      case "stripe":
        return Math.abs(Math.cos(a)) < 0.35 ? accent : main;
      case "bands":
        return row % 2 === 1 ? accent : main;
      case "yoke":
        return row >= rows - 3 ? accent : main;
      default:
        return main;
    }
  };
  /** One profile turned into a body: lit underneath, with a lit band at `band`. */
  const turned = (profile: [number, number][], sides: number, band: number, turn = 0) =>
    b.lathe(profile, [0, 0, 0], sides, (row, side): Paint => (row === 0 ? { glow: 0.4 } : row === band ? { glow: 0.75 } : { color: cloth(row, profile.length - 1, side, sides, turn), shade: 0.9 + (row % 2) * 0.18 }), { turn });
  let chest: number; // how far forward the chest is, for the mark
  switch (look.body) {
    case "coat":
      turned([[0.03, -0.24], [0.165 * k, -0.25], [0.18 * k, 0.1], [0.205 * k, 0.17], [0.205 * k, 0.195], [0.1, 0.25], [0.0005, 0.25]], 4, 3, Math.PI / 4);
      chest = 0.125 * k;
      break;
    case "plate":
      b.lathe([[0.03, -0.2], [0.11 * k, -0.25], [0.08 * k, -0.02]], [0, 0, 0], 8, (row) => (row === 0 ? { glow: 0.4 } : { color: main, shade: 0.9 }), { turn: Math.PI / 8 });
      b.box([0.31 * k, 0.26, 0.18], [0, 0.11, 0], { color: look.pattern === "plain" ? main : accent, bevel: 0.035, panel: { margin: 0.05, depth: 0.014, faces: "z+ x+ x-" } });
      b.box([0.33 * k, 0.012, 0.2], [0, -0.022, 0], { glow: 0.75 });
      chest = 0.09;
      break;
    case "robe":
      turned([[0.03, -0.4], [0.2 * k, -0.45], [0.16 * k, -0.2], [0.115 * k, 0.1], [0.135 * k, 0.17], [0.135 * k, 0.195], [0.07, 0.25], [0.0005, 0.25]], 10, 4);
      chest = 0.112 * k;
      break;
    default:
      turned([[0.03, -0.2], [0.17 * k, -0.25], [0.12 * k, 0.12], [0.145 * k, 0.165], [0.145 * k, 0.19], [0.08, 0.25], [0.0005, 0.25]], 6, 3);
      chest = 0.108 * k;
  }

  if (!omit.has("shoulders")) {
    switch (look.shoulders) {
      case "pads":
        for (const side of [-1, 1]) {
          b.box([0.12, 0.06, 0.15], [side * (0.17 * k + 0.03), 0.2, 0], { color: accent, bevel: 0.02 });
          b.box([0.008, 0.02, 0.13], [side * (0.17 * k + 0.092), 0.2, 0], { glow: 1 });
        }
        break;
      case "mantle":
        b.lathe([[0.09, 0.2], [0.24 * k, 0.165], [0.25 * k, 0.19], [0.1, 0.262]], [0, 0, 0], 8, (row) => (row === 1 ? { glow: 0.7 } : { color: accent, shade: row === 2 ? 1.15 : 0.8 }), { turn: Math.PI / 8 });
        break;
      case "collar":
        b.lathe([[0.1, 0.22], [0.15, 0.31], [0.135, 0.318], [0.09, 0.24]], [0, 0, 0], 8, (row) => (row === 1 ? { glow: 0.9 } : { color: accent, shade: row === 0 ? 1.1 : 0.7 }), { turn: Math.PI / 8 });
        break;
    }
  }

  if (omit.has("mark")) return;
  // The mark, drawn from the look's own key: five rows of five cells. Large on
  // the back, where the people behind someone see it, and as a small badge on
  // the chest.
  const plate = (x: number, y: number, z: number, cell: number, facing: 1 | -1) => {
    const pitch = cell * 1.14;
    const wide = pitch * 5 + cell * 0.7;
    b.box([wide, wide, 0.02], [x, y, z - facing * 0.008], { color: DARK, bevel: 0.006 });
    if (proven) {
      // A lit frame: this mark has been proved, and is not merely worn.
      const [half, band, zz] = [wide / 2 + cell * 0.55, cell * 0.38, z + facing * 0.0025];
      const bar = (x0: number, y0: number, x1: number, y1: number) => b.quad([x + x0, y + y0, zz], [x + x1, y + y0, zz], [x + x1, y + y1, zz], [x + x0, y + y1, zz], { glow: 1 }, [0, 0, facing]);
      bar(-half, half - band, half, half);
      bar(-half, -half, half, -half + band);
      bar(-half, -half + band, -half + band, half - band);
      bar(half - band, -half + band, half, half - band);
    }
    markGrid(look.mark).forEach((row, r) =>
      row.forEach((on, c) => {
        if (!on) return;
        // Mirrored left to right already, so it reads the same from either side.
        const [cx, cy, cz] = [x + (c - 2) * pitch, y + (2 - r) * pitch, z + facing * 0.0025];
        b.quad([cx - cell / 2, cy - cell / 2, cz], [cx + cell / 2, cy - cell / 2, cz], [cx + cell / 2, cy + cell / 2, cz], [cx - cell / 2, cy + cell / 2, cz], { glow: 1 }, [0, 0, facing]);
      }),
    );
  };
  plate(0, 0.04, chest + 0.012, 0.026, 1);
  plate(-chest * 0.42, 0.105, -(chest + 0.004), 0.0095, -1);
}

/**
 * Make a figure. `look` is someone's look, or a key or seed to generate one
 * from. As made, the head is at the origin facing -Z, the body hangs below
 * it and the hands rest at its sides: whoever uses it moves the parts.
 */
export function createFigure(look: Look | string, style: FigureStyle = {}, facts: FigureFacts = {}): Figure {
  const wearing = typeof look === "string" ? generatedLook(look) : look;
  const omit = new Set<string>(style.omit ?? []);
  let [main, accent, light] = [new THREE.Color(wearing.color), new THREE.Color(wearing.accent), new THREE.Color(wearing.light)];
  if (style.palette?.length) {
    const palette = style.palette.map((c) => new THREE.Color(c));
    [main, accent, light] = [nearest(main, palette), nearest(accent, palette), nearest(light, palette)];
  }
  // Under its own material the figure is lit by the shader, so chosen colours are laid on a little darker than chosen.
  const depth = style.material ? 1 : DEPTH;
  const [cloth, trim] = [main.clone().multiplyScalar(depth), accent.clone().multiplyScalar(depth)];
  const builder = () => {
    const b = new MeshBuilder().at();
    b.tone = cloth.clone();
    b.light = light.clone();
    return b;
  };
  const headShape = builder();
  buildHead(headShape, wearing, cloth, trim, omit);
  const bodyShape = builder();
  buildBody(bodyShape, wearing, cloth, trim, omit, facts.proven === true);
  const handShape = builder();
  handShape.lathe([[0.0005, -0.06], [0.04, 0], [0.0005, 0.06]], [0, 0, 0], 4, () => ({ glow: 0.75 }));

  const metal: THREE.Material = style.material
    ? style.material(light, wearing)
    : createAlloy(light, { gloss: wearing.finish === "matte" ? 0.25 : wearing.finish === "gloss" ? 0.85 : 0.7, sheen: wearing.finish === "sheen" ? 0.45 : 0 });
  const geometries = [headShape.geometry(), bodyShape.geometry(), handShape.geometry()] as const;
  const head = new THREE.Group();
  head.add(new THREE.Mesh(geometries[0], metal));
  const torso = new THREE.Mesh(geometries[1], metal);
  torso.position.y = -0.45;
  const hands: [THREE.Mesh, THREE.Mesh] = [new THREE.Mesh(geometries[2], metal), new THREE.Mesh(geometries[2], metal)];
  hands[0].position.set(-0.28, -0.5, -0.12);
  hands[1].position.set(0.28, -0.5, -0.12);
  const group = new THREE.Group();
  group.add(head, torso, ...hands);
  return {
    group,
    head,
    torso,
    hands,
    metal,
    look: wearing,
    tick(t) {
      (metal as Partial<Alloy>).tick?.(t);
    },
    dispose() {
      for (const g of geometries) g.dispose();
      metal.dispose();
    },
  };
}

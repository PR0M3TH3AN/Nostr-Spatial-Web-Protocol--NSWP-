/**
 * nswp-sdk/three — shared presence for Three.js worlds (spec §9.4, §9.8).
 *
 *   const presence = createPresence({ scene, camera, rig, renderer, controllers });
 *   attachRoomControls(presence, { roomButton, micButton, inviteButton, status });
 *   // each frame:
 *   presence.update(dt);
 *
 * It draws other members as avatars (head, body, hands), plays their voices
 * from where they stand, sends your own pose, and keeps personal space.
 *
 * This is the Phase 4b spike: guests only. Joining a room shows your IP
 * address to the other members, so join only after the visitor has agreed.
 */
import * as THREE from "three";
import { decodeLook, encodeNpub, spawnOffset, type Pose, type Transform } from "@nswp/core";
import { createFigure, type Figure, type FigureStyle } from "./figure.js";
import { room, type JoinOptions, type Member, type RoomSession } from "./room.js";

import { turnVisitor } from "./turn.js";
export { turnVisitor } from "./turn.js";
export { createConsole, type XrConsole } from "./console.js";
import type { Controls } from "./ui/model.js";

export interface PresenceOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** The object that moves the visitor around; the camera is inside it. */
  rig: THREE.Object3D;
  renderer: THREE.WebGLRenderer;
  /** XR controller target-ray spaces, as from `renderer.xr.getController(i)`. */
  controllers: THREE.Object3D[];
  /** CSS colour for name labels. */
  labelColor?: string;
  /**
   * The visitor's own look, in its inline form (spec §4.2), for the others in a
   * room to draw them by: usually `arrival.look()`. A function is asked each
   * time a room is joined. Left out, they are drawn as their session key generates.
   */
  look?: string | (() => string | undefined);
  /**
   * Who the visitor is, if they came by name (protocol/10-identity.md):
   * usually `() => arrival.identity()`. Asked each time a room is joined.
   * Left out, they are a guest.
   */
  identity?: JoinOptions["identity"] | (() => JoinOptions["identity"] | undefined);
  /** Draw other people in this world's own way (spec §4.2, "What a world may change"). */
  figureStyle?: FigureStyle;
  /** Called whenever membership, status or the microphone changes. */
  onChange?: () => void;
}

export interface AvatarInfo {
  pubkey: string;
  name: string;
  visible: boolean;
  opacity: number;
  head: number[] | null;
  hands: [boolean, boolean];
  audioLevel: number;
  /** How they are being drawn. */
  look: Member["look"];
  /** True until their pass has checked out. */
  guest: boolean;
  /** The identity key behind them, if proven. */
  identity: string | null;
}

export interface Presence {
  readonly session: RoomSession | null;
  /** The private room's name, or null in a world's open room. */
  readonly roomName: string | null;
  readonly micOn: boolean;
  join(name: string | null): Promise<void>;
  leave(): void;
  setMicrophone(track: MediaStreamTrack | null): Promise<void>;
  /** A quiet test tone to use in place of a microphone. */
  testTone(): MediaStreamTrack;
  /** Tell the others you are recording what you see, or have stopped. They are shown a light on your figure. */
  setRecording(on: boolean): void;
  /** How this visitor looks to the others: for a selfie, or a mirror. */
  selfLook(): Member["look"] | string;
  /** Show for a few seconds where one member is: a column of light over their head. */
  pointOut(pubkey: string): void;
  /** Everyone else in the room, as they are being drawn. */
  people(): Member[];
  /** Call once per frame with the seconds since the last one. */
  update(dt: number): void;
  /** What this visitor currently sees of each member (for tests and debugging). */
  info(): AvatarInfo[];
}

interface Avatar {
  member: Member;
  root: THREE.Group;
  head: THREE.Group;
  torso: THREE.Mesh;
  hands: [THREE.Mesh, THREE.Mesh];
  figure: Figure;
  label: THREE.Sprite;
  /** Shown while they say they are recording. */
  light?: THREE.Sprite;
  /** Shown while they are being pointed out. */
  beam?: THREE.Sprite;
  beamUntil?: number;
  target: Pose | null;
  placed: boolean;
  /** Every material, with its normal opacity, for the personal-space fade. */
  materials: { material: THREE.Material; opacity: number }[];
  audio?: THREE.PositionalAudio;
  element?: HTMLAudioElement;
  analyser?: AnalyserNode;
}

const SEND_EVERY_MS = 66; // 15 poses a second
/** Personal space: avatars fade out between these distances from your head (metres). */
const FADE_START = 0.9;
const FADE_END = 0.45;
/** Two people arriving closer than this are moved apart to ARRIVAL_GAP. */
const TOO_CLOSE = 1.0;
const ARRIVAL_GAP = 1.4;

/** A text panel that always faces the viewer. `width` is in metres. */
export function textSprite(text: string, color: string, width: number): THREE.Sprite {
  const lines = text.split("\n");
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64 + lines.length * 72;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(10,12,18,0.72)";
  g.beginPath();
  g.roundRect(0, 0, canvas.width, canvas.height, 32);
  g.fill();
  g.fillStyle = color;
  g.textBaseline = "top";
  lines.forEach((line, i) => {
    g.font = i === 0 ? "bold 56px system-ui, sans-serif" : "44px system-ui, sans-serif";
    g.fillText(line, 40, 32 + i * 72, canvas.width - 80);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(width, (width * canvas.height) / canvas.width, 1);
  return sprite;
}

export function createPresence(d: PresenceOptions): Presence {
  const labelColor = d.labelColor ?? "#ffffff";
  const changed = () => d.onChange?.();
  const listener = new THREE.AudioListener();
  d.camera.add(listener);

  const avatars = new Map<string, Avatar>();
  const pendingStreams = new Map<string, MediaStream>();
  let session: RoomSession | null = null;
  let roomName: string | null = null;
  let sendTimer: ReturnType<typeof setInterval> | undefined;
  let micTrack: MediaStreamTrack | null = null;
  let offsetApplied = false;
  let plainSeed: string | undefined;

  // A soft dot of light: red over someone recording, in their own colour when they are pointed out.
  let dot: THREE.Texture | null = null;
  const glow = (color: THREE.ColorRepresentation): THREE.Sprite => {
    if (!dot) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const g = canvas.getContext("2d")!;
      const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      fade.addColorStop(0, "rgba(255,255,255,1)");
      fade.addColorStop(0.35, "rgba(255,255,255,0.85)");
      fade.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = fade;
      g.fillRect(0, 0, 64, 64);
      dot = new THREE.CanvasTexture(canvas);
    }
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, depthWrite: false }));
  };
  /** The light that says a member is recording: over their name, where it can't be missed. */
  const showRecording = (a: Avatar, on: boolean) => {
    if (on && !a.light) {
      a.light = glow(0xff3b30);
      a.light.scale.setScalar(0.16);
      a.light.position.set(0, 0.46, 0);
    }
    if (a.light) {
      a.light.visible = on;
      a.head.add(a.light);
    }
  };

  /** Put a member's figure together from how they look, in place of any they had. */
  const dress = (a: Avatar, look: Member["look"]) => {
    const was = a.figure;
    const figure = createFigure(look, d.figureStyle, { proven: !a.member.guest });
    figure.head.position.copy(was?.head.position ?? figure.head.position);
    figure.head.quaternion.copy(was?.head.quaternion ?? figure.head.quaternion);
    figure.head.add(a.label);
    figure.hands.forEach((h, i) => {
      h.visible = was?.hands[i]!.visible ?? false;
      if (was) {
        h.position.copy(was.hands[i]!.position);
        h.quaternion.copy(was.hands[i]!.quaternion);
      }
    });
    if (was) {
      if (a.audio) figure.head.add(a.audio);
      a.root.remove(was.group);
      was.dispose();
    }
    if (a.light) figure.head.add(a.light);
    if (a.beam) figure.head.add(a.beam);
    a.root.add(figure.group);
    a.figure = figure;
    a.head = figure.head;
    a.torso = figure.torso;
    a.hands = figure.hands;
    a.materials = [figure.metal, a.label.material].map((material: THREE.Material) => {
      const opacity = material === a.label.material ? 1 : material.opacity;
      material.transparent = true;
      return { material, opacity };
    });
  };

  const makeAvatar = (member: Member): Avatar => {
    const root = new THREE.Group();
    root.visible = false;
    const label = textSprite(member.name, labelColor, 0.5);
    label.position.set(0, 0.42, 0); // clear of the tallest head with a hat on it
    d.scene.add(root);
    const a = { member, root, label, target: null, placed: false } as unknown as Avatar;
    dress(a, member.look);
    return a;
  };

  const attachAudio = (avatar: Avatar, stream: MediaStream) => {
    if (avatar.audio) return;
    // Chrome only feeds a remote WebRTC stream into Web Audio while it is also
    // attached to a media element, so keep a muted one alongside.
    const el = new Audio();
    el.muted = true;
    el.srcObject = stream;
    void el.play().catch(() => {});
    const pa = new THREE.PositionalAudio(listener);
    pa.setMediaStreamSource(stream);
    pa.setRefDistance(1.5);
    pa.setRolloffFactor(1.2);
    avatar.head.add(pa);
    const analyser = listener.context.createAnalyser();
    analyser.fftSize = 512;
    listener.context.createMediaStreamSource(stream).connect(analyser);
    avatar.audio = pa;
    avatar.element = el;
    avatar.analyser = analyser;
  };

  const removeAvatar = (pubkey: string) => {
    const a = avatars.get(pubkey);
    if (!a) return;
    avatars.delete(pubkey);
    a.audio?.disconnect();
    if (a.element) a.element.srcObject = null;
    d.scene.remove(a.root);
    a.figure.dispose();
  };

  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const worldTransform = (o: THREE.Object3D): Transform => {
    o.getWorldPosition(v);
    o.getWorldQuaternion(q);
    return { position: [v.x, v.y, v.z], quaternion: [q.x, q.y, q.z, q.w] };
  };
  const ownPose = (): Pose => {
    const pose: Pose = { head: worldTransform(d.camera) };
    if (d.renderer.xr.isPresenting) {
      if (d.controllers[0]?.visible) pose.left = worldTransform(d.controllers[0]);
      if (d.controllers[1]?.visible) pose.right = worldTransform(d.controllers[1]);
    }
    return pose;
  };

  /**
   * When someone first appears almost on top of you, one of the pair (the one
   * with the higher session key, so only one moves) steps away. A person in a
   * headset is never moved.
   */
  const stepApart = (self: string, other: string, pose: Pose) => {
    if (self < other || d.renderer.xr.isPresenting) return;
    d.camera.getWorldPosition(v);
    const dx = v.x - pose.head.position[0];
    const dz = v.z - pose.head.position[2];
    const dist = Math.hypot(dx, dz);
    if (dist >= TOO_CLOSE) return;
    const ux = dist > 0.01 ? dx / dist : 1;
    const uz = dist > 0.01 ? dz / dist : 0;
    d.rig.position.x += ux * (ARRIVAL_GAP - dist);
    d.rig.position.z += uz * (ARRIVAL_GAP - dist);
  };

  const leave = () => {
    if (sendTimer) clearInterval(sendTimer);
    sendTimer = undefined;
    session?.leave();
    session = null;
    for (const key of [...avatars.keys()]) removeAvatar(key);
    pendingStreams.clear();
    changed();
  };

  const join = async (name: string | null) => {
    leave();
    roomName = name;
    void listener.context.resume();
    // Joined without a press (kept from the last world, or through a refresh), a browser holds sound back until the
    // visitor touches the page. So the first touch lets the others be heard.
    if (listener.context.state !== "running") {
      const wake = () => {
        void listener.context.resume();
        for (const a of avatars.values()) void a.element?.play().catch(() => {});
        removeEventListener("pointerdown", wake, true);
        removeEventListener("keydown", wake, true);
      };
      addEventListener("pointerdown", wake, true);
      addEventListener("keydown", wake, true);
    }
    const look = typeof d.look === "function" ? d.look() : d.look;
    const identity = typeof d.identity === "function" ? d.identity() : d.identity;
    const s = await room.join({ ...(name ? { name } : {}), ...(look ? { look } : {}), ...(identity ? { identity } : {}) });
    session = s;
    if (!offsetApplied) {
      // Step aside from the spawn point so two people don't arrive inside each other.
      const off = spawnOffset(s.self.pubkey);
      d.rig.position.x += off.x;
      d.rig.position.z += off.z;
      offsetApplied = true;
    }
    s.on("status", changed);
    s.on("recording", (m, on) => {
      const a = avatars.get(m.pubkey);
      if (a) showRecording(a, on);
      changed();
    });
    s.on("look", (m, look) => {
      const a = avatars.get(m.pubkey);
      if (a) dress(a, look);
      changed();
    });
    // A pass checked out, or ran out: their name changes, and so does the frame round their mark.
    s.on("identity", (m) => {
      const a = avatars.get(m.pubkey);
      if (a) {
        const label = textSprite(m.name, labelColor, 0.5);
        label.position.copy(a.label.position);
        a.label.removeFromParent();
        a.label.material.map?.dispose();
        a.label.material.dispose();
        a.label = label;
        dress(a, m.look);
      }
      changed();
    });
    s.on("member", (m) => {
      const a = makeAvatar(m);
      avatars.set(m.pubkey, a);
      const pending = pendingStreams.get(m.pubkey);
      if (pending) attachAudio(a, pending);
      changed();
    });
    s.on("leave", (m) => {
      removeAvatar(m.pubkey);
      pendingStreams.delete(m.pubkey);
      changed();
    });
    s.on("pose", (m, pose) => {
      const a = avatars.get(m.pubkey);
      if (!a) return;
      if (!a.target) stepApart(s.self.pubkey, m.pubkey, pose);
      a.target = pose;
    });
    s.on("audio", (m, stream) => {
      pendingStreams.set(m.pubkey, stream);
      const a = avatars.get(m.pubkey);
      if (a) attachAudio(a, stream);
    });
    if (micTrack) await s.setMicrophone(micTrack);
    sendTimer = setInterval(() => s.sendPose(ownPose()), SEND_EVERY_MS);
    changed();
  };

  const tp = new THREE.Vector3();
  const tq = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const apply = (o: THREE.Object3D, t: Transform, k: number) => {
    o.position.lerp(tp.set(...t.position), k);
    o.quaternion.slerp(tq.set(...t.quaternion), k);
  };

  return {
    get session() {
      return session;
    },
    get roomName() {
      return roomName;
    },
    get micOn() {
      return !!micTrack;
    },
    join,
    leave,
    async setMicrophone(track) {
      if (!track && micTrack) micTrack.stop();
      micTrack = track;
      await session?.setMicrophone(track);
      changed();
    },
    setRecording(on) {
      session?.setRecording(on);
    },
    selfLook() {
      if (session) return session.self.look;
      const mine = typeof d.look === "function" ? d.look() : d.look;
      const read = mine ? decodeLook(mine) : null;
      // Not in a room and wearing nothing: a figure of their own for this visit.
      return read?.ok ? read.value.look : (plainSeed ??= `plain-${Math.random().toString(36).slice(2, 12)}`);
    },
    pointOut(pubkey) {
      const a = avatars.get(pubkey);
      if (!a) return;
      if (!a.beam) {
        a.beam = glow(a.member.look.light);
        a.beam.scale.set(0.5, 3.2, 1);
        a.beam.position.set(0, 2.1, 0);
      }
      a.head.add(a.beam);
      a.beam.visible = true;
      a.beamUntil = performance.now() + 4000;
    },
    people() {
      return [...avatars.values()].map((a) => a.member);
    },
    testTone() {
      const ctx = listener.context;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      return dest.stream.getAudioTracks()[0]!;
    },
    update(dt) {
      const k = 1 - Math.exp(-dt * 14);
      d.camera.getWorldPosition(v);
      for (const a of avatars.values()) {
        if (!a.target) continue;
        // Personal space: nobody's avatar can fill your view.
        const near = THREE.MathUtils.clamp((a.head.position.distanceTo(v) - FADE_END) / (FADE_START - FADE_END), 0, 1);
        for (const m of a.materials) m.material.opacity = m.opacity * near;
        (a.materials[0]!.material as { tick?: (t: number) => void }).tick?.(performance.now() / 1000);
        if (a.beam?.visible && performance.now() > (a.beamUntil ?? 0)) a.beam.visible = false;
        const snap = a.placed ? k : 1;
        apply(a.head, a.target.head, snap);
        a.placed = true;
        a.root.visible = true;
        euler.setFromQuaternion(a.head.quaternion, "YXZ");
        a.torso.position.set(a.head.position.x, a.head.position.y - 0.45, a.head.position.z);
        a.torso.rotation.set(0, euler.y, 0);
        const hands = [a.target.left, a.target.right] as const;
        hands.forEach((t, i) => {
          const mesh = a.hands[i as 0 | 1];
          if (t) {
            apply(mesh, t, mesh.visible ? k : 1);
            mesh.visible = true;
          } else mesh.visible = false;
        });
      }
    },
    info() {
      const buf = new Float32Array(512);
      return [...avatars.values()].map((a) => {
        let level = 0;
        if (a.analyser) {
          a.analyser.getFloatTimeDomainData(buf);
          level = Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length);
        }
        return {
          pubkey: a.member.pubkey,
          name: a.member.name,
          visible: a.root.visible,
          opacity: Math.round((a.materials[0]?.material.opacity ?? 1) * 100) / 100,
          head: a.target?.head.position.map((n) => Math.round(n * 100) / 100) ?? null,
          hands: [!!a.target?.left, !!a.target?.right] as [boolean, boolean],
          audioLevel: Math.round(level * 1000) / 1000,
          look: a.member.look,
          guest: a.member.guest,
          identity: a.member.identity ?? null,
        };
      });
    },
  };
}

// ------------------------------------------------------------ page controls

function roomNameFromHash(hash: string): string | null {
  for (const part of hash.replace(/^#/, "").split("&")) {
    if (part.startsWith("room=")) {
      try {
        const v = decodeURIComponent(part.slice(5));
        if (/^[A-Za-z0-9_-]{4,48}$/.test(v)) return v;
      } catch {
        /* not a room name */
      }
    }
  }
  return null;
}

export interface CaptureOptions {
  /** Width of the panorama in pixels; the height is half of it. Default 2048, at most 4096. */
  width?: number;
  /** Objects to leave out, such as text that is specific to one visitor. */
  hide?: THREE.Object3D[];
  /** WebP quality from 0 to 1. Default 0.82. */
  quality?: number;
}

/**
 * Capture a world's preview (spec §5.8): a 360° still, twice as wide as tall,
 * taken from `position` (use the default entry point, at eye height). The
 * centre of the image is the view along -Z from there.
 *
 * Returns a WebP file. Publish it by hash; the announcement's `preview` tag
 * carries the address, the type `pano`, the SHA-256 and the dimensions.
 */
export async function capturePanorama(renderer: THREE.WebGLRenderer, scene: THREE.Scene, position: THREE.Vector3, opts: CaptureOptions = {}): Promise<Blob> {
  const width = Math.min(4096, Math.max(256, Math.round(opts.width ?? 2048)));
  const height = width / 2;
  const hidden = (opts.hide ?? []).filter((o) => o.visible);
  const xrWasEnabled = renderer.xr.enabled;
  const previousTarget = renderer.getRenderTarget();
  const autoClearWas = renderer.autoClear;
  // Fog is worked out per camera direction, so each of the six views would fade
  // differently and leave seams. A preview is taken without it.
  const fog = scene.fog;
  // Six ordinary 90° views, one at a time, each painted onto the part of the
  // panorama it covers. (Half-float, so dark scenes don't band on the way.)
  const faceTarget = new THREE.WebGLRenderTarget(Math.min(2048, width / 2), Math.min(2048, width / 2), { type: THREE.HalfFloatType });
  const flatTarget = new THREE.WebGLRenderTarget(width, height);
  flatTarget.texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { face: { value: faceTarget.texture }, forward: { value: new THREE.Vector3() }, up: { value: new THREE.Vector3() }, right: { value: new THREE.Vector3() } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D face; uniform vec3 forward; uniform vec3 up; uniform vec3 right; varying vec2 vUv;
      void main(){
        float lon = (vUv.x - 0.5) * 6.283185307179586;
        float lat = (vUv.y - 0.5) * 3.141592653589793;
        vec3 dir = vec3(sin(lon) * cos(lat), sin(lat), -cos(lon) * cos(lat));
        float along = dot(dir, forward);
        // Only the directions this view is the best one for (with a hair of overlap).
        if (along < max(abs(dir.x), max(abs(dir.y), abs(dir.z))) - 0.0005) discard;
        vec2 p = vec2(dot(dir, right), dot(dir, up)) / along;
        gl_FragColor = texture2D(face, clamp(p * 0.5 + 0.5, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const faceCamera = new THREE.PerspectiveCamera(90, 1, 0.05, 700);
  faceCamera.position.copy(position);
  // [looking along, with this way up]
  const views: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
    [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
    [new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)],
  ];
  try {
    for (const o of hidden) o.visible = false;
    scene.fog = null;
    renderer.xr.enabled = false; // a capture is never an XR frame
    renderer.setRenderTarget(flatTarget);
    renderer.clear();
    for (const [forward, up] of views) {
      faceCamera.up.copy(up);
      faceCamera.lookAt(position.clone().add(forward));
      faceCamera.updateMatrixWorld(true);
      renderer.autoClear = true;
      renderer.setRenderTarget(faceTarget);
      renderer.render(scene, faceCamera);
      material.uniforms.forward!.value.copy(forward);
      material.uniforms.up!.value.copy(up);
      material.uniforms.right!.value.crossVectors(forward, up);
      renderer.autoClear = false;
      renderer.setRenderTarget(flatTarget);
      renderer.render(quadScene, quadCamera);
    }
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(flatTarget, 0, 0, width, height, pixels);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d")!;
    const image = g.createImageData(width, height);
    // WebGL rows run bottom-up; images run top-down.
    for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
    g.putImageData(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", opts.quality ?? 0.82));
    if (!blob) throw new Error("nswp-sdk: this browser couldn't encode the preview");
    return blob;
  } finally {
    for (const o of hidden) o.visible = true;
    scene.fog = fog;
    renderer.xr.enabled = xrWasEnabled;
    renderer.autoClear = autoClearWas;
    renderer.setRenderTarget(previousTarget);
    faceTarget.dispose();
    flatTarget.dispose();
    material.dispose();
    quad.geometry.dispose();
  }
}

/** Prepare a loaded panorama image for use in a portal window. */
export function panoramaTexture(image: TexImageSource): THREE.Texture {
  const texture = new THREE.Texture(image as HTMLImageElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  // No mipmaps: the wrap-around behind the viewer would show as a seam.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export interface PortalWindowOptions {
  /** An alpha texture that cuts the window's shape (an arch, say) out of the geometry. */
  mask?: THREE.Texture;
  /**
   * How far back, at most, the view is taken from, in metres (default 1.5).
   * A true window seen from across a room shows only a sliver of what is
   * behind it, which for a preview is usually nothing recognisable. So the
   * view is worked out as if the viewer stood no further away than this:
   * from a distance they see a wide view, and close up it behaves like a real
   * window. `Infinity` gives a true window at every distance.
   */
  reach?: number;
}

/**
 * A window into a panorama: the mesh shows the part of the destination that
 * lies behind it from where the viewer stands, so the view shifts as they
 * move, like looking through a doorway. The mesh's local -Z is "into" the
 * destination and lines up with the centre of the panorama.
 */
export function createPortalWindow(geometry: THREE.BufferGeometry, pano: THREE.Texture, opts: PortalWindowOptions = {}): THREE.Mesh {
  const reach = opts.reach ?? 1.5;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pano: { value: pano },
      mask: { value: opts.mask ?? null },
      useMask: { value: opts.mask ? 1 : 0 },
      toLocal: { value: new THREE.Matrix3() },
      center: { value: new THREE.Vector3() },
      reach: { value: Number.isFinite(reach) ? reach : 0 },
    },
    vertexShader: `varying vec3 vWorld; varying vec2 vUv;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D pano; uniform sampler2D mask; uniform float useMask; uniform mat3 toLocal; uniform vec3 center; uniform float reach;
      varying vec3 vWorld; varying vec2 vUv;
      void main(){
        if (useMask > 0.5 && texture2D(mask, vUv).a < 0.5) discard;
        vec3 eye = cameraPosition;
        if (reach > 0.0) {
          vec3 away = cameraPosition - center;
          eye = center + away * (reach / (length(away) + reach));
        }
        vec3 dir = normalize(toLocal * (vWorld - eye));
        float lon = atan(dir.x, -dir.z);
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        gl_FragColor = vec4(texture2D(pano, vec2(lon / 6.283185307179586 + 0.5, lat / 3.141592653589793 + 0.5)).rgb, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const rotation = new THREE.Matrix4();
  mesh.onBeforeRender = () => {
    rotation.extractRotation(mesh.matrixWorld);
    (material.uniforms.toLocal!.value as THREE.Matrix3).setFromMatrix4(rotation).invert();
    (material.uniforms.center!.value as THREE.Vector3).setFromMatrixPosition(mesh.matrixWorld);
  };
  return mesh;
}

/**
 * A room's controls, added to a world's controls (ui/model.ts): join or leave,
 * the microphone, and a private room to invite someone to. The HUD and the
 * headset console both draw them from there, so neither has room logic of its own.
 *
 * Joining shows a visitor's IP address to the others in the room. The Room
 * section says so before they join, on a flat screen and in a headset.
 */
export interface Travelling {
  /** They are in this place's open room. A private room doesn't travel: the next place's open room is other people. */
  joined: boolean;
  /** Their microphone is on. */
  mic: boolean;
}

/** Where a page keeps whether its visitor was joined, so a refresh doesn't put them out of the room. This tab only. */
const JOINED_KEY = () => `nswp:joined:${location.pathname}`;

export function addRoomControls(
  controls: Controls,
  presence: Presence,
  opts: {
    search?: string;
    onState?: (state: Record<string, unknown> | null) => void;
    /**
     * The visitor arrived joined: their own client says they were among people where they came from
     * (`arrival.read().context`, its `joined` and `mic`). The open room is joined without asking again.
     */
    arrived?: { joined?: boolean; mic?: boolean } | null;
  } = {},
): { refresh(): void; travelling(): Travelling } {
  const useTone = new URLSearchParams(opts.search ?? location.search).get("mic") === "tone";
  let invited = roomNameFromHash(location.hash);
  let busy = false;
  let last = invited
    ? "You were invited to a private room. Joining shows your IP address to the others in it."
    : "Joining lets you see and hear others here. It shows your IP address to them.";
  const tell = (text: string) => {
    last = text;
    controls.say(text);
  };
  const status = () => {
    const s = presence.session;
    if (!s) return last;
    const others = s.members.length;
    const who = s.status === "no-relays" ? "can't reach any relay" : others === 0 ? "nobody else here yet" : others === 1 ? "1 other person here" : `${others} other people here`;
    // Say how the others see this visitor: by a name their own client vouched for, or as a guest.
    const as = s.self.guest ? "" : ` You are here as ${s.self.name}.`;
    return `${presence.roomName ? "Private room" : "Open room"}: ${who}.${as}${presence.micOn ? " Your microphone is on." : ""}`;
  };
  const refresh = () => {
    const s = presence.session;
    opts.onState?.(
      s ? { name: s.name, private: !!presence.roomName, status: s.status, self: s.self.pubkey, members: s.members.map((m) => m.pubkey), relays: s.relayCount, mic: presence.micOn } : null,
    );
    controls.addSection({ id: "room", label: "Room", icon: "room", note: status });
    people();
    remember();
  };
  // What a refresh needs to put the visitor back among the people they were with.
  const remember = () => {
    try {
      if (presence.session) sessionStorage.setItem(JOINED_KEY(), presence.micOn ? "mic" : "joined");
      else if (!busy) sessionStorage.removeItem(JOINED_KEY());
    } catch {
      /* no storage: a refresh leaves the room, as before */
    }
  };
  const microphone = async (): Promise<boolean> => {
    try {
      const track = useTone
        ? presence.testTone()
        : (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })).getAudioTracks()[0]!;
      await presence.setMicrophone(track);
      return true;
    } catch {
      return false;
    }
  };
  // Who else is here: one entry each, in their own colour. Selecting one shows where they are.
  let listed: string[] = [];
  const recorders = new Set<string>();
  const people = () => {
    const here = presence.session ? presence.people() : [];
    for (const id of listed) controls.remove(id);
    listed = here.map((m) => `person-${m.pubkey.slice(0, 12)}`);
    controls.addSection({
      id: "people",
      label: "People",
      icon: "people",
      note: () => (!presence.session ? "Join the room to see who else is here." : here.length === 0 ? "Nobody else is here yet." : `${here.length === 1 ? "1 person is" : `${here.length} people are`} here with you. Select one to see where they are.`),
    });
    here.forEach((m, i) =>
      controls.add({
        id: listed[i]!,
        section: "people",
        kind: "swatch",
        color: m.look.light,
        label: () => (m.recording ? `${m.name}, recording` : m.name),
        act: () => {
          presence.pointOut(m.pubkey);
          // A name is not unique and a mark can be matched, so the key behind a name is one action away, in full.
          controls.say(m.identity ? `${m.name} is under the column of light. Their key: ${encodeNpub(m.identity)}` : `${m.name} is under the column of light. A guest: nobody has vouched for who they are.`);
        },
      }),
    );
    // Say it once when someone starts recording: a light alone is easy to miss.
    for (const m of here) {
      if (m.recording && !recorders.has(m.pubkey)) controls.say(`${m.name} is recording what they see.`);
      if (m.recording) recorders.add(m.pubkey);
      else recorders.delete(m.pubkey);
    }
  };

  controls.add(
    {
      id: "room-join",
      section: "room",
      hotbar: true,
      icon: () => (presence.session ? "leave" : "room"),
      label: () => (presence.session ? "Leave the room" : "Join the room"),
      short: () => (presence.session ? "Leave" : "Join"),
      on: () => !!presence.session,
      hidden: () => busy,
      act: async () => {
        if (presence.session) {
          presence.leave();
          tell("You left the room.");
          return refresh();
        }
        busy = true;
        try {
          await presence.join(invited);
        } catch (err) {
          tell(`Couldn't join: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          busy = false;
          refresh();
        }
      },
    },
    {
      id: "room-mic",
      section: "room",
      hotbar: true,
      icon: () => (presence.micOn ? "mic" : "micOff"),
      label: () => (presence.micOn ? "Turn microphone off" : "Turn microphone on"),
      short: "Mic",
      on: () => presence.micOn,
      hidden: () => !presence.session,
      act: async () => {
        if (presence.micOn) await presence.setMicrophone(null);
        else if (!(await microphone())) tell("The microphone is blocked or unavailable.");
        refresh();
      },
    },
    {
      id: "room-invite",
      section: "room",
      icon: "link",
      label: () => (presence.roomName ? "Copy invite link" : "Make a private room"),
      hidden: () => !presence.session,
      act: async () => {
        if (!presence.roomName) {
          const bytes = crypto.getRandomValues(new Uint8Array(9));
          const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
          history.replaceState(history.state, "", `${location.pathname}${location.search}#room=${code}`);
          invited = code;
          await presence.join(code);
        }
        try {
          await navigator.clipboard.writeText(location.href);
          tell("Invite link copied. Anyone with it can join.");
        } catch {
          tell("Copy this page's address to invite someone.");
        }
        refresh();
      },
    },
  );
  // Staying joined. Two ways a visitor is in the room without pressing Join here: their own client brought them
  // from a place where they were joined, or this page was refreshed while they were. Either way they are told at
  // once, and Leave is where Join was.
  let kept: string | null = null;
  try {
    kept = wasRefreshed() ? sessionStorage.getItem(JOINED_KEY()) : null;
  } catch {
    /* no storage */
  }
  refresh();
  const carried = opts.arrived?.joined ? { mic: !!opts.arrived.mic, from: "there" as const } : kept ? { mic: kept === "mic", from: "refresh" as const } : null;
  // A private room is entered by its link, never by a hint: arriving joined means the open room, and a visitor
  // holding an invitation who wasn't in the room is still asked.
  if (carried && (carried.from === "refresh" || !invited)) {
    busy = true;
    void (async () => {
      try {
        await presence.join(carried.from === "refresh" ? invited : null);
        const heard = carried.mic ? await microphone() : false;
        tell(
          `You are still in the room${carried.from === "there" ? ", as you were where you came from" : ""}: others here can see you${heard ? " and hear you" : ""}.${carried.mic && !heard ? " Your microphone is off here: the browser didn't allow it." : ""} Leave is where Join was.`,
        );
      } catch (err) {
        tell(`Couldn't stay joined: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        busy = false;
        refresh();
      }
    })();
  }

  return { refresh, travelling: () => ({ joined: !!presence.session && !presence.roomName, mic: !!presence.session && !presence.roomName && presence.micOn }) };
}

/**
 * The controls every world's view needs: enter or leave VR, and turn around.
 * Returns whether this device can enter VR at all.
 *
 * It also hides the flat HUD while a headset session runs. The page can't be
 * seen from inside one, and the console takes over.
 */
/**
 * The one thing asked of someone who has just arrived from a headset session:
 * a large way back in, over everything, that one press answers either way.
 * A browser won't let a page start a headset session unasked, so this is the
 * least that can be asked (protocol/02-doors.md).
 */
function offerHeadset(title: string, enter: () => void, stay: () => void): { remove(): void } {
  const scrim = document.createElement("div");
  scrim.id = "nswp-enter";
  scrim.setAttribute("role", "dialog");
  scrim.setAttribute("aria-label", `You've arrived at ${title}`);
  Object.assign(scrim.style, { position: "fixed", inset: "0", zIndex: "50", display: "grid", placeContent: "center", justifyItems: "center", gap: "18px", padding: "24px", background: "rgba(4, 7, 11, 0.62)", textAlign: "center" });
  const heading = document.createElement("p");
  heading.textContent = title;
  Object.assign(heading.style, { margin: "0", font: "700 clamp(28px, 6vw, 56px)/1.1 system-ui, sans-serif", color: "#eef5fb" });
  const go = document.createElement("button");
  go.type = "button";
  go.id = "nswp-enter-vr";
  go.textContent = "Enter VR";
  // Large enough to hit with a controller's ray on a headset's flat panel, first try.
  Object.assign(go.style, { font: "700 clamp(24px, 5vw, 40px)/1 system-ui, sans-serif", minWidth: "min(78vw, 520px)", minHeight: "120px", padding: "0 32px", border: "0", borderRadius: "18px", background: "#eef5fb", color: "#04070b", cursor: "pointer" });
  const flat = document.createElement("button");
  flat.type = "button";
  flat.id = "nswp-enter-flat";
  flat.textContent = "Look around on this screen";
  Object.assign(flat.style, { font: "500 18px/1 system-ui, sans-serif", padding: "14px 20px", border: "0", background: "none", color: "#eef5fb", textDecoration: "underline", cursor: "pointer" });
  scrim.append(heading, go, flat);
  const remove = () => {
    removeEventListener("keydown", onKey);
    scrim.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") stay();
  };
  go.addEventListener("click", enter);
  flat.addEventListener("click", stay);
  addEventListener("keydown", onKey);
  document.body.append(scrim);
  go.focus();
  return { remove };
}

export async function addViewControls(
  controls: Controls,
  d: {
    renderer: THREE.WebGLRenderer;
    rig: THREE.Object3D;
    camera: THREE.Camera;
    hud?: { setHidden(hidden: boolean): void };
    onState?: (state: string) => void;
    /**
     * The visitor left a headset session to come here (`arrival.read().context?.immersive`,
     * or however a client knows). They are offered the way back in before anything else.
     */
    arrived?: { title: string };
    /** The offer above has gone up, or been answered. */
    onOffer?: (showing: boolean) => void;
  },
): Promise<boolean> {
  const xr = navigator.xr;
  let supported = false;
  try {
    supported = xr ? await xr.isSessionSupported("immersive-vr") : false;
  } catch {
    /* stays false */
  }
  const presenting = () => d.renderer.xr.isPresenting;
  d.renderer.xr.addEventListener("sessionstart", () => d.hud?.setHidden(true));
  d.renderer.xr.addEventListener("sessionend", () => d.hud?.setHidden(false));
  let offer: { remove(): void } | null = null;
  const answered = () => {
    if (!offer) return;
    offer.remove();
    offer = null;
    d.onOffer?.(false);
  };
  const enter = async () => {
    if (presenting()) return;
    try {
      const session = await xr!.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "hand-tracking"] });
      await d.renderer.xr.setSession(session);
      d.onState?.("presenting");
      session.addEventListener("end", () => d.onState?.("ended"));
      answered();
    } catch (err) {
      d.onState?.(`error: ${err instanceof Error ? err.message : String(err)}`);
      controls.say("Couldn't start VR on this device.");
    }
  };
  // Where a browser lets a headset session carry on across a crossing, it says so with this event, and
  // nothing need be asked at all. It is a proposal that few browsers have; everywhere else, nothing happens.
  try {
    (xr as unknown as EventTarget | undefined)?.addEventListener?.("sessiongranted", () => void enter());
  } catch {
    /* not offered here */
  }
  if (supported && d.arrived && !presenting()) {
    offer = offerHeadset(d.arrived.title, () => void enter(), answered);
    d.onOffer?.(true);
  }
  controls.add(
    {
      id: "vr",
      section: "view",
      icon: "vr",
      tone: "primary",
      hotbar: true,
      hidden: () => !supported,
      label: () => (presenting() ? "Leave VR" : "Enter VR"),
      short: "VR",
      act: async () => {
        if (presenting()) return void (await d.renderer.xr.getSession()?.end());
        await enter();
      },
    },
    { id: "turn", section: "view", icon: "turn", label: "Turn around", act: () => turnVisitor(d.rig, d.camera, 180) },
  );
  controls.addSection({
    id: "view",
    label: "View",
    icon: "vr",
    note: supported ? "In a headset, raise your wrist or select the small Menu button low in front of you to reach these controls." : "This device can't enter VR. Everything here works without it.",
  });
  return supported;
}

export { createFigure, type Figure, type FigureFacts, type FigureStyle } from "./figure.js";
export { createXrInput, type GrabOptions, type XrInput, type XrInputInfo, type XrInputOptions } from "./input.js";
export { DEFAULT_COMFORT, readPad, type Comfort, type PadState } from "./actions.js";
export { addPanelControls, createPanels, type Panel, type PanelContent, type PanelInfo, type Panels, type PanelsOptions } from "./panels.js";
export { LIBRARY_LIMITS, PANEL_LIMITS, PANEL_LOOKS, type LibraryItem, type PanelLook, type PanelPlace, type PanelRecord, type PanelSource } from "./panel-store.js";
import { wasRefreshed } from "./stay.js";
export { createStay, wasRefreshed, type Stay, type Stood } from "./stay.js";
export { createStroll, reachOf, TAP_REACH, WALK_SPEED, type Stroll } from "./stroll.js";
export { browserVoice, computerVoice, createVoice, recordVoice, toPcm16, type Hearing, type Voice, type VoiceSource, type VoiceState } from "./speech.js";
export { createKeyboard, type AskOptions, type Keyboard, type KeyboardOptions } from "./keyboard.js";
export { createLibrary, type Library, type LibraryOptions } from "./library.js";
export { createChamber, createCrossing, type ArriveOptions, type Chamber, type Crossing, type CrossingOptions, type CrossingState } from "./chamber.js";

export { addCameraControls, canRecord, recordClip, saveFile, takePicture, takeSelfie, type Camera, type CameraOptions, type Capture, type Clip } from "./camera.js";

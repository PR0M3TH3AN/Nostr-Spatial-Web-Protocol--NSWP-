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
import { spawnOffset, type Pose, type Transform } from "@nswp/core";
import { createFigure, type Figure, type FigureStyle } from "./figure.js";
import { room, type Member, type RoomSession } from "./room.js";

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

  /** Put a member's figure together from how they look, in place of any they had. */
  const dress = (a: Avatar, look: Member["look"]) => {
    const was = a.figure;
    const figure = createFigure(look, d.figureStyle);
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
    label.position.set(0, 0.3, 0);
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
    const look = typeof d.look === "function" ? d.look() : d.look;
    const s = await room.join({ ...(name ? { name } : {}), ...(look ? { look } : {}) });
    session = s;
    if (!offsetApplied) {
      // Step aside from the spawn point so two people don't arrive inside each other.
      const off = spawnOffset(s.self.pubkey);
      d.rig.position.x += off.x;
      d.rig.position.z += off.z;
      offsetApplied = true;
    }
    s.on("status", changed);
    s.on("look", (m, look) => {
      const a = avatars.get(m.pubkey);
      if (a) dress(a, look);
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
export function addRoomControls(controls: Controls, presence: Presence, opts: { search?: string; onState?: (state: Record<string, unknown> | null) => void } = {}): { refresh(): void } {
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
    return `${presence.roomName ? "Private room" : "Open room"}: ${who}.${presence.micOn ? " Your microphone is on." : ""}`;
  };
  const refresh = () => {
    const s = presence.session;
    opts.onState?.(
      s ? { name: s.name, private: !!presence.roomName, status: s.status, self: s.self.pubkey, members: s.members.map((m) => m.pubkey), relays: s.relayCount, mic: presence.micOn } : null,
    );
    controls.addSection({ id: "room", label: "Room", icon: "room", note: status });
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
        else {
          try {
            const track = useTone
              ? presence.testTone()
              : (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })).getAudioTracks()[0]!;
            await presence.setMicrophone(track);
          } catch {
            tell("The microphone is blocked or unavailable.");
          }
        }
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
  refresh();
  return { refresh };
}

/**
 * The controls every world's view needs: enter or leave VR, and turn around.
 * Returns whether this device can enter VR at all.
 *
 * It also hides the flat HUD while a headset session runs. The page can't be
 * seen from inside one, and the console takes over.
 */
export async function addViewControls(
  controls: Controls,
  d: { renderer: THREE.WebGLRenderer; rig: THREE.Object3D; camera: THREE.Camera; hud?: { setHidden(hidden: boolean): void }; onState?: (state: string) => void },
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
        try {
          const session = await xr!.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "hand-tracking"] });
          await d.renderer.xr.setSession(session);
          d.onState?.("presenting");
          session.addEventListener("end", () => d.onState?.("ended"));
        } catch (err) {
          d.onState?.(`error: ${err instanceof Error ? err.message : String(err)}`);
          controls.say("Couldn't start VR on this device.");
        }
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

export { createFigure, type Figure, type FigureStyle } from "./figure.js";

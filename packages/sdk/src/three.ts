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
import { room, type Member, type RoomSession } from "./room.js";

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

  const makeAvatar = (member: Member): Avatar => {
    const color = new THREE.Color(member.color);
    const root = new THREE.Group();
    root.visible = false;
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.2, metalness: 0.6 }));
    visor.position.set(0, 0.02, -0.1); // the face looks down -Z, like a camera
    const label = textSprite(member.name, labelColor, 0.5);
    label.position.set(0, 0.3, 0);
    head.add(skull, visor, label);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.5, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity: 0.85 }));
    const handGeo = new THREE.SphereGeometry(0.045, 12, 8);
    const handMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    const hands: [THREE.Mesh, THREE.Mesh] = [new THREE.Mesh(handGeo, handMat), new THREE.Mesh(handGeo, handMat)];
    hands.forEach((h) => (h.visible = false));
    root.add(head, torso, ...hands);
    d.scene.add(root);
    const materials = [skull.material, visor.material, torso.material, handMat, label.material].map((material) => {
      const opacity = material.opacity;
      material.transparent = true;
      return { material, opacity };
    });
    return { member, root, head, torso, hands, target: null, placed: false, materials };
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
    const s = await room.join(name ? { name } : {});
    session = s;
    if (!offsetApplied) {
      // Step aside from the spawn point so two people don't arrive inside each other.
      const off = spawnOffset(s.self.pubkey);
      d.rig.position.x += off.x;
      d.rig.position.z += off.z;
      offsetApplied = true;
    }
    s.on("status", changed);
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
        };
      });
    },
  };
}

// ------------------------------------------------------------ page controls

export interface RoomControls {
  roomButton: HTMLButtonElement;
  micButton: HTMLButtonElement;
  inviteButton: HTMLButtonElement;
  /** Where room status is written. Give it `role="status"`. */
  status: HTMLElement;
  /** `?mic=tone` uses a test tone instead of asking for the microphone. */
  search?: string;
  /** Called with a small summary whenever the room changes (for tests). */
  onState?: (state: Record<string, unknown> | null) => void;
}

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

/**
 * Wires a page's Join / microphone / invite buttons to a presence. Nothing
 * connects until Join is pressed, because joining shows the visitor's IP
 * address to the other members. Voice has to be switched on from the page,
 * before entering VR.
 *
 * Wrap the returned `refresh` into the presence's `onChange`.
 */
export function attachRoomControls(presence: Presence, c: RoomControls): { refresh(): void } {
  const useTone = new URLSearchParams(c.search ?? location.search).get("mic") === "tone";
  let invited = roomNameFromHash(location.hash);
  let note = "";

  const refresh = () => {
    const s = presence.session;
    c.onState?.(
      s
        ? { name: s.name, private: !!presence.roomName, status: s.status, self: s.self.pubkey, members: s.members.map((m) => m.pubkey), relays: s.relayCount, mic: presence.micOn }
        : null,
    );
    c.roomButton.textContent = s ? "Leave the room" : "Join the room";
    c.micButton.hidden = !s;
    c.inviteButton.hidden = !s;
    c.micButton.textContent = presence.micOn ? "Turn microphone off" : "Turn microphone on";
    c.inviteButton.textContent = presence.roomName ? "Copy invite link" : "Make a private room";
    if (!s) return;
    const others = s.members.length;
    const who =
      s.status === "no-relays" ? "can't reach any relay" : others === 0 ? "nobody else here yet" : others === 1 ? "1 other person here" : `${others} other people here`;
    c.status.textContent = `${presence.roomName ? "Private room" : "Open room"}: ${who}.${note ? ` ${note}` : ""}`;
  };

  c.roomButton.addEventListener("click", () => {
    if (presence.session) {
      presence.leave();
      note = "";
      refresh();
      c.status.textContent = "You left the room.";
      return;
    }
    c.roomButton.disabled = true;
    presence
      .join(invited)
      .then(refresh)
      .catch((err) => {
        c.status.textContent = `Couldn't join: ${err instanceof Error ? err.message : String(err)}`;
      })
      .finally(() => (c.roomButton.disabled = false));
  });

  c.micButton.addEventListener("click", async () => {
    if (!presence.session) return;
    if (presence.micOn) {
      await presence.setMicrophone(null);
      note = "";
    } else {
      try {
        const track = useTone
          ? presence.testTone()
          : (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })).getAudioTracks()[0]!;
        await presence.setMicrophone(track);
        note = "Your microphone is on.";
      } catch {
        note = "The microphone is blocked or unavailable.";
      }
    }
    refresh();
  });

  c.inviteButton.addEventListener("click", async () => {
    if (!presence.session) return;
    if (!presence.roomName) {
      const bytes = crypto.getRandomValues(new Uint8Array(9));
      const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
      history.replaceState(history.state, "", `${location.pathname}${location.search}#room=${code}`);
      invited = code;
      await presence.join(code);
    }
    try {
      await navigator.clipboard.writeText(location.href);
      note = "Invite link copied. Anyone with it can join.";
    } catch {
      note = "Copy this page's address to invite someone.";
    }
    refresh();
  });

  if (invited) c.status.textContent = "You were invited to a private room. Joining shows your IP address to the others in it.";
  refresh();
  return { refresh };
}

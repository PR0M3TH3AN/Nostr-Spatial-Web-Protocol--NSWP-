/**
 * Shared presence for the reference worlds: the room spike (spec §9.4).
 *
 * Nothing connects until the visitor presses "Join the room", because a
 * peer-to-peer room shows each member's IP address to the others.
 * Voice has to be switched on from the 2D page, before entering VR.
 */
import * as THREE from "three";
import { room, type Member, type Pose, type RoomSession, type Transform } from "nswp-sdk";
import { spawnOffset } from "@nswp/core";
import { textSprite } from "./text.js";

export interface PresenceDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: THREE.Group;
  renderer: THREE.WebGLRenderer;
  controllers: THREE.Group[];
  textColor: string;
  state: Record<string, unknown>;
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

export function setupPresence(d: PresenceDeps): { update(dt: number): void; info(): unknown } {
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const roomButton = $("room-button") as HTMLButtonElement;
  const micButton = $("mic-button") as HTMLButtonElement;
  const inviteButton = $("invite-button") as HTMLButtonElement;
  const status = $("room-status");

  const params = new URLSearchParams(location.search);
  const listener = new THREE.AudioListener();
  d.camera.add(listener);

  const avatars = new Map<string, Avatar>();
  const pendingStreams = new Map<string, MediaStream>();
  let session: RoomSession | null = null;
  let sendTimer: ReturnType<typeof setInterval> | undefined;
  let micTrack: MediaStreamTrack | null = null;
  let offsetApplied = false;
  let note = "";

  const roomNameFromHash = (): string | null => {
    for (const part of location.hash.replace(/^#/, "").split("&")) {
      if (part.startsWith("room=")) {
        const v = decodeURIComponent(part.slice(5));
        if (/^[A-Za-z0-9_-]{4,48}$/.test(v)) return v;
      }
    }
    return null;
  };
  let privateName = roomNameFromHash();

  const render = () => {
    const others = session?.members.length ?? 0;
    d.state.room = session
      ? { name: session.name, private: !!privateName, status: session.status, self: session.self.pubkey, members: session.members.map((m) => m.pubkey), relays: session.relayCount, mic: !!micTrack }
      : null;
    if (!session) return;
    const where = privateName ? "Private room" : "Open room";
    const who =
      session.status === "no-relays"
        ? "can't reach any relay"
        : others === 0
          ? "nobody else here yet"
          : others === 1
            ? "1 other person here"
            : `${others} other people here`;
    status.textContent = `${where}: ${who}.${note ? ` ${note}` : ""}`;
  };

  // ----------------------------------------------------------- avatars
  const makeAvatar = (member: Member): Avatar => {
    const color = new THREE.Color(member.color);
    const root = new THREE.Group();
    root.visible = false;
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.2, metalness: 0.6 }));
    visor.position.set(0, 0.02, -0.1); // the face looks down -Z, like a camera
    const label = textSprite(member.name, d.textColor, 0.5);
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

  // --------------------------------------------------------- own pose
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
   * with the higher session key, so only one moves) steps away.
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

  // ------------------------------------------------------ join / leave
  const leave = () => {
    if (sendTimer) clearInterval(sendTimer);
    session?.leave();
    session = null;
    for (const key of [...avatars.keys()]) removeAvatar(key);
    pendingStreams.clear();
  };

  const join = async (name: string | null) => {
    leave();
    privateName = name;
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
    s.on("status", render);
    s.on("member", (m) => {
      const a = makeAvatar(m);
      avatars.set(m.pubkey, a);
      const pending = pendingStreams.get(m.pubkey);
      if (pending) attachAudio(a, pending);
      render();
    });
    s.on("leave", (m) => {
      removeAvatar(m.pubkey);
      pendingStreams.delete(m.pubkey);
      render();
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
    roomButton.textContent = "Leave the room";
    micButton.hidden = false;
    inviteButton.hidden = false;
    inviteButton.textContent = name ? "Copy invite link" : "Make a private room";
    render();
  };

  roomButton.addEventListener("click", () => {
    if (session) {
      leave();
      roomButton.textContent = "Join the room";
      micButton.hidden = true;
      inviteButton.hidden = true;
      status.textContent = "You left the room.";
      d.state.room = null;
      return;
    }
    roomButton.disabled = true;
    join(privateName)
      .catch((err) => {
        status.textContent = `Couldn't join: ${err instanceof Error ? err.message : String(err)}`;
      })
      .finally(() => (roomButton.disabled = false));
  });

  const getMicTrack = async (): Promise<MediaStreamTrack> => {
    if (params.get("mic") === "tone") {
      // Test aid: a quiet tone instead of a real microphone.
      const ctx = listener.context;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain).connect(dest);
      osc.start();
      return dest.stream.getAudioTracks()[0]!;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    return stream.getAudioTracks()[0]!;
  };

  micButton.addEventListener("click", async () => {
    if (!session) return;
    if (micTrack) {
      micTrack.stop();
      micTrack = null;
      await session.setMicrophone(null);
      micButton.textContent = "Turn microphone on";
      note = "";
    } else {
      try {
        micTrack = await getMicTrack();
        await session.setMicrophone(micTrack);
        micButton.textContent = "Turn microphone off";
        note = "Your microphone is on.";
      } catch {
        note = "The microphone is blocked or unavailable.";
      }
    }
    render();
  });

  inviteButton.addEventListener("click", async () => {
    if (!session) return;
    if (!privateName) {
      const bytes = crypto.getRandomValues(new Uint8Array(9));
      const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
      history.replaceState(history.state, "", `${location.pathname}${location.search}#room=${code}`);
      await join(code);
    }
    try {
      await navigator.clipboard.writeText(location.href);
      note = "Invite link copied. Anyone with it can join.";
    } catch {
      note = "Copy this page's address to invite someone.";
    }
    render();
  });

  if (privateName) status.textContent = "You were invited to a private room. Joining shows your IP address to the others in it.";

  // ------------------------------------------------------------ frames
  const tp = new THREE.Vector3();
  const tq = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const apply = (o: THREE.Object3D, t: Transform, k: number) => {
    o.position.lerp(tp.set(...t.position), k);
    o.quaternion.slerp(tq.set(...t.quaternion), k);
  };

  return {
    update(dt: number) {
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
          hands: [!!a.target?.left, !!a.target?.right],
          audioLevel: Math.round(level * 1000) / 1000,
        };
      });
    },
  };
}

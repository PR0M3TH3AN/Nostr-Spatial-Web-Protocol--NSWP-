/**
 * Shared presence for the reference worlds: wires the page's room buttons to
 * the SDK's Three.js presence (spec §9.4). The real work is in
 * `nswp-sdk/three`, so any world can use the same code.
 */
import type * as THREE from "three";
import { attachRoomControls, createPresence, type Presence } from "nswp-sdk/three";

export interface PresenceDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rig: THREE.Group;
  renderer: THREE.WebGLRenderer;
  controllers: THREE.Group[];
  textColor: string;
  state: Record<string, unknown>;
}

export function setupPresence(d: PresenceDeps): Presence {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  let refresh = () => {};
  const presence = createPresence({
    scene: d.scene,
    camera: d.camera,
    rig: d.rig,
    renderer: d.renderer,
    controllers: d.controllers,
    labelColor: d.textColor,
    onChange: () => refresh(),
  });
  ({ refresh } = attachRoomControls(presence, {
    roomButton: $<HTMLButtonElement>("room-button"),
    micButton: $<HTMLButtonElement>("mic-button"),
    inviteButton: $<HTMLButtonElement>("invite-button"),
    status: $("room-status"),
    onState: (state) => (d.state.room = state),
  }));
  return presence;
}

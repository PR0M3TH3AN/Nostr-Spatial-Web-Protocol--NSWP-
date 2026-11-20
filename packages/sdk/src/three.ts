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

import { turnVisitor } from "./turn.js";
export { turnVisitor } from "./turn.js";
export { createConsole, type XrConsole } from "./console.js";
import type { Controls } from "./ui/model.js";
import { fullscreenAction } from "./ui/fullscreen.js";
import { addDeskControls, watchFov } from "./desk.js";
import { freshAction } from "./ui/fresh.js";
import { figureAction, identityAction, identityHost, identitySection, signerAction, type Leaving } from "./ui/identity.js";
import type { GoOptions } from "./index.js";

export { createPresence, speechSprite, textSprite, type AvatarInfo, type Presence, type PresenceOptions } from "./presence.js";
export { addRoomControls, type RoomFollows, type RoomNotes, type Travelling } from "./room-controls.js";

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
    /**
     * The visitor's state as they leave to say who they are (in a room, their microphone on, moving the intense
     * way), so they come back as they left. The headset session is added here.
     */
    leaving?: (to: { title: string; address: string }) => GoOptions | Promise<GoOptions>;
    /** False for a world that sets its camera's width itself, and so applies the visitor's own (`watchFov`, `visitorFov`). */
    fov?: boolean;
  },
): Promise<boolean> {
  // The latest, always: a visitor is told when the world has been updated since they opened it, and is given it
  // at once on coming back to the tab with nothing in hand (ui/fresh.ts). In every world, since every world has these.
  if (!controls.has("fresh")) controls.add(freshAction(controls, { busy: () => d.renderer.xr.isPresenting }));
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
    fullscreenAction(controls, presenting),
  );
  // How fast the view turns under their hand, and how wide they see at a desk: theirs, and the same in every world.
  addDeskControls(controls, { presenting });
  // The camera is kept as wide as they asked. A world that fits its own view to the window keeps its own watch.
  if (d.fov !== false && (d.camera as THREE.PerspectiveCamera).isPerspectiveCamera) watchFov(d.camera as THREE.PerspectiveCamera, { presenting });
  // Who they are here, and the way to sign in: their own client's to ask, so this leaves for it and comes back
  // (ui/identity.ts). A world that has put its own control there keeps it, and a place with no client to go back
  // to (a client's own room, a world opened by itself with no Airlock named) has none.
  if (!controls.has("identity") && identityHost()) {
    const leaving: Leaving = async (to) => ({ ...(await d.leaving?.(to)), xrSession: d.renderer.xr.getSession() });
    controls.addSection(identitySection());
    controls.add(figureAction(controls, leaving), identityAction(controls, leaving), signerAction(controls, { presenting: () => d.renderer.xr.isPresenting }));
  }
  // Leaving fullscreen with the browser's own key changes what the control should say.
  document.addEventListener("fullscreenchange", () => controls.setTarget(""));
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
export { CASUAL_COMFORT, DEFAULT_COMFORT, INTENSE_COMFORT, isIntense, readPad, type Comfort, type PadState } from "./actions.js";
export { addPanelControls, createPanels, type Panel, type PanelContent, type PanelInfo, type Panels, type PanelsOptions } from "./panels.js";
export { LIBRARY_LIMITS, PANEL_LIMITS, PANEL_LOOKS, type LibraryItem, type PanelLook, type PanelPlace, type PanelRecord, type PanelSource } from "./panel-store.js";
export { createStay, wasRefreshed, type Stay, type Stood } from "./stay.js";
export { watchFresh, type Fresh, type FreshOptions } from "./fresh.js";
export { freshAction } from "./ui/fresh.js";
export { createStepPace, createStroll, dotsBetween, DOUBLE_TAP, DRAG_LOOK, FACE_RATE, KEY_TURN, PATH_MOST, reachOf, RUN, TAP_REACH, TOP_SPEED, WALK_SPEED, type StepPace, type Stroll } from "./stroll.js";
export { createFloorMarks, type FloorMarks } from "./floor-mark.js";
export { DOOR_REACH } from "./gate-size.js";
export { addJump, createJump, JUMP_GRAVITY, JUMP_HEIGHT, JUMP_SPEED, type AddJumpOptions, type Jump } from "./jump.js";
export { viewScale } from "./sign.js";
export { arrivedSettings, arriveWith, currentSettings, reportSettings, type TravelSettings } from "./settings.js";
export { fullscreenWaiting, prefersFullscreen, resumeFullscreen } from "./ui/fullscreen.js";
export { loadPicture, onPicturesChange, PICTURE_LIMITS, setShowsPictures, showsPictures } from "./picture.js";
export { addDeskControls, FOV_STEPS, LOOK_STEPS, lookScale, onDeskChange, setLookScale, setVisitorFov, visitorFov, watchFov } from "./desk.js";
export { byName, figureAction, hereAs, identityAction, identityHost, identitySection, identityWords, onHereAs, seekPass, signerAction, signerNamed, worldPeople, worldSaves, worldSigner, youCard, type Leaving } from "./ui/identity.js";
export { createSaves, type Saved, type SaveResult, type Saves, type SavesOptions } from "./saves.js";
export { foundRelays, publishBacked, queryBacked, relayBackup } from "./relay-book.js";
export { createScores, type ScoreHand, type Scores, type ScoresOptions } from "./scores.js";
export { addScoreControls, type Scoring, type ScoringOptions } from "./scoring.js";
export { createItems, fitToSize, ITEM_BUDGET, onItemsChange, setShowsItems, showsItems, withinBudget, type Items, type ItemsOptions } from "./items.js";
export { createBag, type Bag, type BagHand, type BagOptions, type BagResult } from "./bag.js";
export { addBagControls, itemIn, type Bagging, type BaggingOptions } from "./bagging.js";
export { allowScript, createPlay, mayHold, paintHealth, scriptAllowed, type Play, type PlayInfo, type PlayOptions, type PlayPerson, type PlaySnapshot } from "./play.js";
export { runInBox, type BoxAsk, type BoxRun, type ItemBoxOptions } from "./item-box.js";
export { addItemControls, TAP_MS, type ItemControls, type ItemControlsOptions } from "./item-controls.js";
export { createDoorRatings, type DoorRatings, type DoorRatingsOptions } from "./door-ratings.js";
export { ordinal, someOf, worldPersonLines, type PersonLines } from "./person-lines.js";
export { createAchievements, type AchievementHand, type Achievements, type AchievementsOptions } from "./achievements.js";
export { addAchievementControls, type Achieving, type AchievingOptions } from "./achieving.js";
export { createMessages, type Conversation, type MessageHand, type Messages, type MessagesOptions, type MessagesState } from "./messages.js";
export { addMessagingControls, type Messaging, type MessagingHand, type MessagingOptions } from "./messaging.js";
export { addFollowingControls, keyIn, type Following, type FollowingHand, type FollowingOptions } from "./following.js";
export { createProfiles, readProfile, type Profile, type Profiles } from "./profiles.js";
export { createPeople, type FollowHand, type FollowResult, type FollowWhy, type People, type PeopleOptions } from "./people.js";
export { askWell, learnFrom, relaysWell, sendWell, type SentWell } from "./relay-book.js";
export { createWorldSigner, type SignerState, type WorldSigner } from "./signer.js";
export { currentForm, deviceForms, formFor, startingForm, usedForm, type DeviceForms, type Form } from "./form.js";
export { createFps, heldKey, lookAfter, strideOf, LOOK_SPEED, PITCH_LIMIT, SPRINT, type Fps, type FpsOptions, type Held } from "./fps.js";
export { addSoundControls, createSounds, CUES, type Cue, type Jukebox, type Song, type SoundLevels, type Sounds, type SoundsOptions, type SoundTheme } from "./sound.js";
export { browserVoice, computerVoice, createVoice, recordVoice, toPcm16, type Hearing, type Voice, type VoiceSource, type VoiceState } from "./speech.js";
export { createKeyboard, type AskOptions, type Keyboard, type KeyboardOptions } from "./keyboard.js";
export { createLibrary, type Library, type LibraryOptions } from "./library.js";
export { CHAMBER_ORDER, createChamber, createCrossing, type ArriveOptions, type Chamber, type Crossing, type CrossingOptions, type CrossingState } from "./chamber.js";

export { addCameraControls, canRecord, recordClip, saveFile, takePicture, takeSelfie, type Camera, type CameraOptions, type Capture, type Clip } from "./camera.js";

// A stand-in for any world: it embeds the client's component and asks it for the passkey. It never sees the
// passkey or the secret, only what the component chooses to tell it.
const CLIENT = new URL(window.PASSKEY_CLIENT).origin;
const log = document.getElementById("log");
const say = (label, value) => {
  log.value += `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`;
  log.scrollTop = log.scrollHeight;
};
const frame = document.getElementById("component");
frame.src = `${CLIENT}/component.html`;
document.getElementById("client").href = `${CLIENT}/?world=${encodeURIComponent(location.origin + location.pathname)}`;
say("page", `a world at ${location.origin}, embedding the client at ${CLIENT}`);
say("browser", navigator.userAgent);

let onResult = () => {};
let ready = false;
addEventListener("message", (e) => {
  if (e.origin !== CLIENT) return;
  if (e.data?.type === "ready") {
    ready = true;
    say("component", "loaded");
  }
  if (e.data?.type !== "result") return;
  const { type: _type, ...result } = e.data;
  say("result", result);
  onResult(result);
});
const ask = (how) => {
  say("asking", how);
  if (!ready) say("note", "the component hasn't said it is loaded");
  frame.contentWindow.postMessage({ type: "use", how }, CLIENT);
};
document.getElementById("ask").onclick = () => ask("A: pressed in the world's own menu");
document.getElementById("copy").onclick = async () => {
  log.select();
  try {
    await navigator.clipboard.writeText(log.value);
    document.getElementById("copied").textContent = "Copied.";
  } catch {
    document.getElementById("copied").textContent = "Select the text above and copy it.";
  }
};

// ---------------------------------------------------------------- a headset
// The smallest possible VR scene: one colour, and the trigger asks for the passkey. It answers one question: can a
// passkey be asked for, and answered, while a headset session is running?
const GREY = [0.12, 0.13, 0.15];
const BLUE = [0.05, 0.16, 0.42];
const GREEN = [0.04, 0.36, 0.2];
const RED = [0.42, 0.06, 0.06];
const vrButton = document.getElementById("vr");
(async () => {
  let can = false;
  try {
    can = !!navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr"));
  } catch {
    /* stays false */
  }
  say("headset", can ? "this browser can start a VR session" : "this browser can't start a VR session (expected on a phone or a computer)");
  if (!can) document.getElementById("vr-row").hidden = true;
})();
vrButton.onclick = async () => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", { xrCompatible: true });
    const session = await navigator.xr.requestSession("immersive-vr");
    await gl.makeXRCompatible?.();
    await session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    await session.requestReferenceSpace("local");
    let colour = GREY;
    let asked = 0;
    say("VR", "session started");
    session.addEventListener("visibilitychange", () => say("VR", `the session is now ${session.visibilityState}`));
    session.addEventListener("end", () => say("VR", "session ended"));
    session.addEventListener("select", () => {
      colour = BLUE;
      ask(`C: trigger pulled in VR (press ${++asked})`);
    });
    onResult = (result) => (colour = result.ok ? GREEN : RED);
    const draw = () => {
      session.requestAnimationFrame(draw);
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
      gl.clearColor(colour[0], colour[1], colour[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    session.requestAnimationFrame(draw);
  } catch (err) {
    say("VR", `couldn't start: ${err?.name ?? "Error"} ${String(err?.message ?? err).slice(0, 140)}`);
  }
};

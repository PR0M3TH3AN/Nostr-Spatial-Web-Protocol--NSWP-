// The page's script (index.html says what it is for). Kept in its own file: the Gallery's content rules allow no
// script written into a page, which also covers the window it opens, so that window's Close is wired from here.
"use strict";
(() => {
  const T0 = performance.now();
  const log = document.getElementById("log");
  const say = (what) => {
    log.textContent += `+${Math.round(performance.now() - T0)}ms  ${what}\n`;
  };
  say(`page began. ${navigator.xr ? "WebXR is here" : "NO WebXR in this browser"}. ${navigator.userAgent}`);

  const WINDOW_PAGE =
    '<!doctype html><meta name="viewport" content="width=device-width">' +
    '<style>body{font:20px system-ui;padding:1em;background:#fff;color:#111}button,input{font:inherit}</style>' +
    "<h1>A window over the world</h1>" +
    "<p>If you can read this in VR, with the room still changing colour behind it, the panel works.</p>" +
    '<p><input placeholder="Type here"></p><p><button id="close">Close</button></p>';

  let session = null;
  let frames = 0;
  let opened = 0;

  const openWindow = () => {
    const w = window.open("", "bitbrowser-panel-test", "popup,width=480,height=760");
    if (!w) {
      say("window.open gave nothing: the browser blocked it");
      return;
    }
    w.document.open();
    w.document.write(WINDOW_PAGE);
    w.document.close();
    w.document.getElementById("close").addEventListener("click", () => w.close());
    opened += 1;
    say(`window ${opened} opened (frames drawn so far: ${frames})`);
    const watch = setInterval(() => {
      if (w.closed) {
        clearInterval(watch);
        say(`window ${opened} closed (frames drawn so far: ${frames})`);
      }
    }, 250);
  };

  document.getElementById("enter").addEventListener("click", async () => {
    if (!navigator.xr || session) return;
    try {
      session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    } catch (e) {
      say(`could not start VR: ${e}`);
      return;
    }
    say("VR session started");
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { xrCompatible: true });
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    session.addEventListener("end", () => {
      say(`VR session ended after ${frames} frames`);
      session = null;
    });
    session.addEventListener("visibilitychange", () => say(`visibility: ${session.visibilityState}`));
    session.addEventListener("select", openWindow);
    const draw = (t) => {
      if (!session) return;
      frames += 1;
      const c = (Math.sin(t / 700) + 1) / 2;
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
      gl.clearColor(0.1, 0.2 + 0.5 * c, 0.6 - 0.4 * c, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      session.requestAnimationFrame(draw);
    };
    session.requestAnimationFrame(draw);
  });
})();

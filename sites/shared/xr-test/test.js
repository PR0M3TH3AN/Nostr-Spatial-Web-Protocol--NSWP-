// A test of what a headset's browser does at a door, asked for by the owner on 2026-11-21 ("I want VR mode to be
// absolutely seamless"): whether it carries VR from one site to the next (`sessiongranted`), whether it does so
// when the page stays in VR at the door, by a middle page, and inside a frame. No kit, no library: a room of one
// colour, a wall with the log on it, and a door taken by pulling the trigger. Nothing is stored and nothing is sent
// anywhere: the log travels in the address, after the #, from one site's page to the next.
"use strict";
(() => {
  const T0 = performance.now();
  const params = new URLSearchParams(location.search);
  const host = location.host;
  const LOCAL = /^\d+\.\d+\.\d+\.\d+(:\d+)?$/.test(host) || host.startsWith("localhost");
  // Which site this is, the one its door leads to, and the one in the middle: by name on the real sites, by port locally.
  const SITES = LOCAL
    ? { a: `https://${location.hostname}:4301`, b: `https://${location.hostname}:4302`, mid: `https://${location.hostname}:4303`, client: `https://${location.hostname}:4300` }
    : { a: "https://gallery.bitblocks.network", b: "https://grove.bitblocks.network", mid: "https://tour.bitblocks.network", client: "https://portal.bitblocks.network" };
  const me = location.origin === SITES.a ? "A" : location.origin === SITES.b ? "B" : location.origin === SITES.mid ? "MID" : host;
  const role = params.get("role") === "mid" ? "mid" : "world";
  const framed = window.parent !== window;
  const COLOUR = { A: [0.05, 0.16, 0.4], B: [0.4, 0.07, 0.07], MID: [0.06, 0.3, 0.12] }[me] ?? [0.2, 0.2, 0.2];

  // ---- the log: what happened, when (since this page began), and where. Carried in the address.
  const carried = (() => {
    try {
      const packed = new URLSearchParams(location.hash.slice(1)).get("log");
      return packed ? JSON.parse(decodeURIComponent(escape(atob(packed.replace(/-/g, "+").replace(/_/g, "/"))))) : [];
    } catch {
      return [];
    }
  })();
  const log = Array.isArray(carried) ? carried.filter((l) => typeof l === "string").slice(-60) : [];
  const arrivedByDoor = log.length > 0;
  const pack = () => btoa(unescape(encodeURIComponent(JSON.stringify(log.slice(-40))))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  let dirty = true;
  const say = (what) => {
    log.push(`${me}${framed ? "(framed)" : ""} +${Math.round(performance.now() - T0)}ms  ${what}`);
    dirty = true;
    const pre = document.getElementById("log");
    if (pre) pre.textContent = log.join("\n");
  };

  // ---- heard as early as this file runs: a browser that carries VR across says so before a page has built anything.
  let granted = false;
  let session = null;
  try {
    navigator.xr?.addEventListener("sessiongranted", () => {
      granted = true;
      say("sessiongranted: the browser says VR may start with no press");
      void start("the browser's grant");
    });
  } catch (e) {
    say(`could not listen for sessiongranted: ${e}`);
  }
  say(`page began${arrivedByDoor ? ", arrived through a door" : ""}${role === "mid" ? ", as the middle page" : ""}. ${navigator.xr ? "WebXR is here" : "NO WebXR in this browser"}`);
  if (framed) {
    // Inside BitPortal's page: say this place came up, as a world does, or that page opens it as a page of its own.
    try {
      window.parent.postMessage({ nswp: "here", at: `${location.pathname}${location.search}`.slice(0, 300) }, "*");
    } catch {
      /* nobody to tell */
    }
    say(`in a frame. Allowed a headset here: ${document.featurePolicy ? document.featurePolicy.allowsFeature("xr-spatial-tracking") : "unknown"}`);
  }
  addEventListener("pagehide", () => say("pagehide"));
  document.addEventListener("visibilitychange", () => say(`visibility: ${document.visibilityState}`));

  // ---- the choices, kept in the address so they come along through every door.
  const opt = (name) => params.get(name) === "1";
  const addressFor = (origin, o) => {
    const q = new URLSearchParams();
    if (o.keep) q.set("keep", "1");
    if (o.mid) q.set("mid", "1");
    if (o.role) q.set("role", o.role);
    if (o.to) q.set("to", o.to);
    const s = q.toString();
    return `${origin}/xr-test/${s ? `?${s}` : ""}#log=${pack()}`;
  };
  const choices = () => ({ keep: document.getElementById("keep")?.checked ?? opt("keep"), mid: document.getElementById("mid")?.checked ?? opt("mid") });
  const other = () => (location.origin === SITES.a ? SITES.b : SITES.a);

  // ---- the door.
  let going = false;
  const go = async (how) => {
    if (going) return;
    going = true;
    const c = choices();
    // From the middle page: on to where the door was leading. From a world: to the other world, by the middle or not.
    const onward = role === "mid" ? (params.get("to") === "A" ? SITES.a : SITES.b) : other();
    const viaMid = role !== "mid" && c.mid;
    const target = viaMid ? SITES.mid : onward;
    say(`door taken (${how}), to ${target === SITES.a ? "A" : target === SITES.b ? "B" : "MID"}${viaMid ? " on the way to " + (onward === SITES.a ? "A" : "B") : ""}; ${session ? (c.keep ? "STAYING in VR while it is taken" : "leaving VR first") : "not in VR"}`);
    if (session && !c.keep) {
      try {
        await session.end();
        say("left VR (the page ended its own session)");
      } catch (e) {
        say(`ending the session failed: ${e}`);
      }
    }
    location.assign(addressFor(target, { keep: c.keep, mid: c.mid, ...(viaMid ? { role: "mid", to: onward === SITES.a ? "A" : "B" } : {}) }));
  };

  // ---- VR: one colour all round, and the log on a wall two metres in front.
  const canvas = document.getElementById("gl");
  let gl = null;
  let draw3d = null;
  const setUp = () => {
    gl = canvas.getContext("webgl", { xrCompatible: true, alpha: false, antialias: true });
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec3 p; attribute vec2 t; uniform mat4 m; varying vec2 v; void main(){ v=t; gl_Position=m*vec4(p,1.0); }"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision mediump float; uniform sampler2D s; varying vec2 v; void main(){ gl_FragColor=texture2D(s,v); }"));
    gl.linkProgram(prog);
    // A wall 2.4 m wide and 2.4 m tall, its middle at eye height, 2 m in front (-z).
    const W = 1.2;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-W, 0.3, -2, 0, 1, W, 0.3, -2, 1, 1, -W, 2.7, -2, 0, 0, W, 2.7, -2, 1, 0]), gl.STATIC_DRAW);
    const tex = gl.createTexture();
    const page = document.createElement("canvas");
    page.width = page.height = 1024;
    const pen = page.getContext("2d");
    const write = () => {
      pen.fillStyle = "#05080c";
      pen.fillRect(0, 0, 1024, 1024);
      pen.fillStyle = "#7fd4ff";
      pen.font = "bold 40px system-ui, sans-serif";
      pen.fillText(`Site ${me}${role === "mid" ? " (the middle page)" : ""}${framed ? ", in a frame" : ""}`, 24, 54);
      pen.fillStyle = "#ffffff";
      pen.font = "30px system-ui, sans-serif";
      pen.fillText(role === "mid" ? "Going on by itself in a moment…" : "Pull the trigger to go through the door.", 24, 100);
      pen.font = "22px ui-monospace, Menlo, Consolas, monospace";
      pen.fillStyle = "#d6e2ec";
      // The newest lines, wrapped to the wall.
      const lines = [];
      for (const l of log.slice(-22)) for (let i = 0; i < l.length; i += 74) lines.push((i ? "    " : "") + l.slice(i, i + 74));
      lines.slice(-32).forEach((l, i) => pen.fillText(l, 24, 150 + i * 27));
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, page);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    const mul = (a, b) => {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    };
    draw3d = (frame, space) => {
      const pose = frame.getViewerPose(space);
      const layer = frame.session.renderState.baseLayer;
      gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
      gl.clearColor(COLOUR[0], COLOUR[1], COLOUR[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!pose) return;
      if (dirty) {
        dirty = false;
        write();
      }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const p = gl.getAttribLocation(prog, "p");
      const t = gl.getAttribLocation(prog, "t");
      gl.enableVertexAttribArray(p);
      gl.enableVertexAttribArray(t);
      gl.vertexAttribPointer(p, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(t, 2, gl.FLOAT, false, 20, 12);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const view of pose.views) {
        const vp = layer.getViewport(view);
        gl.viewport(vp.x, vp.y, vp.width, vp.height);
        gl.uniformMatrix4fv(gl.getUniformLocation(prog, "m"), false, mul(view.projectionMatrix, view.transform.inverse.matrix));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  };

  async function start(why) {
    if (session) return;
    if (!navigator.xr) return say("can't start VR: no WebXR here");
    say(`asking for a VR session (${why})`);
    let s;
    try {
      s = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    } catch (e) {
      return say(`REFUSED: ${e && e.name ? e.name + ": " + e.message : e}`);
    }
    session = s;
    say("VR session started");
    s.addEventListener("end", () => {
      session = null;
      say("VR session ended");
    });
    s.addEventListener("select", () => void go("trigger"));
    try {
      if (!gl) setUp();
      await gl.makeXRCompatible?.();
      s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl) });
      const space = await s.requestReferenceSpace("local-floor").catch(() => s.requestReferenceSpace("local"));
      let first = true;
      const loop = (_time, frame) => {
        if (!session) return;
        s.requestAnimationFrame(loop);
        draw3d(frame, space);
        if (first) {
          first = false;
          say("first frame drawn in VR");
          // The middle page goes on by itself, still in VR if it was asked to stay.
          if (role === "mid") setTimeout(() => void go("by itself, from the middle page"), 1500);
        }
      };
      s.requestAnimationFrame(loop);
    } catch (e) {
      say(`drawing failed: ${e}`);
    }
  }
  // For a made-up headset in a test: nothing on a real page calls these.
  window.__xrTest = { log, say, go, start, state: () => ({ me, role, framed, granted, presenting: !!session }) };

  // ---- the page itself.
  addEventListener("DOMContentLoaded", () => {
    document.getElementById("where").textContent = `site ${me}${role === "mid" ? " (the middle page)" : ""}${framed ? ", in a frame" : ""}`;
    document.getElementById("keep").checked = opt("keep");
    document.getElementById("mid").checked = opt("mid");
    document.getElementById("log").textContent = log.join("\n");
    document.getElementById("enter").addEventListener("click", () => void start("a press"));
    document.getElementById("door").addEventListener("click", () => void go("the button"));
    const inFrame = document.getElementById("framed");
    if (framed) inFrame.remove();
    else
      inFrame.addEventListener("click", (e) => {
        e.preventDefault();
        const c = choices();
        say("opening this test inside BitPortal's page");
        location.assign(`${SITES.client}/shell/#to=${encodeURIComponent(addressFor(location.origin, c))}`);
      });
    // Arrived through a door, and the browser has said nothing: said so, plainly, after a moment.
    if (arrivedByDoor)
      setTimeout(() => {
        if (!granted && !session) {
          say("NO sessiongranted after 3 seconds: this browser did not carry VR across. Press Enter VR.");
          if (role === "mid") say("(the middle page stops here: press the door button to go on)");
        }
      }, 3000);
  });
})();

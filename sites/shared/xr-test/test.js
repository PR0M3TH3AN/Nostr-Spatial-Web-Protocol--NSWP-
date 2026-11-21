// A test of what a headset's browser does at a door, asked for by the owner on 2026-11-21 ("I want VR mode to be
// absolutely seamless"): whether it carries VR from one site to the next (`sessiongranted`), whether it does so
// when the page stays in VR at the door, by a middle page, and inside a frame. No kit, no library: a room of one
// colour, a wall with the log on it, and a door taken by pulling the trigger. Nothing is stored, and by hand nothing
// is sent anywhere: the log travels in the address, after the #, from one site's page to the next.
//
// The guided test (the owner, 2026-11-21: "make each test a step i preform with like a QA to me added to the logs",
// and "post the outputs of the logs as nostr event notes... Its hard to get that text out of the vr env") is the
// same doors taken in a set order, with a question after each. It alone sends its log out, through post.js, from
// the press that starts it. Its run and its step ride in the address like the rest.
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
  // ---- the guided test: which run this is and which step, from the address. A step says which door is taken.
  const STEPS = [
    null, // step 0 is two questions about the browser, before any door
    { door: "to another site, leaving VR at the door, as the worlds do today" },
    { door: "to another site, staying in VR at the door", keep: true },
    { door: "to another site by a middle page, staying in VR", keep: true, mid: true },
    { door: "back to this same site, leaving VR at the door", same: true },
    { door: "back to this same site, staying in VR", same: true, keep: true },
    { door: "to another site, staying in VR, all inside BitPortal's page", keep: true, inside: true },
    { door: "back to this same site, staying in VR, all inside BitPortal's page", keep: true, same: true, inside: true },
  ];
  const LAST = STEPS.length - 1;
  const RUN = /^[A-Z2-7]{6}$/.test(params.get("run") || "") ? params.get("run") : null;
  const STEP = RUN ? Math.max(0, Math.min(LAST + 1, parseInt(params.get("step") || "0", 10) || 0)) : 0;
  /** This page was reached through this step's door, and is where the step is judged. */
  const ARR = !!RUN && params.get("arr") === "1";
  const plan = RUN ? (STEPS[STEP] ?? null) : null;
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
  // By hand, a log that came along means a door was taken. A guided run carries its log from step to step too, so there the address says.
  const arrivedByDoor = RUN ? ARR : log.length > 0;
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
      // Told it may start and then refused: a guided step is judged all the same.
      void start("the browser's grant").then((began) => {
        if (!began && ARR) void post("the grant was refused").then(question);
      });
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
  let hops = 0;
  const addressFor = (origin, o) => {
    const q = new URLSearchParams();
    if (o.keep) q.set("keep", "1");
    if (o.mid) q.set("mid", "1");
    if (o.same) q.set("same", "1");
    if (o.role) q.set("role", o.role);
    if (o.to) q.set("to", o.to);
    const run = o.run ?? RUN;
    if (run) {
      q.set("run", run);
      q.set("step", String(o.step ?? STEP));
      if (o.arr) q.set("arr", "1");
      if (o.sh) q.set("sh", "1");
    }
    // Never the address this page already has: a door back to the same site would then change only what follows
    // the #, and a browser loads nothing for that.
    if (o.door) q.set("hop", `${Date.now().toString(36)}${hops++}`);
    const s = q.toString();
    return `${origin}/xr-test/${s ? `?${s}` : ""}#log=${pack()}`;
  };
  const ticked = (id) => document.getElementById(id)?.checked ?? opt(id);
  const choices = () => (plan ? { keep: !!plan.keep, mid: !!plan.mid, same: !!plan.same } : { keep: ticked("keep"), mid: ticked("mid"), same: ticked("same") });
  const other = () => (location.origin === SITES.a ? SITES.b : SITES.a);
  const nameOf = (origin) => (origin === SITES.a ? "A" : origin === SITES.b ? "B" : origin === SITES.mid ? "MID" : new URL(origin).host);

  // ---- the door.
  let going = false;
  const go = async (how) => {
    if (going) return;
    going = true;
    const c = choices();
    // From the middle page: on to where the door was leading. From a world: to the other world, or back to this one, by the middle or not.
    const onward = role === "mid" ? (params.get("to") === "A" ? SITES.a : SITES.b) : c.same ? location.origin : other();
    // The middle page knows its way on to A or B and nowhere else.
    const viaMid = role !== "mid" && c.mid && (onward === SITES.a || onward === SITES.b);
    const target = viaMid ? SITES.mid : onward;
    say(`door taken (${how}), to ${nameOf(target)}${target === location.origin ? " (this same site)" : ""}${viaMid ? " on the way to " + nameOf(onward) : ""}; ${session ? (c.keep ? "STAYING in VR while it is taken" : "leaving VR first") : "not in VR"}`);
    if (session && !c.keep) {
      try {
        await session.end();
        say("left VR (the page ended its own session)");
      } catch (e) {
        say(`ending the session failed: ${e}`);
      }
    }
    location.assign(addressFor(target, { keep: c.keep, mid: c.mid, same: c.same, door: true, arr: !!RUN, ...(viaMid ? { role: "mid", to: nameOf(onward) } : {}) }));
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
      pen.fillText(`${RUN ? `Step ${STEP} of ${LAST}. ` : ""}Site ${me}${role === "mid" ? " (the middle page)" : ""}${framed ? ", in a frame" : ""}`, 24, 54);
      pen.fillStyle = "#ffffff";
      pen.font = "30px system-ui, sans-serif";
      pen.fillText(role === "mid" ? "Going on by itself in a moment…" : ARR ? "You arrived IN VR. Pull the trigger to finish this step." : "Pull the trigger to go through the door.", 24, 100);
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
    if (session) return true;
    if (!navigator.xr) return say("can't start VR: no WebXR here"), false;
    say(`asking for a VR session (${why})`);
    let s;
    try {
      s = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    } catch (e) {
      return say(`REFUSED: ${e && e.name ? e.name + ": " + e.message : e}`), false;
    }
    session = s;
    say("VR session started");
    s.addEventListener("end", () => {
      session = null;
      say("VR session ended");
      // A guided step that arrived in VR is over when VR is, however it was left.
      if (ARR && role !== "mid" && why !== "a press" && !going) question();
    });
    // Arrived in VR in a guided step: there is no further door, and the trigger ends the step.
    s.addEventListener("select", () => (ARR && role !== "mid" ? void finishInVr() : void go("trigger")));
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
          if (ARR && why !== "a press") {
            say(`ARRIVED IN VR with no press (step ${STEP})`);
            if (role !== "mid") void post("arrived in VR");
          }
          // The middle page goes on by itself, still in VR if it was asked to stay.
          if (role === "mid") setTimeout(() => void go("by itself, from the middle page"), 1500);
        }
      };
      s.requestAnimationFrame(loop);
    } catch (e) {
      say(`drawing failed: ${e}`);
    }
    return true;
  }
  // For a made-up headset in a test: nothing on a real page calls these.
  window.__xrTest = { log, say, go, start, state: () => ({ me, role, framed, granted, presenting: !!session, run: RUN, step: STEP, arrived: ARR }) };

  // ---- the guided test: what is on the page at each step, the question after each door, and the log sent out.
  const el = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  /** One thing to read and things to press: `[label, what it does, quiet?]`. */
  const show = (title, lines, buttons = []) => {
    const g = document.getElementById("guide");
    if (!g) return;
    g.hidden = false;
    g.replaceChildren(
      el("h2", title),
      ...lines.map((l) => el("p", l)),
      ...buttons.map(([label, act, quiet]) => {
        const b = el("button", label, quiet ? "quiet" : "");
        b.addEventListener("click", () => act(b), { once: true });
        return b;
      }),
    );
  };
  /** Send what the page has to the relays: the log, where it is in the run, and the browser's name for itself. */
  const post = async (why) => {
    if (!RUN) return null;
    const out = window.__xrPost;
    if (!out) return say("the log could NOT be sent: the part of this page that sends it did not load"), null;
    const r = await out.send({ v: 1, run: RUN, step: STEP, site: me, framed, why, at: new Date().toISOString(), ua: navigator.userAgent, log: log.slice(-60) }, RUN, STEP);
    say(`log sent (${why}): ${r.ok} of ${r.total} relays took it`);
    const line = document.getElementById("sent");
    if (line) {
      line.hidden = false;
      line.textContent = r.ok ? `Run ${RUN}: the log so far was sent to ${r.ok} of ${r.total} relays.` : `Run ${RUN}: no relay took the log. Carry on: it is still in this page's address.`;
    }
    return r;
  };
  /** Where a step begins: on site A, and for the last steps inside BitPortal's page. */
  const stepAddress = (n) => {
    const inside = !!STEPS[n]?.inside;
    if (inside && !framed) return `${SITES.client}/shell/#to=${encodeURIComponent(addressFor(SITES.a, { step: n, sh: true }))}`;
    return addressFor(SITES.a, { step: n, door: true });
  };
  const toStep = (n) => location.assign(stepAddress(n));
  const stepDone = async (why) => {
    show(`Step ${STEP} of ${LAST}`, ["Sending this step's log…"]);
    await post(why);
    const next = STEP + 1;
    show(`Step ${STEP} of ${LAST} is done`, [next > LAST ? "That was the last door." : `Next: a door ${STEPS[next].door}.`], [
      [next > LAST ? "Finish" : `Go to step ${next}`, () => toStep(next)],
      [`Do step ${STEP} again`, () => toStep(STEP), true],
    ]);
  };
  let asked = false;
  /** The question after a door, asked once: what they saw, in their own word, beside what the page saw. */
  const question = () => {
    if (asked) return;
    asked = true;
    const answer = (text) => () => {
      say(`ANSWER step ${STEP}: after the trigger at the door, "${text}"`);
      void stepDone("answered");
    };
    show(`Step ${STEP} of ${LAST}: one question`, ["When you pulled the trigger at the door, what happened?"], [
      ["I stayed in VR, and the next room appeared by itself", answer("I stayed in VR, and the next room appeared by itself")],
      ["I was put back on a flat page", answer("I was put back on a flat page")],
      ["Something else: black, stuck, or an error", answer("Something else: black, stuck, or an error")],
    ]);
  };
  async function finishInVr() {
    try {
      await session?.end();
    } catch {
      /* it is ending anyway */
    }
    question();
  }
  const skip = () => {
    say(`SKIPPED step ${STEP}`);
    void stepDone("skipped");
  };
  const beginStep = () => {
    if (plan.inside && !framed) {
      // Sent to BitPortal's page once, and this page came up outside it all the same: say so and move on.
      if (opt("sh")) {
        say("BitPortal's page did not keep this test in its frame");
        return show(`Step ${STEP} of ${LAST}`, ["This step is taken inside BitPortal's page, and that page did not keep the test."], [["Skip this step", skip]]);
      }
      return location.replace(stepAddress(STEP));
    }
    say(`STEP ${STEP} of ${LAST} begins: a door ${plan.door}`);
    const enter = async (b) => {
      b.textContent = "Starting VR…";
      if (!(await start("a press"))) show(`Step ${STEP} of ${LAST}`, ["VR did not start here. What the browser said is in the log below."], [["Try Enter VR again", enter], ["Skip this step", skip, true]]);
    };
    show(`Step ${STEP} of ${LAST}`, [`This door leads ${plan.door}.`, "Press Enter VR. In VR, pull the trigger once to go through the door. Then answer the one question on the page you land on."], [
      ["Enter VR", enter],
      ["Skip this step", skip, true],
    ]);
  };
  const beforeDoors = () => {
    say(`guided run ${RUN} begins. Browser: ${navigator.userAgent}`);
    const ask = (q, answers, then) =>
      show("Before the first door", [q], answers.map((a) => [a, () => (say(`ANSWER before the doors: ${q} "${a}"`), then())]));
    ask("In chrome://flags, what is \"WebXR navigation permission\" set to?", ["Enabled", "Default or Disabled", "I don't know"], () =>
      ask("Was the browser closed and opened again after that setting was last changed?", ["Yes", "No", "I don't know"], () => void stepDone("before the doors")),
    );
  };
  const guidedPage = () => {
    for (const id of ["manual", "by-hand"]) document.getElementById(id).hidden = true;
    document.getElementById("where").textContent += `, guided run ${RUN}`;
    if (STEP > LAST) {
      say(`guided run ${RUN} finished`);
      show("All the doors are done", ["Sending the last of the log…"]);
      return void post("finished").then(() => {
        const g = document.getElementById("guide");
        show("All the doors are done", ["Tell Claude this run's code, and it can read everything that happened:"]);
        g.append(el("p", RUN, "code"));
      });
    }
    if (STEP === 0) return beforeDoors();
    if (!ARR) return beginStep();
    show(`Step ${STEP} of ${LAST}`, ["You are through the door. Seeing whether this browser kept you in VR…"]);
  };

  // ---- the page itself.
  addEventListener("DOMContentLoaded", () => {
    document.getElementById("where").textContent = `site ${me}${role === "mid" ? " (the middle page)" : ""}${framed ? ", in a frame" : ""}`;
    document.getElementById("keep").checked = opt("keep");
    document.getElementById("mid").checked = opt("mid");
    document.getElementById("same").checked = opt("same");
    document.getElementById("guided").addEventListener("click", () => {
      // A new run: a code to find it by, an empty log, and its first page on site A.
      const run = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[b % 32]).join("");
      log.length = 0;
      location.assign(addressFor(SITES.a, { run, step: 0, door: true }));
    });
    if (RUN) guidedPage();
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
          say(`NO sessiongranted after 3 seconds: this browser did not carry VR across.${RUN ? "" : " Press Enter VR."}`);
          if (role === "mid") say(RUN ? "(stopped at the middle page)" : "(the middle page stops here: press the door button to go on)");
          // A guided step ends here, flat: the log goes out as it stands, and then the question.
          if (RUN) void post("arrived flat").then(question);
        }
      }, 3000);
  });
})();

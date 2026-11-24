// The script of the one page for the owner's Quest (index.html beside it; docs/plans/headset-menu.md). It makes a
// picture of the stand-in menu on the page by the one way a page has (the elements and their styles written into
// an SVG picture, drawn to a canvas), checks the page may read it and the graphics card takes it, and says so in
// plain words. It fetches nothing, sends nothing and keeps nothing.
const answer = document.getElementById("answer");
const said = document.getElementById("said");
const ms = (n) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));
const say = (ok, head, lines) => {
  answer.textContent = head;
  answer.className = ok ? "yes" : "no";
  said.textContent = lines.join("\n");
  // The same, where a script or a person with a cable can read it.
  window.__result = { ok, head, lines };
};

/** The elements and their styles, written out as a picture the browser can draw. */
const written = () => {
  const menu = document.getElementById("menu");
  const box = menu.getBoundingClientRect();
  const css = [...document.styleSheets].map((s) => [...s.cssRules].map((r) => r.cssText).join("\n")).join("\n");
  const body = new XMLSerializer().serializeToString(menu);
  const w = Math.ceil(box.width), h = Math.ceil(box.height), k = 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}" height="${h * k}" viewBox="0 0 ${w} ${h}"><foreignObject width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css.replace(/</g, "\\3c ")}</style>${body}</div></foreignObject></svg>`;
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w: w * k, h: h * k };
};
const load = (src) => new Promise((done, fail) => {
  const img = new Image();
  const late = setTimeout(() => fail(new Error("late")), 8000);
  img.onload = () => { clearTimeout(late); done(img); };
  img.onerror = () => { clearTimeout(late); fail(new Error("refused")); };
  img.src = src;
});

async function once(canvas) {
  const t0 = performance.now();
  const { src, w, h } = written();
  const img = await load(src);
  canvas.width = w; canvas.height = h;
  const x = canvas.getContext("2d");
  x.clearRect(0, 0, w, h);
  x.drawImage(img, 0, 0);
  return { took: performance.now() - t0, w, h, x };
}

async function go() {
  answer.textContent = "Trying…";
  answer.className = "";
  said.textContent = "One moment.";
  const canvas = document.getElementById("made");
  let first;
  // 1. The picture is made at all.
  try {
    first = await once(canvas);
  } catch (e) {
    return say(false, "No.", [e.message === "late" ? "This browser never finished making the picture: nothing came in eight seconds." : "This browser would not make the picture at all.", "Step that failed: one, making it."]);
  }
  // 2. The page may read it, and there is something on it.
  let drawn = 0;
  try {
    const data = first.x.getImageData(0, 0, first.w, first.h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) drawn++;
  } catch {
    return say(false, "No.", ["This browser made a picture, and will not let the page read it.", "So it can't be shown in a headset's scene.", "Step that failed: two, reading it."]);
  }
  const part = drawn / (first.w * first.h);
  if (part < 0.5) return say(false, "No.", [`This browser made a picture with almost nothing on it: ${Math.round(part * 100)} parts in a hundred are drawn.`, "Step that failed: two, the picture is blank."]);
  // 3. The graphics card takes it, which is what a headset's scene needs.
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    if (!gl) throw new Error("no card");
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const px = new Uint8Array(4);
    gl.readPixels(Math.floor(first.w / 2), Math.floor(first.h / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    if (gl.getError() !== 0 || px[3] === 0) throw new Error("empty");
  } catch {
    return say(false, "No.", ["This browser made the picture, and its graphics card would not take it.", "Step that failed: three, handing it to the graphics card."]);
  }
  // 4. How long, made again five times: the middle one.
  const times = [];
  for (let i = 0; i < 5; i++) times.push((await once(canvas)).took);
  times.sort((a, b) => a - b);
  say(true, "Yes.", [
    "This browser makes the picture, the page may read it, and the graphics card takes it.",
    `The first time took ${ms(first.took)} milliseconds. After that, ${ms(times[2])} milliseconds (the slowest of five, ${ms(times[4])}).`,
    "Look at the two boxes below: the right one should look like the left one.",
    "Say what differs, if anything does: the words, the two drawn icons, the round corners, the bar to move along.",
  ]);
}
// Which browser this is, as it says itself: read out with the answer, it tells a Quest's browser from another.
document.getElementById("who").textContent = `This browser says it is: ${navigator.userAgent}`;
document.getElementById("again").addEventListener("click", go);
go();

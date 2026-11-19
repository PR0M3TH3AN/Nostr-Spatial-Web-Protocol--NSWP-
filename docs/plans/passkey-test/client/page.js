const log = document.getElementById("log");
const say = (label, value) => {
  log.value += `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`;
  log.scrollTop = log.scrollHeight;
};
const world = new URLSearchParams(location.search).get("world");
if (world && /^https?:\/\//.test(world)) document.getElementById("world").href = world;
else document.getElementById("world").closest("li").hidden = true;
say("page", "the client's own page");
say("browser", navigator.userAgent);
whatThisBrowserSays().then((v) => say("this browser says", v));
document.getElementById("make").onclick = async () => {
  const made = await makePasskey();
  // Something kept by the client on its own page, so the embedded component can say whether it can see it.
  try {
    if (made.ok) localStorage.setItem("nswp-passkey-test", "1");
  } catch {
    /* nothing kept */
  }
  say("1. make a passkey", made);
};
document.getElementById("use").onclick = async () => say("2. use it here", await usePasskey());
document.getElementById("copy").onclick = async () => {
  log.select();
  try {
    await navigator.clipboard.writeText(log.value);
    document.getElementById("copied").textContent = "Copied.";
  } catch {
    document.getElementById("copied").textContent = "Select the text above and copy it.";
  }
};

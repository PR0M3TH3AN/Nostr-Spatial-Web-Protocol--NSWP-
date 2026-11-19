// The client's component, embedded in a world. It answers one question from the page that embeds it, and tells
// that page only the result: a short mark of the secret, never the secret.
const storage = () => {
  try {
    return localStorage.getItem("nswp-passkey-test") ? "can see what the client kept on its own page" : "walled off from what the client kept on its own page";
  } catch (e) {
    return `blocked (${e.name})`;
  }
};
addEventListener("message", async (e) => {
  if (e.data?.type !== "use") return;
  // Who is asking is what the browser says it is, never what the asker says.
  e.source.postMessage({ type: "result", how: e.data.how ?? "asked by the world", asker: e.origin, storage: storage(), ...(await usePasskey()) }, e.origin);
});
document.getElementById("inside").onclick = async () => parent.postMessage({ type: "result", how: "pressed inside the component", storage: storage(), ...(await usePasskey()) }, "*");
document.getElementById("make-inside").onclick = async () => parent.postMessage({ type: "result", how: "extra: made from inside the component", ...(await makePasskey()) }, "*");
parent.postMessage({ type: "ready" }, "*");

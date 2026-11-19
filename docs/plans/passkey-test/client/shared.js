// A passkey test, and nothing else. No account, no sign-in to anything, nothing sent anywhere: every result stays
// on this page until you copy it yourself.
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
// The same fixed input every time, so the same passkey gives the same secret wherever it is asked.
const SALT = new Uint8Array(32).fill(7);
// The secret itself is never shown: only a short mark made from it, to see whether two places got the same one.
const markOf = async (secret) => hex(await crypto.subtle.digest("SHA-256", secret)).slice(0, 8);
const clientData = (cred) => {
  try {
    return JSON.parse(new TextDecoder().decode(cred.response.clientDataJSON));
  } catch {
    return null;
  }
};
const failure = (err) => ({ ok: false, error: err?.name ?? "Error", message: String(err?.message ?? err).slice(0, 180) });

async function usePasskey() {
  try {
    const cred = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname, userVerification: "required", timeout: 90000, extensions: { prf: { eval: { first: SALT } } } } });
    const secret = cred.getClientExtensionResults().prf?.results?.first;
    const data = clientData(cred);
    return { ok: true, secret: secret ? await markOf(secret) : "none (this passkey gave no secret)", signedFor: data?.origin ?? null, embedded: data?.crossOrigin ?? null, askedBy: data?.topOrigin ?? null };
  } catch (err) {
    return failure(err);
  }
}

async function makePasskey() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        rp: { name: "NSWP passkey test", id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "passkey-test", displayName: "Passkey test" },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        timeout: 90000,
        extensions: { prf: { eval: { first: SALT } } },
      },
    });
    const prf = cred.getClientExtensionResults().prf;
    return { ok: true, canGiveASecret: prf?.enabled ?? "not said", kept: cred.authenticatorAttachment ?? "not said" };
  } catch (err) {
    return failure(err);
  }
}

async function whatThisBrowserSays() {
  const out = { passkeys: typeof PublicKeyCredential !== "undefined" };
  try {
    out.builtIn = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    out.builtIn = "can't say";
  }
  try {
    const caps = await PublicKeyCredential.getClientCapabilities();
    out.secretFeature = caps["extension:prf"] ?? "not said";
    out.fromAPhone = caps.hybridTransport ?? "not said";
  } catch {
    out.secretFeature = "browser doesn't say";
  }
  return out;
}

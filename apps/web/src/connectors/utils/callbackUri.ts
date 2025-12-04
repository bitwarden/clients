const SELF_HOSTED = (process.env.SELF_HOSTED || "false").toLowerCase() === "true";

function appLinkHost(): string {
  const h = window.location.hostname || "";
  if (h.endsWith("bitwarden.eu")) {return "bitwarden.eu";}
  if (h.endsWith("bitwarden.pw")) {return "bitwarden.pw";}
  return "bitwarden.com";
}

export function buildMobileCallbackUri(kind: "sso" | "duo" | "webauthn"): string {
  const path = `${kind}-callback`;
  return SELF_HOSTED ? `bitwarden://${path}` : `https://${appLinkHost()}/${path}`;
}

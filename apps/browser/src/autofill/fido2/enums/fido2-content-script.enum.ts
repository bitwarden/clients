export const Fido2ContentScript = {
  PageScript: "content/fido2-page-script.js",
  PageScriptAppend: "content/fido2-page-script-append-mv2.js",
  PageScriptDelayAppend: "content/fido2-page-script-delay-append-mv2.js",
  ContentScript: "content/fido2-content-script.js",
} as const;

export const Fido2ContentScriptId = {
  PageScript: "fido2-page-script-registration",
  ContentScript: "fido2-content-script-registration",
} as const;

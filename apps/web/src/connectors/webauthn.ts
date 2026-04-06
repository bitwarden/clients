// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { b64Decode, buildMobileDeeplinkUriFromParam, getQsParam, navigateToUrl } from "./common";
import { buildDataString, parseWebauthnJson } from "./common-webauthn";

const mobileCallbackUri = "bitwarden://webauthn-callback";

/**
 * Determines the callback URI for mobile deep-link return.
 *
 * Priority: 1) deeplinkScheme query param, 2) mobile flag, 3) legacy callbackUri signal from data.
 * The dataObj.callbackUri value is intentionally never used as the URI — only its presence
 * signals a mobile flow. This prevents client-supplied payloads from governing the redirect target.
 */
export function resolveWebauthnCallbackUri(
  deeplinkScheme: string | null,
  dataObj: { mobile?: boolean; callbackUri?: string },
  buildDeeplink: () => string,
): string | null {
  if (deeplinkScheme) {
    return buildDeeplink();
  }
  const isMobileFlow = dataObj.mobile === true || dataObj.callbackUri != null;
  return isMobileFlow ? mobileCallbackUri : null;
}

let parsed = false;
let webauthnJson: any;
let headerText: string = null;
let btnText: string = null;
let btnAwaitingInteractionText: string = null;
let btnReturnText: string = null;
let parentUrl: string = null;
let parentOrigin: string = null;
let callbackUri: string = null;
let mobileResponse = false;
let stopWebAuthn = false;
let sentSuccess = false;
let obj: any = null;

// For accessibility, we do not actually disable the button as it would
// become unfocusable by a screenreader. We just make it look disabled.
const disabledBtnClasses = [
  "tw-bg-secondary-300",
  "tw-border-secondary-300",
  "!tw-text-muted",
  "!tw-cursor-not-allowed",
  "hover:tw-bg-secondary-300",
  "hover:tw-border-secondary-300",
  "hover:!tw-text-muted",
  "hover:tw-no-underline",
];

const enabledBtnClasses = [
  "tw-bg-primary-600",
  "tw-border-primary-600",
  "!tw-text-contrast",
  "hover:tw-bg-primary-700",
  "hover:tw-border-primary-700",
  "hover:!tw-text-contrast",
  "hover:tw-no-underline",
];

document.addEventListener("DOMContentLoaded", () => {
  init();
});

function setDefaultWebAuthnButtonState() {
  if (!btnText) {
    return;
  }

  const button = document.getElementById("webauthn-button");
  button.onclick = executeWebAuthn;

  button.innerText = decodeURI(btnText);

  // reset back to default button state
  button.classList.remove(...disabledBtnClasses);
  button.classList.add(...enabledBtnClasses);
}

function setAwaitingInteractionWebAuthnButtonState() {
  if (!btnAwaitingInteractionText) {
    return;
  }
  const button = document.getElementById("webauthn-button");
  button.innerText = decodeURI(btnAwaitingInteractionText);
  button.onclick = null;

  button.classList.remove(...enabledBtnClasses);
  button.classList.add(...disabledBtnClasses);
}

export function init() {
  start();
  onMessage();
  info("ready");
}

function parseParameters() {
  if (parsed) {
    return;
  }

  parentUrl = getQsParam("parent");
  if (parentUrl) {
    parentUrl = decodeURIComponent(parentUrl);
    parentOrigin = new URL(parentUrl).origin;
  }

  const version = getQsParam("v");

  if (version === "1") {
    parseParametersV1();
  } else {
    parseParametersV2();
  }

  // Require at least one return mechanism
  if (!parentUrl && !callbackUri) {
    error("No return target provided.");
    return;
  }

  parsed = true;
}

function parseParametersV1() {
  const data = getQsParam("data");
  if (!data) {
    error("No data.");
    return;
  }

  webauthnJson = b64Decode(data);
  headerText = getQsParam("headerText");
  btnText = getQsParam("btnText");
  btnAwaitingInteractionText = getQsParam("btnAwaitingInteractionText");
  btnReturnText = getQsParam("btnReturnText");
}

function parseParametersV2() {
  let dataObj: {
    data: any;
    headerText: string;
    btnText: string;
    btnReturnText: string;
    callbackUri?: string;
    mobile?: boolean;
  } = null;
  try {
    dataObj = JSON.parse(b64Decode(getQsParam("data")));
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    error("Cannot parse data.");
    return;
  }

  callbackUri = resolveWebauthnCallbackUri(getQsParam("deeplinkScheme"), dataObj, () =>
    buildMobileDeeplinkUriFromParam("webauthn"),
  );
  mobileResponse = callbackUri != null;

  webauthnJson = dataObj.data;
  headerText = dataObj.headerText;
  btnText = dataObj.btnText;
  btnReturnText = dataObj.btnReturnText;
}

function start() {
  sentSuccess = false;

  if (!("credentials" in navigator)) {
    error("WebAuthn is not supported in this browser.");
    return;
  }

  parseParameters();

  if (headerText) {
    const header = document.getElementById("webauthn-header");
    header.innerText = decodeURI(headerText);
  }

  setDefaultWebAuthnButtonState();

  if (!webauthnJson) {
    error("No data.");
    return;
  }

  try {
    obj = parseWebauthnJson(webauthnJson);
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    error("Cannot parse webauthn data.");
    return;
  }

  stopWebAuthn = false;

  if (
    mobileResponse ||
    (navigator.userAgent.indexOf(" Safari/") !== -1 && navigator.userAgent.indexOf("Chrome") === -1)
  ) {
    // Safari and mobile chrome blocks non-user initiated WebAuthn requests.
  } else {
    executeWebAuthn();
  }
}

function executeWebAuthn() {
  if (stopWebAuthn) {
    // reset back to default button state
    setDefaultWebAuthnButtonState();
    return;
  }

  setAwaitingInteractionWebAuthnButtonState();
  navigator.credentials.get({ publicKey: obj }).then(success).catch(error);
}

function onMessage() {
  window.addEventListener(
    "message",
    (event) => {
      if (parentOrigin && (!event.origin || event.origin === "" || event.origin !== parentOrigin)) {
        return;
      }

      if (event.data === "stop") {
        setDefaultWebAuthnButtonState();
        stopWebAuthn = true;
      } else if (event.data === "start" && stopWebAuthn) {
        start();
      }
    },
    false,
  );
}

function error(message: string) {
  if (callbackUri) {
    const uri = callbackUri + "?error=" + encodeURIComponent(message);
    navigateToUrl(uri);
    returnButton(uri);
  } else if (parentUrl) {
    parent.postMessage("error|" + message, parentUrl);
    setDefaultWebAuthnButtonState();
  }
}

function success(assertedCredential: PublicKeyCredential) {
  if (sentSuccess) {
    return;
  }

  const dataString = buildDataString(assertedCredential);

  if (callbackUri) {
    const uri = callbackUri + "?data=" + encodeURIComponent(dataString);
    navigateToUrl(uri);
    returnButton(uri);
  } else if (parentUrl) {
    parent.postMessage("success|" + dataString, parentUrl);
    sentSuccess = true;
  }
}

function info(message: string) {
  if (mobileResponse || !parentUrl) {
    return;
  }

  parent.postMessage("info|" + message, parentUrl);
}

function returnButton(uri: string) {
  // provides 'return' button in case scripted navigation is blocked
  const button = document.getElementById("webauthn-button");
  button.innerText = decodeURI(btnReturnText);
  button.onclick = () => {
    navigateToUrl(uri);
  };
}

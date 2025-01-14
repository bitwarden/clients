// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { b64Decode, getQsParam } from "./common";
import { buildDataString, parseWebauthnJson } from "./common-webauthn";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./webauthn.scss");

const mobileCallbackUri = "bitwarden://webauthn-callback";

let parsed = false;
let webauthnJson: any;
let headerText: string = null;
let btnText: string = null;
let btnReturnText: string = null;
let parentUrl: string = null;
let parentOrigin: string = null;
let mobileResponse = false;
let stopWebAuthn = false;
let sentSuccess = false;
let obj: any = null;

document.addEventListener("DOMContentLoaded", () => {
  init();

  parseParameters();
  if (headerText) {
    const header = document.getElementById("webauthn-header");
    header.innerText = decodeURI(headerText);
  }
  if (btnText) {
    const button = document.getElementById("webauthn-button");
    button.innerText = decodeURI(btnText);
    button.onclick = executeWebAuthn;
  }
});

function init() {
  start();
  onMessage();
  info("ready");
}

function parseParameters() {
  if (parsed) {
    return;
  }

  parentUrl = getQsParam("parent");
  if (!parentUrl) {
    error("No parent.");
    return;
  } else {
    parentUrl = decodeURIComponent(parentUrl);
    parentOrigin = new URL(parentUrl).origin;
  }

  const version = getQsParam("v");

  if (version === "1") {
    parseParametersV1();
  } else {
    parseParametersV2();
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

  mobileResponse = dataObj.callbackUri != null || dataObj.mobile === true;
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
    return;
  }

  navigator.credentials.get({ publicKey: obj }).then(success).catch(error);
}

function onMessage() {
  window.addEventListener(
    "message",
    (event) => {
      if (!event.origin || event.origin === "" || event.origin !== parentOrigin) {
        return;
      }

      if (event.data === "stop") {
        stopWebAuthn = true;
      } else if (event.data === "start" && stopWebAuthn) {
        start();
      }
    },
    false,
  );
}

function error(message: string) {
  if (mobileResponse) {
    document.location.replace(mobileCallbackUri + "?error=" + encodeURIComponent(message));
    returnButton(mobileCallbackUri + "?error=" + encodeURIComponent(message));
  } else {
    parent.postMessage("error|" + message, parentUrl);
  }
}

function success(assertedCredential: PublicKeyCredential) {
  if (sentSuccess) {
    return;
  }

  const dataString = buildDataString(assertedCredential);

  if (mobileResponse) {
    document.location.replace(mobileCallbackUri + "?data=" + encodeURIComponent(dataString));
    returnButton(mobileCallbackUri + "?data=" + encodeURIComponent(dataString));
  } else {
    parent.postMessage("success|" + dataString, parentUrl);
    sentSuccess = true;
  }
}

function info(message: string) {
  if (mobileResponse) {
    return;
  }

  parent.postMessage("info|" + message, parentUrl);
}

function returnButton(uri: string) {
  // provides 'return' button in case scripted navigation is blocked
  const button = document.getElementById("webauthn-button");
  button.innerText = decodeURI(btnReturnText);
  button.onclick = () => {
    document.location.replace(uri);
  };
}

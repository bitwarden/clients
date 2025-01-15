// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { b64Decode, getQsParam } from "./common";
import { buildDataString, parseWebauthnJson } from "./common-webauthn";
import { TranslationService } from "./translation.service";

// FIXME: Remove when updating file. Eslint update
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./webauthn.scss");

let parsed = false;
let webauthnJson: any;
let parentUrl: string = null;
let sentSuccess = false;
let locale: string = null;
let localeService: TranslationService = null;

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
  }

  locale = getQsParam("locale") ?? "en";

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
}

function parseParametersV2() {
  let dataObj: { data: any; btnText: string } = null;
  try {
    dataObj = JSON.parse(b64Decode(getQsParam("data")));
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    error("Cannot parse data.");
    return;
  }

  webauthnJson = dataObj.data;
}

document.addEventListener("DOMContentLoaded", async () => {
  parseParameters();
  try {
    localeService = new TranslationService(locale, "locales");
  } catch {
    error("Failed to load the provided locale " + locale);
    localeService = new TranslationService("en", "locales");
  }

  await localeService.init();

  document.getElementById("msg").innerText = localeService.t("webAuthnFallbackMsg");
  document.getElementById("remember-label").innerText = localeService.t("rememberMe");

  const button = document.getElementById("webauthn-button");
  button.innerText = localeService.t("webAuthnAuthenticate");
  button.onclick = start;

  document.getElementById("spinner").classList.add("d-none");
  const content = document.getElementById("content");
  content.classList.add("d-block");
  content.classList.remove("d-none");
});

function start() {
  if (sentSuccess) {
    return;
  }

  if (!("credentials" in navigator)) {
    error(localeService.t("webAuthnNotSupported"));
    return;
  }

  parseParameters();
  if (!webauthnJson) {
    error("No data.");
    return;
  }

  let json: any;
  try {
    json = parseWebauthnJson(webauthnJson);
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    error("Cannot parse data.");
    return;
  }

  // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  initWebAuthn(json);
}

async function initWebAuthn(obj: any) {
  try {
    const assertedCredential = (await navigator.credentials.get({
      publicKey: obj,
    })) as PublicKeyCredential;

    if (sentSuccess) {
      return;
    }

    const dataString = buildDataString(assertedCredential);
    const remember = (document.getElementById("remember") as HTMLInputElement).checked;
    window.postMessage({ command: "webAuthnResult", data: dataString, remember: remember }, "*");

    sentSuccess = true;
    success(localeService.t("webAuthnSuccess"));
  } catch (err) {
    error(err);
  }
}

function error(message: string) {
  const el = document.getElementById("msg");
  resetMsgBox(el);
  el.textContent = message;
  el.classList.add("alert");
  el.classList.add("alert-danger");
}

function success(message: string) {
  (document.getElementById("webauthn-button") as HTMLButtonElement).disabled = true;

  const el = document.getElementById("msg");
  resetMsgBox(el);
  el.textContent = message;
  el.classList.add("alert");
  el.classList.add("alert-success");
}

function resetMsgBox(el: HTMLElement) {
  el.classList.remove("alert");
  el.classList.remove("alert-danger");
  el.classList.remove("alert-success");
}

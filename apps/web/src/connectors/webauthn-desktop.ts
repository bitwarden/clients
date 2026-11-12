import {
  BackgroundLeftIllustration,
  BackgroundRightIllustration,
  BitwardenLogo,
  SecurityKeyIcon,
} from "@bitwarden/assets/svg";
import * as sdk from "@bitwarden/sdk-internal";

import { navigateToUrl } from "./common";
import { buildExtendedData, parseWebauthnJson } from "./common-webauthn";
import { TranslationService } from "./translation.service";

/**
 * The WebAuthn connector for the desktop app, which opens it in a browser where the platform's
 * passkey APIs can't be used. It makes the request in the URL fragment, and returns the result to
 * `bitwarden://webauthn-callback`.
 *
 * The request is read, and the response encrypted to the app's ephemeral key, with
 * `bitwarden-web-connector`. macOS doesn't need the encryption, since only the app's
 * `ASWebAuthenticationSession` receives the callback URL, but on Linux the URL passes through the
 * system's URL scheme handler, where other apps may see it. The response contains PRF outputs.
 *
 * Anyone can craft a request URL, so everything the page shows is its own.
 */

/** The response, which is encrypted to the app's key. The desktop app must read the same format. */
export type DesktopConnectorResponse =
  | { credential: ReturnType<typeof buildExtendedData> }
  | { error: { name?: string; message: string } };

let i18n: TranslationService;
let responder: sdk.WebConnectorResponder | null = null;
let options: PublicKeyCredentialRequestOptions;
/** Aborts the WebAuthn request in progress, which the user may start again from the button. */
let inProgress: AbortController | null = null;

document.addEventListener("DOMContentLoaded", () => {
  void init();
});

export async function init() {
  inProgress = null;
  renderIllustrations();

  i18n = new TranslationService(navigator.language, "locales");
  await i18n.init();

  // The desktop app opens this page in a browser window. In a frame, another site could trick the
  // user into approving a request it crafted, so don't read the request at all. The server also
  // sends X-Frame-Options, but self-hosted proxies might not.
  if (isFramed(window)) {
    showMessage(i18n.t("passkeyAuthenticationFailed"));
    return;
  }

  try {
    await loadSdk();
    responder = sdk.WebConnectorResponder.read_request(
      sdk.Connector.WebAuthnAssertion,
      window.location.hash,
    );
    options = parseWebauthnJson(new TextDecoder().decode(responder.request()));
  } catch {
    // Without a valid request, there is no key to return a response to.
    responder = null;
    showMessage(i18n.t("passkeyAuthenticationFailed"));
    return;
  }

  setHeader(i18n.t("useYourPasskeyOrSecurityKeyToContinue"));
  setButton(i18n.t("continue"), executeWebAuthn);

  if (!("credentials" in navigator)) {
    respond({ error: { name: "NotSupportedError", message: i18n.t("webAuthnNotSupported") } });
    return;
  }

  // Safari blocks requests that the user didn't start.
  const safari =
    navigator.userAgent.indexOf(" Safari/") !== -1 && navigator.userAgent.indexOf("Chrome") === -1;
  if (safari) {
    return;
  }
  // Browsers don't show the prompt for a page without focus, e.g. one opened from the app in a
  // background tab, so wait until the user switches to it.
  if (document.hasFocus()) {
    executeWebAuthn();
  } else {
    window.addEventListener(
      "focus",
      () => {
        if (inProgress == null) {
          executeWebAuthn();
        }
      },
      { once: true },
    );
  }
}

/** Whether `win` is in a frame rather than the top-level window. */
export function isFramed(win: { self: unknown; top: unknown }): boolean {
  return win.top !== win.self;
}

async function loadSdk() {
  const module = await import("@bitwarden/sdk-internal/bitwarden_wasm_internal_bg.wasm");
  (sdk as unknown as { init: (module: unknown) => void }).init(module);
}

/**
 * Makes the WebAuthn request. If one is in progress, e.g. because the browser didn't show its
 * prompt, it is aborted and replaced.
 */
function executeWebAuthn() {
  inProgress?.abort();
  const request = new AbortController();
  inProgress = request;

  navigator.credentials.get({ publicKey: options, signal: request.signal }).then(
    (credential) => respond({ credential: buildExtendedData(credential as PublicKeyCredential) }),
    (e: unknown) => {
      // The user started the request again.
      if (request.signal.aborted) {
        return;
      }
      respond({
        error:
          e instanceof Error
            ? { name: e.name, message: e.message }
            : { name: "NotAllowedError", message: String(e) },
      });
    },
  );
}

/** Encrypts the response and returns it to the app. A request can only be responded to once. */
function respond(response: DesktopConnectorResponse) {
  if (responder == null) {
    return;
  }
  const pending = responder;
  responder = null;

  let callbackUrl: string;
  try {
    callbackUrl = pending.encrypt_response(new TextEncoder().encode(JSON.stringify(response)));
  } catch {
    showMessage(i18n.t("passkeyAuthenticationFailed"));
    return;
  }

  navigateToUrl(callbackUrl);
  // In case the browser blocks the scripted navigation to the app.
  setButton(i18n.t("returnToBitwarden"), () => navigateToUrl(callbackUrl));
}

/** Shows a message where nothing can be returned to the app, and hides the button. */
function showMessage(message: string) {
  setHeader(message);
  getButton().hidden = true;
}

function setHeader(text: string) {
  document.getElementById("webauthn-header")!.innerText = text;
}

function setButton(text: string, onclick: () => void) {
  const button = getButton();
  button.innerText = text;
  button.onclick = onclick;
}

function getButton() {
  return document.getElementById("webauthn-button")!;
}

function renderIllustrations() {
  const svgs = {
    "webauthn-logo": BitwardenLogo,
    "webauthn-icon": SecurityKeyIcon,
    "webauthn-illustration-left": BackgroundLeftIllustration,
    "webauthn-illustration-right": BackgroundRightIllustration,
  };
  for (const [id, content] of Object.entries(svgs)) {
    const element = document.getElementById(id);
    if (element != null) {
      // The SVGs are static markup from @bitwarden/assets, not user content.
      element.innerHTML = content.svg;
    }
  }
}

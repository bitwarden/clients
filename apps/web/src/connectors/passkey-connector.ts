// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { getQsParam } from "./common";
import { TranslationService } from "./translation.service";

let parametersParsed = false;
let locale: string = null;
let localeService: TranslationService = null;
let extensionPublicKeyB64: string = null;
let resultSent = false;
let mode: "login" | "unlock" = "login";
let unlockCredentials: { id: string; transports: string[] }[] | null = null;

// PRF salt for login - must match WebAuthnLoginPrfKeyService.getLoginWithPrfSalt()
// The salt is the string "passwordless-login" hashed with SHA-256
const LOGIN_WITH_PRF_SALT_STRING = "passwordless-login";
let prfSaltCache: Uint8Array | null = null;

/**
 * Get the PRF salt by hashing the salt string with SHA-256.
 * This must match WebAuthnLoginPrfKeyService.getLoginWithPrfSalt()
 */
async function getLoginWithPrfSalt(): Promise<Uint8Array> {
  if (prfSaltCache) {
    return prfSaltCache;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(LOGIN_WITH_PRF_SALT_STRING);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  prfSaltCache = new Uint8Array(hashBuffer);
  return prfSaltCache;
}

function parseParameters() {
  if (parametersParsed) {
    return;
  }

  // Parse URL fragment (avoids sending key to server)
  const fragment = window.location.hash.slice(1); // remove leading #
  const params = new URLSearchParams(fragment);
  extensionPublicKeyB64 = params.get("extensionPublicKey");
  if (!extensionPublicKeyB64) {
    error("No extension public key provided.");
    return;
  }

  // Parse mode (login or unlock)
  const modeParam = params.get("mode");
  if (modeParam === "unlock") {
    mode = "unlock";
    const credentialsParam = params.get("credentials");
    if (credentialsParam) {
      try {
        unlockCredentials = JSON.parse(decodeURIComponent(credentialsParam));
      } catch {
        error("Invalid credentials format.");
        return;
      }
    } else {
      error("No credentials provided for unlock mode.");
      return;
    }
  }

  locale = getQsParam("locale") ?? "en";
  parametersParsed = true;
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

  document.documentElement.lang = locale;

  const button = document.getElementById("passkey-button");
  button.innerText = localeService.t("authenticateWithPasskey");
  button.onclick = () => void start();

  const title = document.getElementById("title");

  if (mode === "unlock") {
    title.innerText = localeService.t("unlockWithPasskey");
  } else {
    title.innerText = localeService.t("logInWithPasskey");
  }

  const subtitle = document.getElementById("subtitle");
  if (mode === "unlock") {
    subtitle.innerText = localeService.t("followTheStepsBelowToFinishUnlockingWithPasskey");
  } else {
    subtitle.innerText = localeService.t("followTheStepsBelowToFinishLoggingInWithPasskey");
  }

  // Auto-start if user has already clicked the button previously
  const autoStart = getQsParam("autoStart");
  if (autoStart === "true") {
    void start();
  }
});

function start() {
  if (resultSent) {
    return;
  }

  if (!("credentials" in navigator)) {
    error(localeService.t("webAuthnNotSupported"));
    return;
  }

  parseParameters();
  if (!extensionPublicKeyB64) {
    error("No extension public key provided.");
    return;
  }

  void initPasskeyLogin();
}

async function initPasskeyLogin() {
  try {
    let credential: PublicKeyCredential;
    let token: string | null = null;
    let prfOutput: ArrayBuffer | null = null;

    if (mode === "unlock") {
      // Unlock mode: Use provided credentials directly
      credential = await performUnlockWebAuthn();
      if (!credential) {
        error(localeService.t("passkeyAuthenticationFailed"));
        return;
      }
      prfOutput = (credential.getClientExtensionResults() as any)?.prf?.results?.first ?? null;
    } else {
      // Login mode: Fetch assertion options from the server
      const apiOrigin = window.location.origin;
      const response = await fetch(`${apiOrigin}/identity/accounts/webauthn/assertion-options`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch assertion options: ${response.status}`);
      }

      const { options, token: serverToken } = await response.json();
      token = serverToken;

      // Parse the assertion options and perform WebAuthn
      const publicKeyOptions = parseAssertionOptions(options);
      credential = await performLoginWebAuthn(publicKeyOptions);

      if (!credential) {
        error(localeService.t("passkeyAuthenticationFailed"));
        return;
      }

      prfOutput = (credential.getClientExtensionResults() as any)?.prf?.results?.first ?? null;
    }

    if (resultSent) {
      return;
    }

    // Encrypt the PRF output with the extension's ECDH public key if present
    let encryptedPrfOutput = null;
    let connectorPublicKeyB64 = null;
    if (prfOutput && extensionPublicKeyB64) {
      const encryptionResult = await encryptPrfWithEcdh(prfOutput, extensionPublicKeyB64);
      encryptedPrfOutput = {
        ciphertext: encryptionResult.ciphertext,
        iv: encryptionResult.iv,
      };
      connectorPublicKeyB64 = encryptionResult.connectorPublicKey;
    }

    // Post result back to extension via content script
    if (mode === "unlock") {
      // Unlock mode: Send credentialId and encrypted PRF output
      window.postMessage(
        {
          command: "passkeyUnlockResult",
          credentialId: credential.id,
          encryptedPrfOutput,
          connectorPublicKey: connectorPublicKeyB64,
        },
        "*",
      );
      resultSent = true;
      success(localeService.t("passkeyUnlockSuccess"));
    } else {
      // Login mode: Send full assertion data
      const assertionData = serializeAssertionData(credential);
      window.postMessage(
        {
          command: "passkeyLoginResult",
          token,
          assertionData,
          encryptedPrfOutput,
          connectorPublicKey: connectorPublicKeyB64,
        },
        "*",
      );
      resultSent = true;
      success(localeService.t("passkeyLoginSuccess"));
    }
  } catch (err) {
    error(err.message || err);
  }
}

/**
 * Perform WebAuthn authentication for unlock mode.
 * Uses the provided credentials directly.
 */
async function performUnlockWebAuthn(): Promise<PublicKeyCredential> {
  if (!unlockCredentials || unlockCredentials.length === 0) {
    throw new Error("No credentials available for unlock");
  }

  // Build allowCredentials from the provided credentials
  const allowCredentials = unlockCredentials.map((cred) => ({
    type: "public-key" as const,
    id: base64urlToBuffer(cred.id),
    transports: cred.transports as AuthenticatorTransport[],
  }));

  // Get the PRF salt (same as login)
  const prfSalt = await getLoginWithPrfSalt();

  // Call credentials.get() with PRF extension
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials,
      userVerification: "preferred",
      extensions: {
        prf: { eval: { first: prfSalt.buffer as ArrayBuffer } },
      },
    },
  })) as PublicKeyCredential;

  return credential;
}

/**
 * Perform WebAuthn authentication for login mode.
 * Uses the server's assertion options.
 */
async function performLoginWebAuthn(
  publicKeyOptions: PublicKeyCredentialRequestOptions,
): Promise<PublicKeyCredential> {
  // Get the PRF salt (must match WebAuthnLoginPrfKeyService.getLoginWithPrfSalt)
  const prfSalt = await getLoginWithPrfSalt();

  // Call credentials.get() with PRF extension
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...publicKeyOptions,
      extensions: {
        prf: { eval: { first: prfSalt.buffer as ArrayBuffer } },
      },
    },
  })) as PublicKeyCredential;

  return credential;
}

/**
 * Parse assertion options from server response
 */
function parseAssertionOptions(options: any): PublicKeyCredentialRequestOptions {
  const challenge = options.challenge.replace(/-/g, "+").replace(/_/g, "/");
  const challengeBuffer = Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0));

  const allowCredentials =
    options.allowCredentials?.map((cred: any) => {
      const id = cred.id.replace(/_/g, "/").replace(/-/g, "+");
      return {
        ...cred,
        id: Uint8Array.from(atob(id), (c) => c.charCodeAt(0)),
      };
    }) || [];

  return {
    ...options,
    challenge: challengeBuffer,
    allowCredentials,
  };
}

/**
 * Serialize assertion data to match WebAuthnLoginAssertionResponseRequest format.
 * This is critical because the extension uses Object.assign() with the prototype,
 * and the field names must match exactly (case-sensitive).
 *
 * Differences from buildDataString():
 * - Uses 'clientDataJSON' (uppercase) instead of 'clientDataJson' (lowercase)
 * - Includes 'userHandle' field which is required by WebAuthnLoginAssertionResponseRequest
 */
function serializeAssertionData(credential: PublicKeyCredential): string {
  const response = credential.response as AuthenticatorAssertionResponse;

  const data = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    extensions: {}, // Empty - PRF must not go to server
    response: {
      authenticatorData: bufferToBase64url(response.authenticatorData),
      clientDataJSON: bufferToBase64url(response.clientDataJSON), // Note: uppercase JSON
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };

  return JSON.stringify(data);
}

/**
 * Encrypt PRF output using ECDH key exchange
 *
 * @param prfOutput - The raw PRF output bytes (ArrayBuffer)
 * @param extensionPublicKeyB64 - Base64url-encoded extension ECDH public key
 * @returns Object containing ciphertext, IV, and connector's public key
 */
async function encryptPrfWithEcdh(
  prfOutput: ArrayBuffer,
  extensionPublicKeyB64: string,
): Promise<{
  ciphertext: string;
  iv: string;
  connectorPublicKey: string;
}> {
  // Import the extension's public key
  const extensionPublicKeyBuffer = base64urlToBuffer(extensionPublicKeyB64);

  // Generate ephemeral ECDH key pair for the connector (P-256)
  const connectorKeyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // extractable
    ["deriveBits"],
  );

  // Import extension public key
  const extensionPublicKey = await window.crypto.subtle.importKey(
    "raw",
    extensionPublicKeyBuffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    false,
    [],
  );

  // Derive shared secret using ECDH
  const sharedSecret = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: extensionPublicKey,
    },
    connectorKeyPair.privateKey,
    256,
  );

  // Derive AES-GCM key from shared secret using HKDF-like approach
  // We'll use the raw shared secret to derive an AES key
  const aesKey = await deriveAesKeyFromSharedSecret(sharedSecret);

  // Generate random IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the PRF output
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    aesKey,
    prfOutput,
  );

  // Export connector's public key to send back
  const connectorPublicKeyBuffer = await window.crypto.subtle.exportKey(
    "raw",
    connectorKeyPair.publicKey,
  );

  return {
    ciphertext: bufferToBase64url(ciphertext),
    iv: bufferToBase64url(iv.buffer as ArrayBuffer),
    connectorPublicKey: bufferToBase64url(connectorPublicKeyBuffer),
  };
}

/**
 * Derive AES-GCM key from shared secret
 */
async function deriveAesKeyFromSharedSecret(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
  // Use the shared secret directly as key material
  // In production, you might want to use HKDF for better key separation
  const keyMaterial = await window.crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, [
    "deriveKey",
  ]);

  return await window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      salt: new Uint8Array(0), // Empty salt - the shared secret is already random
      info: new TextEncoder().encode("passkey-login-prf"),
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt"],
  );
}

/**
 * Convert base64url string to ArrayBuffer
 */
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const padded = base64 + padding;
  const binary = atob(padded);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer.buffer;
}

/**
 * Convert ArrayBuffer to base64url string
 */
function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function error(message: string) {
  const el = document.getElementById("msg");
  resetMsgBox(el);
  el.textContent = message;
  el.classList.add("alert");
  el.classList.add("alert-danger");
  el.classList.remove("tw-hidden");
}

function success(message: string) {
  (document.getElementById("passkey-button") as HTMLButtonElement).disabled = true;

  const msgEl = document.getElementById("msg");
  resetMsgBox(msgEl);
  msgEl.textContent = message;
  msgEl.classList.add("alert");
  msgEl.classList.add("alert-success");
  msgEl.classList.remove("tw-hidden");

  // Delay closing to allow async messages (postMessage) to be processed
  setTimeout(() => {
    window.close();
  }, 2000);
}

function resetMsgBox(el: HTMLElement) {
  el.classList.remove("alert");
  el.classList.remove("alert-danger");
  el.classList.remove("alert-success");
  el.classList.add("tw-hidden");
}

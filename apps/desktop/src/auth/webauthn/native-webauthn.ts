import { SemVer } from "semver";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import type { webauthn } from "@bitwarden/desktop-napi";

/**
 * The first server version whose web vault serves the desktop WebAuthn connector
 * (`webauthn-desktop-connector.html`). Servers and their web vaults are released together.
 */
export const WEBAUTHN_CONNECTOR_MIN_SERVER_VERSION = new SemVer("2026.11.0");

/** The web vault that requests are made on behalf of. */
export type WebVault = {
  url: string;
  /**
   * Whether the web vault serves the desktop WebAuthn connector, which makes requests in a browser
   * where the platform's passkey APIs can't be used.
   */
  supportsConnector: boolean;
};

/** The WebAuthn methods exposed to the renderer by the preload script. */
export type NativeWebAuthnIpc = {
  /**
   * `webVault` is used if the request has to be made in a browser, with the web vault's WebAuthn
   * connector. Its origin must be the request's origin.
   */
  getAssertion(
    requestId: string,
    request: webauthn.AssertionRequest,
    webVault: WebVault,
  ): Promise<webauthn.GetAssertionResult>;
  cancel(requestId: string): Promise<void>;
};

/** The subset of the extension inputs that is supported. */
type ExtensionInputs = {
  appid?: string;
  prf?: { eval?: { first: BufferSource; second?: BufferSource } };
};

/**
 * Replaces `navigator.credentials.get()` for public key credentials with the platform's passkey
 * APIs, which Electron does not use, while `enabled` resolves to `true`. Other credential requests
 * are passed through.
 *
 * Requests are made for the origin of the web vault returned by `getWebVault`, since the
 * renderer's own origin is not a web origin. Aborting the request's `signal` closes the platform's prompt.
 *
 * Returned credentials pass `instanceof PublicKeyCredential` and
 * `instanceof AuthenticatorAssertionResponse` checks, but are plain objects: their members are own
 * properties rather than the native implementations.
 */
export function installNativeWebAuthn(
  win: Window,
  ipc: NativeWebAuthnIpc,
  enabled: () => Promise<boolean>,
  getWebVault: () => Promise<WebVault>,
): void {
  const credentials = win.navigator.credentials;
  const originalGet = credentials.get.bind(credentials);
  Object.defineProperty(credentials, "get", {
    configurable: true,
    value: async (options?: CredentialRequestOptions): Promise<Credential | null> => {
      if (options?.publicKey == null || !(await enabled())) {
        return originalGet(options);
      }

      const signal = options.signal;
      if (signal?.aborted) {
        throw abortReason(signal);
      }

      const extensions = (options.publicKey.extensions ?? {}) as ExtensionInputs;
      const publicKey = options.publicKey;
      const requestId = Utils.newGuid();
      const result = await rejectOnAbort(
        getWebVault().then((webVault) => {
          // Do not show a prompt that nothing is waiting for.
          if (signal?.aborted) {
            throw abortReason(signal);
          }
          const origin = new URL(webVault.url).origin;
          return ipc.getAssertion(
            requestId,
            toAssertionRequest(origin, publicKey, extensions),
            webVault,
          );
        }),
        signal,
        () => void ipc.cancel(requestId),
      );
      if (result.error != null) {
        throw new DOMException(result.error.message, result.error.name);
      }
      if (result.response == null) {
        throw new DOMException("No assertion was returned.", "UnknownError");
      }
      return toPublicKeyCredential(result.response, extensions);
    },
  });
}

/**
 * Rejects with the abort reason as soon as `signal` is aborted, as WebAuthn requires, rather than
 * waiting for `promise` to settle.
 */
function rejectOnAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  onAbort: () => void,
): Promise<T> {
  if (signal == null) {
    return promise;
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      onAbort();
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

function toAssertionRequest(
  origin: string,
  options: PublicKeyCredentialRequestOptions,
  extensions: ExtensionInputs,
): webauthn.AssertionRequest {
  const prf = extensions.prf;
  return {
    origin,
    // The native module rejects an RP ID that is not valid for the origin.
    rpId: options.rpId ?? "",
    challenge: toBytes(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((c) => ({
      id: toBytes(c.id),
      transports: c.transports,
    })),
    userVerification: options.userVerification,
    timeout: options.timeout,
    prf:
      prf?.eval == null
        ? undefined
        : {
            first: toBytes(prf.eval.first),
            second: prf.eval.second == null ? undefined : toBytes(prf.eval.second),
          },
    // The native module rejects an app ID that is not valid for the origin.
    appId: extensions.appid,
  };
}

function toPublicKeyCredential(
  assertion: webauthn.AssertionResponse,
  extensions: ExtensionInputs,
): PublicKeyCredential {
  const clientDataJSON = toArrayBuffer(assertion.clientDataJson);
  const authenticatorData = toArrayBuffer(assertion.authenticatorData);
  const signature = toArrayBuffer(assertion.signature);
  const userHandle = assertion.userHandle == null ? null : toArrayBuffer(assertion.userHandle);
  const response: AuthenticatorAssertionResponse = Object.create(
    AuthenticatorAssertionResponse.prototype,
  );
  defineValues(response, { clientDataJSON, authenticatorData, signature, userHandle });

  const clientExtensionResults: AuthenticationExtensionsClientOutputs = {};
  if (extensions.appid != null) {
    clientExtensionResults.appid = assertion.appIdUsed ?? false;
  }
  if (extensions.prf != null) {
    (clientExtensionResults as { prf: unknown }).prf =
      assertion.prf == null
        ? {}
        : {
            results: {
              first: toArrayBuffer(assertion.prf.first),
              second:
                assertion.prf.second == null ? undefined : toArrayBuffer(assertion.prf.second),
            },
          };
  }

  const rawId = toArrayBuffer(assertion.credentialId);
  const id = Utils.fromBufferToUrlB64(rawId);
  const authenticatorAttachment = assertion.authenticatorAttachment ?? null;
  const credential: PublicKeyCredential = Object.create(PublicKeyCredential.prototype);
  defineValues(credential, {
    id,
    rawId,
    type: "public-key",
    authenticatorAttachment,
    response,
    getClientExtensionResults: () => clientExtensionResults,
    toJSON: () => ({
      id,
      rawId: id,
      type: "public-key",
      authenticatorAttachment,
      response: {
        clientDataJSON: Utils.fromBufferToUrlB64(clientDataJSON),
        authenticatorData: Utils.fromBufferToUrlB64(authenticatorData),
        signature: Utils.fromBufferToUrlB64(signature),
        userHandle: userHandle == null ? undefined : Utils.fromBufferToUrlB64(userHandle),
      },
      clientExtensionResults: clientExtensionResultsJSON(clientExtensionResults),
    }),
  });
  return credential;
}

function clientExtensionResultsJSON(
  results: AuthenticationExtensionsClientOutputs,
): Record<string, unknown> {
  const json: Record<string, unknown> = {};
  if (results.appid != null) {
    json.appid = results.appid;
  }
  const prf = (results as { prf?: { results?: { first: ArrayBuffer; second?: ArrayBuffer } } }).prf;
  if (prf == null) {
    return json;
  }
  return {
    ...json,
    prf:
      prf.results == null
        ? {}
        : {
            results: {
              first: Utils.fromBufferToUrlB64(prf.results.first),
              second:
                prf.results.second == null
                  ? undefined
                  : Utils.fromBufferToUrlB64(prf.results.second),
            },
          },
  };
}

/** Defines read-only own properties, which shadow the native getters on the prototype. */
function defineValues(target: object, values: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(target, key, { value, enumerable: true });
  }
}

/** Copies only the viewed bytes, so that the rest of an underlying buffer is not sent over IPC. */
function toBytes(source: BufferSource): Uint8Array {
  if (ArrayBuffer.isView(source)) {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice();
  }
  return new Uint8Array(source).slice();
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

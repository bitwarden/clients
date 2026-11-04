import type { webauthn } from "@bitwarden/desktop-napi";

/** The scheme of the URL that the connector returns its result to, which ends the session. */
export const CONNECTOR_CALLBACK_SCHEME = "bitwarden";

/** A credential from the connector, with binary values as base64url. */
type ConnectorCredential = {
  rawId: string;
  authenticatorAttachment?: string | null;
  extensions?: {
    appid?: boolean;
    prf?: { results?: { first: string; second?: string } };
  };
  response: {
    authenticatorData: string;
    clientDataJson: string;
    signature: string;
    userHandle?: string | null;
  };
};

/**
 * The connector's response, which it encrypts to the request's ephemeral key: a credential, or the
 * error that `navigator.credentials.get()` threw.
 */
type ConnectorResponse =
  { credential: ConnectorCredential } | { error: { name?: string; message: string } };

/**
 * Whether the connector may be loaded from the web vault URL for a request from `origin`. The
 * browser checks that the RP ID is valid for the connector's origin.
 */
export function isValidWebVaultUrl(webVaultUrl: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(webVaultUrl);
  } catch {
    return false;
  }
  const secure =
    url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  return secure && url.origin === origin;
}

/**
 * The URL of the web vault's WebAuthn connector for the desktop app, which makes the request in the
 * browser and returns the result to `bitwarden://webauthn-callback`.
 */
export function connectorPageUrl(webVaultUrl: string): string {
  const base = webVaultUrl.endsWith("/") ? webVaultUrl : webVaultUrl + "/";
  return new URL("webauthn-desktop-connector.html", base).href;
}

/**
 * The request for the connector: `request`'s options as WebAuthn JSON
 * (`PublicKeyCredentialRequestOptionsJSON`). It is sent in plaintext, in the URL fragment.
 */
export function buildConnectorRequest(request: webauthn.AssertionRequest): Uint8Array {
  const options = {
    challenge: toBase64Url(request.challenge),
    rpId: request.rpId,
    allowCredentials: request.allowCredentials.map((c) => ({
      type: "public-key",
      id: toBase64Url(c.id),
      transports: c.transports,
    })),
    userVerification: request.userVerification,
    timeout: request.timeout,
    extensions: {
      appid: request.appId,
      prf:
        request.prf == null
          ? undefined
          : {
              eval: {
                first: toBase64Url(request.prf.first),
                second: request.prf.second == null ? undefined : toBase64Url(request.prf.second),
              },
            },
    },
  };
  return new TextEncoder().encode(JSON.stringify(options));
}

/**
 * Converts the connector's decrypted response.
 *
 * The response contains PRF outputs, which are secrets, so it and errors from parsing it must not
 * be logged.
 */
export function parseConnectorResponse(
  response: Uint8Array,
  request: webauthn.AssertionRequest,
): webauthn.GetAssertionResult {
  let parsed: ConnectorResponse;
  try {
    parsed = JSON.parse(new TextDecoder().decode(response));
  } catch {
    // Do not include the parse error, which may quote the response.
    throw new Error("Invalid WebAuthn connector response.");
  }

  if ("error" in parsed) {
    return {
      error: { name: parsed.error.name ?? "NotAllowedError", message: parsed.error.message },
    };
  }

  const data = parsed.credential;
  const prf = data.extensions?.prf?.results;
  return {
    response: {
      credentialId: fromBase64Url(data.rawId),
      clientDataJson: fromBase64Url(data.response.clientDataJson),
      authenticatorData: fromBase64Url(data.response.authenticatorData),
      signature: fromBase64Url(data.response.signature),
      userHandle:
        data.response.userHandle == null ? undefined : fromBase64Url(data.response.userHandle),
      authenticatorAttachment: data.authenticatorAttachment ?? undefined,
      prf:
        prf == null
          ? undefined
          : {
              first: fromBase64Url(prf.first),
              second: prf.second == null ? undefined : fromBase64Url(prf.second),
            },
      appIdUsed: request.appId == null ? undefined : (data.extensions?.appid ?? false),
    },
  };
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

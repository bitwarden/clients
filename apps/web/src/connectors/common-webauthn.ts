export function buildDataString(assertedCredential: PublicKeyCredential) {
  return JSON.stringify(buildData(assertedCredential));
}

/**
 * Like {@link buildDataString}, as an object, with the members that are also needed to log in or
 * unlock with a passkey: the user handle, the authenticator attachment, and PRF results as
 * base64url.
 */
export function buildExtendedData(assertedCredential: PublicKeyCredential) {
  const data = buildData(assertedCredential);
  const response = assertedCredential.response as AuthenticatorAssertionResponse;
  const prf = (
    data.extensions as {
      prf?: { results?: { first: ArrayBuffer; second?: ArrayBuffer } };
    }
  ).prf;

  return {
    ...data,
    authenticatorAttachment: assertedCredential.authenticatorAttachment ?? null,
    extensions: {
      ...data.extensions,
      prf:
        prf == null
          ? undefined
          : {
              results:
                prf.results == null
                  ? undefined
                  : {
                      first: coerceToBase64Url(prf.results.first),
                      second:
                        prf.results.second == null
                          ? undefined
                          : coerceToBase64Url(prf.results.second),
                    },
            },
    },
    response: {
      ...data.response,
      userHandle: response.userHandle == null ? null : coerceToBase64Url(response.userHandle),
    },
  };
}

function buildData(assertedCredential: PublicKeyCredential) {
  const response = assertedCredential.response as AuthenticatorAssertionResponse;

  const authData = new Uint8Array(response.authenticatorData);
  const clientDataJSON = new Uint8Array(response.clientDataJSON);
  const rawId = new Uint8Array(assertedCredential.rawId);
  const sig = new Uint8Array(response.signature);

  const data = {
    id: assertedCredential.id,
    rawId: coerceToBase64Url(rawId),
    type: assertedCredential.type,
    extensions: assertedCredential.getClientExtensionResults(),
    response: {
      authenticatorData: coerceToBase64Url(authData),
      clientDataJson: coerceToBase64Url(clientDataJSON),
      signature: coerceToBase64Url(sig),
    },
  };

  return data;
}

export function parseWebauthnJson(jsonString: string) {
  const json = JSON.parse(jsonString);

  const challenge = json.challenge.replace(/-/g, "+").replace(/_/g, "/");
  json.challenge = Uint8Array.from(atob(challenge), (c) => c.charCodeAt(0));

  // Requests for discoverable credentials, to log in with a passkey, may omit allowCredentials.
  json.allowCredentials?.forEach((listItem: any) => {
    // eslint-disable-next-line
    const fixedId = listItem.id.replace(/\_/g, "/").replace(/\-/g, "+");
    listItem.id = Uint8Array.from(atob(fixedId), (c) => c.charCodeAt(0));
  });

  const prfEval = json.extensions?.prf?.eval;
  if (prfEval != null) {
    prfEval.first = fromBase64Url(prfEval.first);
    if (prfEval.second != null) {
      prfEval.second = fromBase64Url(prfEval.second);
    }
  }

  return json;
}

function fromBase64Url(base64Url: string) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// From https://github.com/abergs/fido2-net-lib/blob/b487a1d47373ea18cd752b4988f7262035b7b54e/Demo/wwwroot/js/helpers.js#L34
// License: https://github.com/abergs/fido2-net-lib/blob/master/LICENSE.txt
function coerceToBase64Url(thing: any) {
  // Array or ArrayBuffer to Uint8Array
  if (Array.isArray(thing)) {
    thing = Uint8Array.from(thing);
  }

  if (thing instanceof ArrayBuffer) {
    thing = new Uint8Array(thing);
  }

  // Uint8Array to base64
  if (thing instanceof Uint8Array) {
    let str = "";
    const len = thing.byteLength;

    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(thing[i]);
    }
    thing = window.btoa(str);
  }

  if (typeof thing !== "string") {
    throw new Error("could not coerce to string");
  }

  // base64 to base64url
  // NOTE: "=" at the end of challenge is optional, strip it off here
  thing = thing.replace(/\+/g, "-").replace(/\//g, "_").replace(/=*$/g, "");

  return thing;
}

import { Utils } from "@bitwarden/common/platform/misc/utils";

export function decodeJwtTokenToJson(jwtToken: string): any {
  if (jwtToken == null) {
    throw new Error("JWT token not found");
  }

  const parts = jwtToken.split(".");
  if (parts.length !== 3) {
    throw new Error("JWT must have 3 parts");
  }

  // JWT has 3 parts: header, payload, signature separated by '.'
  // So, grab the payload to decode
  const encodedPayload = parts[1];

  let decodedPayloadJSON: string;
  try {
    // Attempt to decode from URL-safe Base64 to UTF-8
    decodedPayloadJSON = Utils.fromUrlB64ToUtf8(encodedPayload);
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (decodingError) {
    throw new Error("Cannot decode the token");
  }

  try {
    // Attempt to parse the JSON payload
    const decodedToken = JSON.parse(decodedPayloadJSON);
    return decodedToken;
    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (jsonError) {
    throw new Error("Cannot parse the token's payload into JSON");
  }
}

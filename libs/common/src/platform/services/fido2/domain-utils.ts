// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { parse } from "tldts";

export function isValidRpId(rpId: string, origin: string) {
  const parsedOrigin = parse(origin, { allowPrivateDomains: true });
  const parsedRpId = parse(rpId, { allowPrivateDomains: true });

  return (
    (parsedOrigin.domain == null &&
      parsedOrigin.hostname == parsedRpId.hostname &&
      parsedOrigin.hostname == "localhost") ||
    (parsedOrigin.domain != null &&
      parsedOrigin.domain == parsedRpId.domain &&
      parsedOrigin.subdomain.endsWith(parsedRpId.subdomain))
  );
}

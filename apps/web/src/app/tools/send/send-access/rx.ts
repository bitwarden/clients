import { map, concatMap, pipe, OperatorFunction } from "rxjs";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SEND_KDF_ITERATIONS } from "@bitwarden/common/tools/send/send-kdf";

export function keyToSendAccessRequest(
  crypto: CryptoFunctionService,
  password: string,
): OperatorFunction<string, SendAccessRequest> {
  return pipe(
    map((key) => Utils.fromUrlB64ToArray(key)),
    // FIXME: support kdf iteration and/or hash updates
    concatMap((key) => crypto.pbkdf2(password, key, "sha256", SEND_KDF_ITERATIONS)),
    map((hash) => {
      const request = new SendAccessRequest();
      request.password = Utils.fromBufferToB64(hash);
      return request;
    }),
  );
}

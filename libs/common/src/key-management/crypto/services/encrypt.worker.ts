// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { getClassInitializer } from "@bitwarden/common/platform/services/cryptography/get-class-initializer";
import { WebCryptoFunctionService } from "@bitwarden/common/platform/services/web-crypto-function.service";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";

const workerApi: Worker = self as any;

let inited = false;
let encryptService: EncryptServiceImplementation;

/**
 * Bootstrap the worker environment with services required for decryption
 */
export function init() {
  const cryptoFunctionService = new WebCryptoFunctionService(self);
  const logService = new ConsoleLogService(false);
  encryptService = new EncryptServiceImplementation(cryptoFunctionService, logService, true);

  const bitwardenContainerService = new ContainerService(null, encryptService);
  bitwardenContainerService.attachToGlobal(self);

  inited = true;
}

/**
 * Listen for messages and decrypt their contents
 */
workerApi.addEventListener("message", async (event: { data: string }) => {
  if (!inited) {
    init();
  }

  const request: {
    id: string;
    items: Jsonify<Decryptable<any>>[];
    key: Jsonify<SymmetricCryptoKey>;
  } = JSON.parse(event.data);

  const key = SymmetricCryptoKey.fromJSON(request.key);
  const items = request.items.map((jsonItem) => {
    const initializer = getClassInitializer<Decryptable<any>>(jsonItem.initializerKey);
    return initializer(jsonItem);
  });
  const result = await encryptService.decryptItems(items, key);

  workerApi.postMessage({
    id: request.id,
    items: JSON.stringify(result),
  });
});

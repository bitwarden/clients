// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { LogService } from "../../../platform/abstractions/log.service";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { ConsoleLogService } from "../../../platform/services/console-log.service";
import { ContainerService } from "../../../platform/services/container.service";
import { getClassInitializer } from "../../../platform/services/cryptography/get-class-initializer";
import {
  DECRYPT_COMMAND,
  SET_CONFIG_COMMAND,
  ParsedDecryptCommandData,
} from "../types/worker-command.type";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";
import { WebCryptoFunctionService } from "./web-crypto-function.service";

const workerApi: Worker = self as any;

let inited = false;
let encryptService: EncryptServiceImplementation;
let logService: LogService;

/**
 * Bootstrap the worker environment with services required for decryption
 */
export function init() {
  const cryptoFunctionService = new WebCryptoFunctionService(self);
  logService = new ConsoleLogService(false);
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
    command: string;
  } = JSON.parse(event.data);

  switch (request.command) {
    case DECRYPT_COMMAND:
      return await handleDecrypt(request as unknown as ParsedDecryptCommandData);
    case SET_CONFIG_COMMAND: {
      const newConfig = (request as unknown as { newConfig: Jsonify<ServerConfig> }).newConfig;
      return await handleSetConfig(newConfig);
    }
    default:
      logService.error(`[EncryptWorker] unknown worker command`, request.command, request);
  }
});

async function handleDecrypt(request: ParsedDecryptCommandData) {
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
}

async function handleSetConfig(newConfig: Jsonify<ServerConfig>) {
  encryptService.onServerConfigChange(ServerConfig.fromJSON(newConfig));
}

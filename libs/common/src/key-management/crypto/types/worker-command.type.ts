import { Jsonify } from "type-fest";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

export const DECRYPT_COMMAND = "decrypt";
export const SET_CONFIG_COMMAND = "updateConfig";

export type DecryptCommandData = {
  id: string;
  items: Decryptable<any>[];
  key: SymmetricCryptoKey;
};

export type ParsedDecryptCommandData = {
  id: string;
  items: Jsonify<Decryptable<any>>[];
  key: Jsonify<SymmetricCryptoKey>;
};

type SetConfigCommandData = { newConfig: ServerConfig };

export function buildDecryptMessage(data: DecryptCommandData): string {
  return JSON.stringify({
    command: DECRYPT_COMMAND,
    ...data,
  });
}

export function buildSetConfigMessage(data: SetConfigCommandData): string {
  return JSON.stringify({
    command: SET_CONFIG_COMMAND,
    ...data,
  });
}

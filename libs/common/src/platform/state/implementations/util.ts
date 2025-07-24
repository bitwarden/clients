import { Jsonify } from "type-fest";

import { AbstractStorageService } from "@bitwarden/storage-core";

export async function getStoredValue<T>(
  key: string,
  storage: AbstractStorageService,
  deserializer: (jsonValue: Jsonify<T>) => T | null,
) {
  if (storage.valuesRequireDeserialization) {
    const jsonValue = await storage.get<Jsonify<T>>(key);
    return deserializer(jsonValue);
  } else {
    const value = await storage.get<T>(key);
    return value ?? null;
  }
}

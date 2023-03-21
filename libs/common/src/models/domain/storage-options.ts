import { Jsonify } from "type-fest";

import { HtmlStorageLocation } from "../../enums/htmlStorageLocation";
import { StorageLocation } from "../../enums/storageLocation";
import { Guid } from "../../types/guid";

export type StorageOptions = {
  storageLocation?: StorageLocation;
  useSecureStorage?: boolean;
  userId?: Guid;
  htmlStorageLocation?: HtmlStorageLocation;
  keySuffix?: string;
};

export type MemoryStorageOptions<T> = StorageOptions & { deserializer?: (obj: Jsonify<T>) => T };

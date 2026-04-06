import { HtmlStorageLocation } from "./html-storage-location.enum";
import { StorageLocationEnum as StorageLocation } from "./storage-location.enum";

export type StorageOptions = {
  storageLocation?: StorageLocation;
  useSecureStorage?: boolean;
  userId?: string;
  htmlStorageLocation?: HtmlStorageLocation;
  keySuffix?: string;
};

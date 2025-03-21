import { map } from "rxjs";

import { CipherType, FieldType, LinkedIdType } from "../enums";
import { CipherView } from "../models/view/cipher.view";

export type VaultFilterMetadata = {
  vaults: Map<string | null, number>;
  customFields: Map<CustomFieldMetadata, number>;
  itemTypes: Map<CipherType, number>;
  folders: Map<string, number>;
  collections: Map<string, number>;
  attachmentCount: number;
};

export type CustomFieldMetadata = {
  name: string;
  type: FieldType;
  linkedType: LinkedIdType | null;
};
function isCustomFieldMetadata(x: MetadataType): x is CustomFieldMetadata {
  return typeof x === "object" && x != null && "name" in x && "type" in x;
}
type ExtractKey<T> = T extends Map<infer K, any> ? K : never;
type MetadataType = ExtractKey<VaultFilterMetadata[keyof VaultFilterMetadata]>;
function metaDataKeyEqual<T extends MetadataType>(a: T, b: T) {
  if (isCustomFieldMetadata(a) && isCustomFieldMetadata(b)) {
    return a.name === b.name && a.type === b.type && a.linkedType === b.linkedType;
  } else {
    return a === b;
  }
}

export class VaultFilterMetadataService {
  collectMetadata() {
    const setOrIncrement = <T extends MetadataType>(map: Map<T, number>, key: T) => {
      const entry = Array.from(map.entries()).find(([k]) => metaDataKeyEqual(key, k));

      if (entry == null) {
        map.set(key, 1);
      } else {
        map.set(entry[0], entry[1] + 1);
      }
    };

    return map<CipherView[], VaultFilterMetadata>((ciphers) => {
      const emptyMetadata = {
        vaults: new Map<string | null, number>(),
        customFields: new Map<CustomFieldMetadata, number>(),
        itemTypes: new Map<CipherType, number>(),
        folders: new Map<string, number>(),
        collections: new Map<string, number>(),
        attachmentCount: 0,
      };

      if (ciphers == null) {
        return emptyMetadata;
      }

      return ciphers.reduce<VaultFilterMetadata>((metadata, cipher) => {
        // Track type
        setOrIncrement(metadata.itemTypes, cipher.type);

        // Track vault
        setOrIncrement(metadata.vaults, cipher.organizationId ?? null);

        // Track all field names
        if (cipher.fields != null) {
          for (const field of cipher.fields) {
            setOrIncrement(metadata.customFields, {
              name: field.name,
              type: field.type,
              linkedType: field.linkedId,
            });
          }
        }

        // Track all folder ids
        if (cipher.folderId != null) {
          setOrIncrement(metadata.folders, cipher.folderId);
        }

        // Track all collections
        if (cipher.collectionIds != null) {
          for (const collectionId of cipher.collectionIds) {
            setOrIncrement(metadata.collections, collectionId);
          }
        }

        // Track if any have an attachment
        if (cipher.attachments != null && cipher.attachments.length > 0) {
          metadata.attachmentCount = metadata.attachmentCount + cipher.attachments.length;
        }

        return metadata;
      }, emptyMetadata);
    });
  }
}

import { map } from "rxjs";

import { CipherType } from "../enums";
import { CipherView } from "../models/view/cipher.view";

export type VaultFilterMetadata = {
  vaults: Set<string | null>;
  fieldNames: Set<string>;
  itemTypes: Set<CipherType>;
  folders: Set<string>;
  collections: Set<string>;
  anyHaveAttachment: boolean;
};

export class VaultFilterMetadataService {
  collectMetadata() {
    return map<CipherView[], VaultFilterMetadata>((ciphers) => {
      return ciphers.reduce<VaultFilterMetadata>(
        (metadata, cipher) => {
          // Track type
          metadata.itemTypes.add(cipher.type);

          // Track vault
          metadata.vaults.add(cipher.organizationId ?? null);

          // Track all field names
          if (cipher.fields != null) {
            for (const field of cipher.fields) {
              metadata.fieldNames.add(field.name);
            }
          }

          // Track all folder ids
          if (cipher.folderId != null) {
            metadata.folders.add(cipher.folderId);
          }

          // Track all collections
          if (cipher.collectionIds != null) {
            for (const collectionId of cipher.collectionIds) {
              metadata.collections.add(collectionId);
            }
          }

          // Track if any have an attachment
          if (cipher.attachments != null && cipher.attachments.length > 0) {
            metadata.anyHaveAttachment = true;
          }

          return metadata;
        },
        {
          vaults: new Set<string | null>(),
          fieldNames: new Set<string>(),
          itemTypes: new Set<CipherType>(),
          folders: new Set<string>(),
          collections: new Set<string>(),
          anyHaveAttachment: false,
        },
      );
    });
  }
}

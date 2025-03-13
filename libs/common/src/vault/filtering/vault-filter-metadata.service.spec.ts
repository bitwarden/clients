import { firstValueFrom, of } from "rxjs";

import { CipherType } from "../enums";
import { AttachmentView } from "../models/view/attachment.view";
import { CipherView } from "../models/view/cipher.view";
import { FieldView } from "../models/view/field.view";

import {
  VaultFilterMetadata,
  VaultFilterMetadataService as VaultFilterMetadataService,
} from "./vault-filter-metadata.service";

type TestCipher = {
  organization?: string;
  type: CipherType;
  folderId?: string;
  fields?: string[];
  collectionIds?: string[];
  attachments?: number;
};
const createCipher = (data: TestCipher) => {
  const cipher = new CipherView();
  cipher.organizationId = data.organization ?? null;
  cipher.type = data.type;
  cipher.fields = data.fields?.map((f) => {
    const field = new FieldView();
    field.name = f;
    return field;
  });
  cipher.collectionIds = data.collectionIds;

  if (data.attachments != null) {
    const attachments: AttachmentView[] = [];
    for (let i = 0; i < data.attachments; i++) {
      attachments.push(new AttachmentView());
    }
    cipher.attachments = attachments;
  }

  return cipher;
};

describe("VaultFilterMetadataService", () => {
  const sut = new VaultFilterMetadataService();

  describe("collectMetadata", () => {
    const testData: {
      name: string;
      input: CipherView[];
      output: VaultFilterMetadata;
    }[] = [
      {
        name: "single personal vault cipher",
        input: [createCipher({ type: CipherType.Card })],
        output: {
          vaults: new Set([null]),
          fieldNames: new Set([]),
          itemTypes: new Set([CipherType.Card]),
          folders: new Set([]),
          collections: new Set([]),
          anyHaveAttachment: false,
        },
      },
      {
        name: "multiple different org ciphers",
        input: [
          createCipher({
            organization: "org-one",
            type: CipherType.Login,
            attachments: 2,
            collectionIds: ["one"],
            fields: ["one", "one"],
          }),
          createCipher({
            organization: "org-one",
            type: CipherType.Login,
            attachments: 2,
            collectionIds: ["one"],
            fields: ["one", "one"],
          }),
          createCipher({
            organization: "org-two",
            type: CipherType.Login,
            attachments: 2,
            collectionIds: ["one"],
            fields: ["one", "one"],
          }),
          createCipher({
            organization: "org-two",
            type: CipherType.Card,
            attachments: 2,
            collectionIds: ["three"],
            fields: ["one", "five"],
          }),
        ],
        output: {
          vaults: new Set(["org-one", "org-two"]),
          fieldNames: new Set(["one", "five"]),
          itemTypes: new Set([CipherType.Login, CipherType.Card]),
          folders: new Set([]),
          collections: new Set(["one", "three"]),
          anyHaveAttachment: true,
        },
      },
    ];

    it.each(testData)("$name", async ({ input, output }) => {
      const actualMetadata = await firstValueFrom(of(input).pipe(sut.collectMetadata()));

      expect(actualMetadata.vaults).toEqual(output.vaults);
      expect(actualMetadata.fieldNames).toEqual(output.fieldNames);
      expect(actualMetadata.itemTypes).toEqual(output.itemTypes);
      expect(actualMetadata.folders).toEqual(output.folders);
      expect(actualMetadata.collections).toEqual(output.collections);
      expect(actualMetadata.anyHaveAttachment).toBe(output.anyHaveAttachment);
    });
  });
});

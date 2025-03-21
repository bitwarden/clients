import { firstValueFrom, of } from "rxjs";

import { CipherType, FieldType } from "../enums";
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
    field.type = FieldType.Text;
    field.linkedId = null;
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
          vaults: new Map([[null, 1]]),
          customFields: new Map([]),
          itemTypes: new Map([[CipherType.Card, 1]]),
          folders: new Map([]),
          collections: new Map([]),
          attachmentCount: 0,
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
          vaults: new Map([
            ["org-one", 2],
            ["org-two", 2],
          ]),
          customFields: new Map([
            [{ name: "one", type: FieldType.Text, linkedType: null }, 7],
            [{ name: "five", type: FieldType.Text, linkedType: null }, 1],
          ]),
          itemTypes: new Map([
            [CipherType.Login, 3],
            [CipherType.Card, 1],
          ]),
          folders: new Map([]),
          collections: new Map([
            ["one", 3],
            ["three", 1],
          ]),
          attachmentCount: 8,
        },
      },
    ];

    it.each(testData)("$name", async ({ input, output }) => {
      const actualMetadata = await firstValueFrom(of(input).pipe(sut.collectMetadata()));

      expect(actualMetadata.vaults).toEqual(output.vaults);
      expect(actualMetadata.customFields).toEqual(output.customFields);
      expect(actualMetadata.itemTypes).toEqual(output.itemTypes);
      expect(actualMetadata.folders).toEqual(output.folders);
      expect(actualMetadata.collections).toEqual(output.collections);
      expect(actualMetadata.attachmentCount).toBe(output.attachmentCount);
    });
  });
});

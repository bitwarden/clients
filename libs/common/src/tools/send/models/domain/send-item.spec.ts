// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { Cipher as SdkCipher, SendEncryptionType } from "@bitwarden/sdk-internal";

import { mockContainerService } from "../../../../../spec";
import { CipherType } from "../../../../vault/enums";
import { CipherPermissionsApi } from "../../../../vault/models/api/cipher-permissions.api";
import { Cipher } from "../../../../vault/models/domain/cipher";
import { SendItemData } from "../data/send-item.data";

import { SendItem } from "./send-item";

/** Top-level fields of the SDK `Cipher`, which rejects unknown fields when parsing. */
const SDK_CIPHER_KEYS: (keyof SdkCipher)[] = [
  "id",
  "organizationId",
  "folderId",
  "collectionIds",
  "key",
  "name",
  "notes",
  "type",
  "login",
  "identity",
  "card",
  "secureNote",
  "sshKey",
  "bankAccount",
  "driversLicense",
  "passport",
  "favorite",
  "reprompt",
  "organizationUseTotp",
  "edit",
  "permissions",
  "viewPassword",
  "localData",
  "attachments",
  "fields",
  "passwordHistory",
  "creationDate",
  "deletedDate",
  "revisionDate",
  "archivedDate",
  "data",
];

const CIPHER_ID = "5d0e1a8c-3f4b-4c2a-9e7d-1b2c3d4e5f60";

describe("SendItem", () => {
  let data: SendItemData;

  beforeEach(() => {
    const cipher = new Cipher();
    cipher.id = "test-cipher";
    data = {
      data: JSON.stringify(cipher),
      encryptionVersion: SendEncryptionType.V1,
    };

    mockContainerService();
  });

  it("Convert", () => {
    const sendItem = new SendItem(data);

    expect(sendItem).toEqual({
      encryptionVersion: SendEncryptionType.V1,
      data: expect.objectContaining({
        id: expect.stringMatching("test-cipher"),
      }),
    });
  });

  it("serializes its data in the SDK cipher format", () => {
    const cipher = new Cipher();
    cipher.type = CipherType.Login;
    cipher.name = new EncString("encryptedCipherName");
    cipher.permissions = CipherPermissionsApi.fromSdkCipherPermissions({
      delete: true,
      restore: true,
    });
    const sendItem = new SendItem();
    sendItem.data = cipher;

    const serialized = JSON.parse(sendItem.toSendData().data);

    expect(SDK_CIPHER_KEYS).toEqual(expect.arrayContaining(Object.keys(serialized)));
    expect(serialized.permissions).toEqual({ delete: true, restore: true });
    expect(serialized.name).toBe("encryptedCipherName");
  });

  it("reads back the SDK cipher format it serializes", () => {
    const cipher = new Cipher();
    cipher.id = CIPHER_ID;
    cipher.name = new EncString("encryptedCipherName");
    const sendItem = new SendItem();
    sendItem.data = cipher;

    const roundTripped = new SendItem(sendItem.toSendData());

    expect(roundTripped.data.id).toBe(CIPHER_ID);
    expect(roundTripped.data.name?.encryptedString).toBe("encryptedCipherName");
  });
});

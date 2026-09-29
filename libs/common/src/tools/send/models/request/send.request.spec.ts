// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { Cipher as SdkCipher } from "@bitwarden/sdk-internal";

import { CipherType } from "../../../../vault/enums";
import { CipherPermissionsApi } from "../../../../vault/models/api/cipher-permissions.api";
import { Cipher } from "../../../../vault/models/domain/cipher";
import { SendType } from "../../types/send-type";
import { Send } from "../domain/send";
import { SendItem } from "../domain/send-item";
import { SendText } from "../domain/send-text";

import { SendRequest } from "./send.request";

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

describe("SendRequest", () => {
  describe("constructor", () => {
    it("should set emails to null when Send.emails is null", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emails).toBeNull();
    });

    it("should handle name being null", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = null;
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.name).toBeNull();
    });

    it("should handle notes being null", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = null;
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.notes).toBeNull();
    });

    it("should include fileLength when provided for text send", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send, 1024);

      expect(request.fileLength).toBe(1024);
    });

    it("should serialize Item Send data in the SDK cipher format", () => {
      const cipher = new Cipher();
      cipher.type = CipherType.Login;
      cipher.name = new EncString("encryptedCipherName");
      cipher.permissions = CipherPermissionsApi.fromSdkCipherPermissions({
        delete: true,
        restore: true,
      });
      const send = new Send();
      send.type = SendType.Item;
      send.data = new SendItem();
      send.data.data = cipher;

      const request = new SendRequest(send);

      const serialized = JSON.parse(request.data.data);
      expect(SDK_CIPHER_KEYS).toEqual(expect.arrayContaining(Object.keys(serialized)));
      expect(serialized.permissions).toEqual({ delete: true, restore: true });
      expect(serialized.name).toBe("encryptedCipherName");
    });
  });
});

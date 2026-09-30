// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

import { SendType } from "../../types/send-type";
import { Send } from "../domain/send";
import { SendItem } from "../domain/send-item";
import { SendText } from "../domain/send-text";

import { SendRequest } from "./send.request";

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

    it("should pass Item Send data through unchanged", () => {
      const sealedData = '{"format_version":1,"wrapped_cek":"2.a|b|c","envelope":"g1hH"}';
      const send = new Send();
      send.type = SendType.Item;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.data = new SendItem();
      send.data.data = sealedData;
      send.data.metadata = { itemId: "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71" };

      const request = new SendRequest(send);

      expect(request.data.data).toBe(sealedData);
      expect(request.data.metadata?.itemId).toBe("5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71");
    });
  });
});

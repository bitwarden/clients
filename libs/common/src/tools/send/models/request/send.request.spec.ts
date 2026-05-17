import { Send } from "@bitwarden/common/tools/send/models/domain/send";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { SendType } from "../../types/send-type";
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
  });
});

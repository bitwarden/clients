import { Send } from "@bitwarden/common/tools/send/models/domain/send";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { SendType } from "../../types/send-type";
import { SendText } from "../domain/send-text";

import { SendRequest } from "./send.request";

describe("SendRequest", () => {
  describe("constructor", () => {
    it("should populate emails with encrypted string from Send.emails", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("encryptedEmailList");
      send.emailHashes = "HASH1,HASH2,HASH3";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emails).toBe("encryptedEmailList");
    });

    it("should populate emailHashes from Send.emailHashes", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("encryptedEmailList");
      send.emailHashes = "HASH1,HASH2,HASH3";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emailHashes).toBe("HASH1,HASH2,HASH3");
    });

    it("should set emails to null when Send.emails is null", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.emailHashes = "";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emails).toBeNull();
      expect(request.emailHashes).toBe("");
    });

    it("should handle empty emailHashes", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.emailHashes = "";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emailHashes).toBe("");
    });

    it("should not expose plaintext emails", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("2.encrypted|emaildata|here");
      send.emailHashes = "ABC123,DEF456";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      // Ensure the request contains the encrypted string format, not plaintext
      expect(request.emails).toBe("2.encrypted|emaildata|here");
      expect(request.emails).not.toContain("@");
    });

    it("should handle name being null", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = null;
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.emailHashes = "";
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
      send.emailHashes = "";
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
      send.emailHashes = "";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send, 1024);

      expect(request.fileLength).toBe(1024);
    });
  });

  describe("Email auth requirements", () => {
    it("should create request with encrypted emails and plaintext emailHashes", () => {
      // Setup: A Send with encrypted emails and computed hashes
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("2.encryptedEmailString|data");
      send.emailHashes = "A1B2C3D4,E5F6G7H8"; // Plaintext hashes
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      // Act: Create the request
      const request = new SendRequest(send);

      // emails field contains encrypted value
      expect(request.emails).toBe("2.encryptedEmailString|data");
      expect(request.emails).toContain("encrypted");

      //emailHashes field contains plaintext comma-separated hashes
      expect(request.emailHashes).toBe("A1B2C3D4,E5F6G7H8");
      expect(request.emailHashes).not.toContain("encrypted");
      expect(request.emailHashes.split(",")).toHaveLength(2);
    });
  });
});

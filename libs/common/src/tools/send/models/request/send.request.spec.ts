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
      send.anonAccessEmails = "person1@company.com,person2@company.com,person3@company.com";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emails).toBe("encryptedEmailList");
    });

    it("should populate anonAccessEmails from Send.anonAccessEmails", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("encryptedEmailList");
      send.anonAccessEmails = "person1@company,person2@company,person3@company";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.anonAccessEmails).toBe("person1@company,person2@company,person3@company");
    });

    it("should set emails to null when Send.emails is null", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.notes = new EncString("encryptedNotes");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.anonAccessEmails = "";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.emails).toBeNull();
      expect(request.anonAccessEmails).toBe("");
    });

    it("should handle empty anonAccessEmails", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = null;
      send.anonAccessEmails = "";
      send.disabled = false;
      send.hideEmail = false;
      send.text = new SendText();
      send.text.text = new EncString("text");
      send.text.hidden = false;

      const request = new SendRequest(send);

      expect(request.anonAccessEmails).toBe("");
    });

    it("should not expose plaintext emails", () => {
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("2.encrypted|emaildata|here");
      send.anonAccessEmails = "person1@company,person2@company";
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
      send.anonAccessEmails = "";
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
      send.anonAccessEmails = "";
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
      send.anonAccessEmails = "";
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
    it("should create request with encrypted emails and plaintext anonAccessEmails", () => {
      // Setup: A Send with encrypted emails and computed hashes
      const send = new Send();
      send.type = SendType.Text;
      send.name = new EncString("encryptedName");
      send.key = new EncString("encryptedKey");
      send.emails = new EncString("2.encryptedEmailString|data");
      send.anonAccessEmails = "person1@company,person2@company"; // Plaintext emails
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

      //anonAccessEmails field contains plaintext comma-separated hashes
      expect(request.anonAccessEmails).toBe("person1@company,person2@company");
      expect(request.anonAccessEmails).not.toContain("encrypted");
      expect(request.anonAccessEmails.split(",")).toHaveLength(2);
    });
  });
});

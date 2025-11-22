import { SecureNote } from "@bitwarden/common/vault/models/domain/secure-note";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";

import { SecureNoteExport } from "./secure-note.export";

describe("SecureNoteExport", () => {
  describe("toView", () => {
    it("should map fields correctly", () => {
      const validSecureNote = {
        type: "SecureNote",
      } as any;
      const result = SecureNoteExport.toView(new SecureNoteExport(validSecureNote));
      expect(result).toBeInstanceOf(SecureNoteView);
      expect(result.type).toBe(validSecureNote.type);
    });
  });

  describe("toDomain", () => {
    it("should map fields correctly", () => {
      const validSecureNote = {
        type: "SecureNote",
      } as any;
      const result = SecureNoteExport.toDomain(new SecureNoteExport(validSecureNote));
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(SecureNote);
      expect(result.type).toBe(validSecureNote.type);
    });
  });
});

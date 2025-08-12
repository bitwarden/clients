import { CipherExport } from "@bitwarden/common/models/export/cipher.export";
import { SecureNoteExport } from "@bitwarden/common/models/export/secure-note.export";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

describe("Cipher Export", () => {
  describe("toView", () => {
    it("should preserve existing date values when request dates are null", () => {
      const existingView = new CipherView();
      existingView.creationDate = new Date("2023-01-01T00:00:00Z");
      existingView.revisionDate = new Date("2023-01-02T00:00:00Z");
      existingView.deletedDate = new Date("2023-01-03T00:00:00Z");

      const request = CipherExport.template();
      request.type = CipherType.SecureNote;
      request.secureNote = SecureNoteExport.template();

      const resultView = CipherExport.toView(request, existingView);
      expect(resultView.creationDate).toEqual(existingView.creationDate);
      expect(resultView.revisionDate).toEqual(existingView.revisionDate);
      expect(resultView.deletedDate).toEqual(existingView.deletedDate);
    });
  });
});

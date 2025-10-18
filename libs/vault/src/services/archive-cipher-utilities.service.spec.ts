import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { ArchiveCipherUtilitiesService } from "./archive-cipher-utilities.service";
import { PasswordRepromptService } from "./password-reprompt.service";

describe("ArchiveCipherUtilitiesService", () => {
  let service: ArchiveCipherUtilitiesService;

  let cipherArchiveService: MockProxy<CipherArchiveService>;
  let dialogService: MockProxy<DialogService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let accountService: MockProxy<AccountService>;

  const mockCipher = new CipherView();
  mockCipher.id = "cipher-id" as CipherId;
  const mockUserId = "user-id";

  beforeEach(() => {
    cipherArchiveService = mock<CipherArchiveService>();
    dialogService = mock<DialogService>();
    passwordRepromptService = mock<PasswordRepromptService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    accountService = mock<AccountService>();

    accountService.activeAccount$ = new BehaviorSubject({ id: mockUserId } as any).asObservable();

    dialogService.openSimpleDialog.mockResolvedValue(true);
    passwordRepromptService.passwordRepromptCheck.mockResolvedValue(true);
    cipherArchiveService.archiveWithServer.mockResolvedValue(undefined);
    cipherArchiveService.unarchiveWithServer.mockResolvedValue(undefined);
    i18nService.t.mockImplementation((key) => key);

    service = new ArchiveCipherUtilitiesService(
      cipherArchiveService,
      dialogService,
      passwordRepromptService,
      toastService,
      i18nService,
      accountService,
    );
  });

  describe("archiveCipher()", () => {
    it("returns early when confirmation dialog is cancelled", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.archiveCipher(mockCipher);

      expect(passwordRepromptService.passwordRepromptCheck).toHaveBeenCalled();
      expect(cipherArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });

    it("returns early when password reprompt fails", async () => {
      passwordRepromptService.passwordRepromptCheck.mockResolvedValue(false);

      await service.archiveCipher(mockCipher);

      expect(cipherArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });

    it("archives cipher and shows success toast when successful", async () => {
      await service.archiveCipher(mockCipher);

      expect(cipherArchiveService.archiveWithServer).toHaveBeenCalledWith(
        mockCipher.id,
        mockUserId,
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "itemWasSentToArchive",
      });
    });

    it("shows error toast when archiving fails", async () => {
      cipherArchiveService.archiveWithServer.mockRejectedValue(new Error("test error"));

      await service.archiveCipher(mockCipher);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "errorOccurred",
      });
    });
  });

  describe("unarchiveCipher()", () => {
    it("unarchives cipher and shows success toast when successful", async () => {
      await service.unarchiveCipher(mockCipher);

      expect(cipherArchiveService.unarchiveWithServer).toHaveBeenCalledWith(
        mockCipher.id,
        mockUserId,
      );
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "itemWasUnarchived",
      });
    });

    it("shows error toast when unarchiving fails", async () => {
      cipherArchiveService.unarchiveWithServer.mockRejectedValue(new Error("test error"));

      await service.unarchiveCipher(mockCipher);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "errorOccurred",
      });
    });
  });
});

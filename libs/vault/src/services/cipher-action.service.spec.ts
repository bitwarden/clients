import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, BehaviorSubject, of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";

import {
  AttachmentDialogResult,
  AttachmentsV2Component,
} from "../cipher-view/attachments/attachments-v2.component";

import { ArchiveCipherUtilitiesService } from "./archive-cipher-utilities.service";
import { CipherActionService } from "./cipher-action.service";
import { PasswordRepromptService } from "./password-reprompt.service";

const userId = "test-user-id" as UserId;

function makeCipher(
  overrides: Partial<{
    id: string;
    edit: boolean;
    favorite: boolean;
    isDeleted: boolean;
    isArchived: boolean;
    organizationId: string;
    reprompt: CipherRepromptType;
    type: CipherType;
  }> = {},
): CipherView {
  return {
    id: "cipher-id",
    type: CipherType.Login,
    edit: true,
    favorite: false,
    isDeleted: false,
    isArchived: false,
    organizationId: undefined,
    reprompt: CipherRepromptType.None,
    ...overrides,
  } as unknown as CipherView;
}

describe("CipherActionService", () => {
  let service: CipherActionService;

  let accountService: ReturnType<typeof mockAccountServiceWith>;
  let archiveCipherUtilitiesService: MockProxy<ArchiveCipherUtilitiesService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let cipherArchiveService: MockProxy<CipherArchiveService>;
  let cipherService: MockProxy<CipherService>;
  let dialogService: MockProxy<DialogService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;
  let organizationService: MockProxy<OrganizationService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let premiumUpgradePromptService: MockProxy<PremiumUpgradePromptService>;
  let toastService: MockProxy<ToastService>;

  let userCanArchiveSubject: BehaviorSubject<boolean>;
  let userHasPremiumSubject: BehaviorSubject<boolean>;
  let organizationsSubject: BehaviorSubject<Organization[]>;

  beforeEach(() => {
    archiveCipherUtilitiesService = mock<ArchiveCipherUtilitiesService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    cipherArchiveService = mock<CipherArchiveService>();
    cipherService = mock<CipherService>();
    dialogService = mock<DialogService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();
    organizationService = mock<OrganizationService>();
    passwordRepromptService = mock<PasswordRepromptService>();
    premiumUpgradePromptService = mock<PremiumUpgradePromptService>();
    toastService = mock<ToastService>();
    accountService = mockAccountServiceWith(userId);

    userCanArchiveSubject = new BehaviorSubject<boolean>(true);
    userHasPremiumSubject = new BehaviorSubject<boolean>(true);
    cipherArchiveService.userCanArchive$.mockReturnValue(userCanArchiveSubject.asObservable());
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
      userHasPremiumSubject.asObservable(),
    );

    organizationsSubject = new BehaviorSubject<Organization[]>([]);
    organizationService.organizations$.mockReturnValue(organizationsSubject.asObservable());

    i18nService.t.mockImplementation((key) => key);
    dialogService.openSimpleDialog.mockResolvedValue(true);
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);
    cipherService.getFullCipherView.mockImplementation((c) => Promise.resolve(c as CipherView));

    TestBed.configureTestingModule({
      providers: [
        CipherActionService,
        { provide: AccountService, useValue: accountService },
        { provide: ArchiveCipherUtilitiesService, useValue: archiveCipherUtilitiesService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: CipherService, useValue: cipherService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(CipherActionService);
  });

  describe("toggleFavorite()", () => {
    it("toggles favorite from false to true and shows toast", async () => {
      const cipher = makeCipher({ favorite: false });
      const fullCipher = { ...cipher, favorite: false } as CipherView;
      cipherService.getFullCipherView.mockResolvedValue(fullCipher);

      await service.toggleFavorite(cipher);

      expect(fullCipher.favorite).toBe(true);
      expect(cipherService.updateWithServer).toHaveBeenCalledWith(fullCipher, userId);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "itemAddedToFavorites" }),
      );
    });

    it("toggles favorite from true to false and shows toast", async () => {
      const cipher = makeCipher({ favorite: true });
      const fullCipher = { ...cipher, favorite: true } as CipherView;
      cipherService.getFullCipherView.mockResolvedValue(fullCipher);

      await service.toggleFavorite(cipher);

      expect(fullCipher.favorite).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "itemRemovedFromFavorites" }),
      );
    });

    it("emits cipherModified$ after toggling", async () => {
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.toggleFavorite(makeCipher());

      await expect(successPromise).resolves.toBeUndefined();
    });
  });

  describe("restore()", () => {
    it("does nothing when cipher is not deleted", async () => {
      await service.restore(makeCipher({ isDeleted: false }));

      expect(cipherService.restoreWithServer).not.toHaveBeenCalled();
    });

    it("does nothing when password reprompt is cancelled", async () => {
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.restore(makeCipher({ isDeleted: true, reprompt: CipherRepromptType.Password }));

      expect(cipherService.restoreWithServer).not.toHaveBeenCalled();
    });

    it("shows restoredItem toast for a normal deleted cipher", async () => {
      await service.restore(makeCipher({ isDeleted: true, isArchived: false }));

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "restoredItem" }),
      );
    });

    it("shows archivedItemRestored toast for a deleted+archived cipher", async () => {
      await service.restore(makeCipher({ isDeleted: true, isArchived: true }));

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "archivedItemRestored" }),
      );
    });

    it("calls restoreWithServer with the cipher id and active user", async () => {
      const cipher = makeCipher({ id: "my-cipher", isDeleted: true });

      await service.restore(cipher);

      expect(cipherService.restoreWithServer).toHaveBeenCalledWith("my-cipher", userId);
    });

    it("logs error and still emits cipherModified$ when restoreWithServer throws", async () => {
      cipherService.restoreWithServer.mockRejectedValue(new Error("network error"));
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.restore(makeCipher({ isDeleted: true }));

      expect(logService.error).toHaveBeenCalled();
      await expect(successPromise).resolves.toBeUndefined();
    });

    it("emits cipherModified$ on success", async () => {
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.restore(makeCipher({ isDeleted: true }));

      await expect(successPromise).resolves.toBeUndefined();
    });
  });

  describe("archive()", () => {
    it("does nothing when cipher is already archived", async () => {
      await service.archive(makeCipher({ isArchived: true }));

      expect(archiveCipherUtilitiesService.archiveCipher).not.toHaveBeenCalled();
    });

    it("does nothing when cipher is deleted", async () => {
      await service.archive(makeCipher({ isDeleted: true }));

      expect(archiveCipherUtilitiesService.archiveCipher).not.toHaveBeenCalled();
    });

    it("prompts for premium when user cannot archive", async () => {
      userCanArchiveSubject.next(false);

      await service.archive(makeCipher());

      expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalled();
      expect(archiveCipherUtilitiesService.archiveCipher).not.toHaveBeenCalled();
    });

    it("archives the full cipher view", async () => {
      const cipher = makeCipher();
      const fullCipher = { ...cipher } as CipherView;
      cipherService.getFullCipherView.mockResolvedValue(fullCipher);

      await service.archive(cipher);

      expect(cipherService.getFullCipherView).toHaveBeenCalledWith(cipher);
      expect(archiveCipherUtilitiesService.archiveCipher).toHaveBeenCalledWith(fullCipher);
    });

    it("emits cipherModified$ after archiving", async () => {
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.archive(makeCipher());

      await expect(successPromise).resolves.toBeUndefined();
    });
  });

  describe("unarchive()", () => {
    it("does nothing when cipher is not archived", async () => {
      await service.unarchive(makeCipher({ isArchived: false }));

      expect(archiveCipherUtilitiesService.unarchiveCipher).not.toHaveBeenCalled();
    });

    it("does nothing when cipher is archived but also deleted", async () => {
      await service.unarchive(makeCipher({ isArchived: true, isDeleted: true }));

      expect(archiveCipherUtilitiesService.unarchiveCipher).not.toHaveBeenCalled();
    });

    it("unarchives the full cipher view", async () => {
      const cipher = makeCipher({ isArchived: true });
      const fullCipher = { ...cipher } as CipherView;
      cipherService.getFullCipherView.mockResolvedValue(fullCipher);

      await service.unarchive(cipher);

      expect(cipherService.getFullCipherView).toHaveBeenCalledWith(cipher);
      expect(archiveCipherUtilitiesService.unarchiveCipher).toHaveBeenCalledWith(fullCipher);
    });

    it("emits cipherModified$ after unarchiving", async () => {
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.unarchive(makeCipher({ isArchived: true }));

      await expect(successPromise).resolves.toBeUndefined();
    });
  });

  describe("viewAttachments()", () => {
    function mockDialog(action: AttachmentDialogResult) {
      jest.spyOn(AttachmentsV2Component, "open").mockReturnValue({
        closed: of({ action }),
      } as unknown as DialogRef<{ action: AttachmentDialogResult }>);
    }

    it("prompts for premium and returns when user does not have premium", async () => {
      userHasPremiumSubject.next(false);
      const openSpy = jest.spyOn(AttachmentsV2Component, "open");

      await service.viewAttachments(makeCipher());

      expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("does nothing when password reprompt is cancelled", async () => {
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);
      const openSpy = jest.spyOn(AttachmentsV2Component, "open");

      await service.viewAttachments(makeCipher({ reprompt: CipherRepromptType.Password }));

      expect(openSpy).not.toHaveBeenCalled();
    });

    it("prompts to upgrade the organization when it has no storage allocated", async () => {
      organizationsSubject.next([{ id: "org-1", maxStorageGb: 0 } as Organization]);
      const openSpy = jest.spyOn(AttachmentsV2Component, "open");

      await service.viewAttachments(makeCipher({ organizationId: "org-1" }));

      expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalledWith("org-1");
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("opens for an organization item with storage, even without personal premium", async () => {
      userHasPremiumSubject.next(false);
      organizationsSubject.next([{ id: "org-1", maxStorageGb: 1 } as Organization]);
      mockDialog(AttachmentDialogResult.Closed);

      await service.viewAttachments(makeCipher({ organizationId: "org-1" }));

      expect(premiumUpgradePromptService.promptForPremium).not.toHaveBeenCalled();
      expect(AttachmentsV2Component.open).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ organizationId: "org-1" }),
      );
    });

    it("opens the attachments dialog with the cipher id and edit flag", async () => {
      const cipher = makeCipher({ id: "my-cipher", edit: true });
      mockDialog(AttachmentDialogResult.Closed);

      await service.viewAttachments(cipher);

      expect(AttachmentsV2Component.open).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ cipherId: "my-cipher", canEditCipher: true }),
      );
    });

    it("emits cipherModified$ when an attachment is uploaded", async () => {
      mockDialog(AttachmentDialogResult.Uploaded);
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.viewAttachments(makeCipher());

      await expect(successPromise).resolves.toBeUndefined();
    });

    it("emits cipherModified$ when an attachment is removed", async () => {
      mockDialog(AttachmentDialogResult.Removed);
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.viewAttachments(makeCipher());

      await expect(successPromise).resolves.toBeUndefined();
    });

    it("does not emit cipherModified$ when dialog is closed without changes", async () => {
      mockDialog(AttachmentDialogResult.Closed);
      let emitted = false;
      service.cipherModified$.subscribe(() => (emitted = true));

      await service.viewAttachments(makeCipher());

      expect(emitted).toBe(false);
    });
  });

  describe("delete()", () => {
    it("does nothing when password reprompt is cancelled", async () => {
      const cipher = makeCipher({ reprompt: CipherRepromptType.Password });
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.delete(cipher);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("does nothing when user cancels the confirmation dialog", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.delete(makeCipher());

      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("soft-deletes a non-deleted cipher", async () => {
      const cipher = makeCipher({ id: "my-cipher", isDeleted: false });

      await service.delete(cipher);

      expect(cipherService.softDeleteWithServer).toHaveBeenCalledWith("my-cipher", userId);
      expect(cipherService.deleteWithServer).not.toHaveBeenCalled();
    });

    it("permanently deletes an already-deleted cipher", async () => {
      const cipher = makeCipher({ id: "my-cipher", isDeleted: true });

      await service.delete(cipher);

      expect(cipherService.deleteWithServer).toHaveBeenCalledWith("my-cipher", userId);
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("shows deletedItem toast for a soft delete", async () => {
      await service.delete(makeCipher({ isDeleted: false }));

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "deletedItem" }),
      );
    });

    it("shows permanentlyDeletedItem toast for a permanent delete", async () => {
      await service.delete(makeCipher({ isDeleted: true }));

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "permanentlyDeletedItem" }),
      );
    });

    it("shows deleteItemConfirmation dialog content for a soft delete", async () => {
      await service.delete(makeCipher({ isDeleted: false }));

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "deleteItemConfirmation" } }),
      );
    });

    it("shows permanentlyDeleteItemConfirmation dialog content for a permanent delete", async () => {
      await service.delete(makeCipher({ isDeleted: true }));

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "permanentlyDeleteItemConfirmation" } }),
      );
    });

    it("titles the confirmation for what is about to happen", async () => {
      await service.delete(makeCipher({ isDeleted: false }));
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "deleteItem" } }),
      );

      await service.delete(makeCipher({ isDeleted: true }));
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ title: { key: "permanentlyDeleteItem" } }),
      );
    });

    it("logs error and still emits cipherModified$ when delete throws", async () => {
      cipherService.softDeleteWithServer.mockRejectedValue(new Error("server error"));
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.delete(makeCipher());

      expect(logService.error).toHaveBeenCalled();
      await expect(successPromise).resolves.toBeUndefined();
    });

    it("emits cipherModified$ after deleting", async () => {
      const successPromise = firstValueFrom(service.cipherModified$);

      await service.delete(makeCipher());

      await expect(successPromise).resolves.toBeUndefined();
    });

    describe("password reprompt", () => {
      it("skips reprompt when cipher.reprompt is None", async () => {
        await service.delete(makeCipher({ reprompt: CipherRepromptType.None }));

        expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
      });

      it("prompts when cipher.reprompt is Password", async () => {
        await service.delete(makeCipher({ reprompt: CipherRepromptType.Password }));

        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalled();
      });

      it("prompts on every call so a lock/unlock cycle resets the gate", async () => {
        const cipher = makeCipher({ reprompt: CipherRepromptType.Password });

        await service.delete(cipher);
        await service.delete(cipher);

        expect(passwordRepromptService.showPasswordPrompt).toHaveBeenCalledTimes(2);
      });
    });
  });
});

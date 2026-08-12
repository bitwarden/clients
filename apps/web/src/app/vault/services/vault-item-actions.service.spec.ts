import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  AttachmentsV2Component,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
} from "@bitwarden/vault";

import { WebVaultItemActionsService } from "./vault-item-actions.service";

describe("WebVaultItemActionsService", () => {
  const userId = "user-1" as UserId;
  const cipherId = "cipher-1" as CipherId;

  let service: WebVaultItemActionsService;
  let cipherService: MockProxy<CipherService>;
  let cipherArchiveService: MockProxy<CipherArchiveService>;
  let cipherFormConfigService: MockProxy<DefaultCipherFormConfigService>;
  let dialogService: MockProxy<DialogService>;
  let messagingService: MockProxy<MessagingService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let premiumUpgradePromptService: MockProxy<PremiumUpgradePromptService>;
  let router: MockProxy<Router>;
  let toastService: MockProxy<ToastService>;

  let itemDialogOpen: jest.SpyInstance;
  let attachmentsDialogOpen: jest.SpyInstance;

  /** A plain personal login, no reprompt. */
  const buildCipher = (overrides: Partial<CipherView> = {}) => {
    const cipher = new CipherView();
    cipher.id = cipherId;
    cipher.name = "Item";
    cipher.type = CipherType.Login;
    cipher.edit = true;
    cipher.reprompt = CipherRepromptType.None;
    return Object.assign(cipher, overrides);
  };

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherArchiveService = mock<CipherArchiveService>();
    cipherFormConfigService = mock<DefaultCipherFormConfigService>();
    dialogService = mock<DialogService>();
    messagingService = mock<MessagingService>();
    passwordRepromptService = mock<PasswordRepromptService>();
    premiumUpgradePromptService = mock<PremiumUpgradePromptService>();
    router = mock<Router>();
    toastService = mock<ToastService>();

    // The stored cipher backs the dialog config; the row is what drives reprompt.
    cipherService.get.mockResolvedValue({
      id: cipherId,
      type: CipherType.Login,
      edit: true,
    } as unknown as Cipher);
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);
    router.navigate.mockResolvedValue(true);

    const accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as Account);

    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    itemDialogOpen = jest
      .spyOn(VaultItemDialogComponent, "open")
      .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<never>);
    attachmentsDialogOpen = jest
      .spyOn(AttachmentsV2Component, "open")
      .mockReturnValue({ closed: of(undefined) } as unknown as DialogRef<never>);

    TestBed.configureTestingModule({
      providers: [
        WebVaultItemActionsService,
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: cipherService },
        { provide: CipherArchiveService, useValue: cipherArchiveService },
        { provide: DefaultCipherFormConfigService, useValue: cipherFormConfigService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: mock<LogService>() },
        { provide: MessagingService, useValue: messagingService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: PremiumUpgradePromptService, useValue: premiumUpgradePromptService },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toastService },
      ],
    });

    service = TestBed.inject(WebVaultItemActionsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("password reprompt", () => {
    const protectedCipher = () => buildCipher({ reprompt: CipherRepromptType.Password });

    beforeEach(() => {
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);
    });

    it("does not open the view dialog when the prompt is refused", async () => {
      await service.view(protectedCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("does not open the edit dialog when the prompt is refused", async () => {
      await service.edit(protectedCipher());

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("does not open the attachments dialog when the prompt is refused", async () => {
      await service.viewAttachments(protectedCipher(), true, []);

      expect(attachmentsDialogOpen).not.toHaveBeenCalled();
    });

    it("does not archive when the prompt is refused", async () => {
      await service.archive(protectedCipher());

      expect(cipherArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });

    it("does not delete when the prompt is refused", async () => {
      await service.delete(protectedCipher());

      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
      expect(cipherService.deleteWithServer).not.toHaveBeenCalled();
    });

    it("still opens the dialog for an unprotected item", async () => {
      await service.view(buildCipher());

      expect(itemDialogOpen).toHaveBeenCalled();
      expect(passwordRepromptService.showPasswordPrompt).not.toHaveBeenCalled();
    });
  });

  describe("view", () => {
    it("opens the dialog in view mode", async () => {
      await service.view(buildCipher());

      expect(itemDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ mode: "view" }),
      );
    });

    it("builds a partial-edit config when the user cannot edit the item", async () => {
      cipherService.get.mockResolvedValue({
        id: cipherId,
        type: CipherType.Login,
        edit: false,
      } as unknown as Cipher);

      await service.view(buildCipher());

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "partial-edit",
        cipherId,
        CipherType.Login,
      );
    });

    it("toasts and skips the dialog when the item no longer exists", async () => {
      cipherService.get.mockResolvedValue(null as unknown as Cipher);

      await service.view(buildCipher());

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "unknownCipher" }),
      );
      expect(itemDialogOpen).not.toHaveBeenCalled();
    });

    it("clears the item query params once the dialog closes", async () => {
      await service.view(buildCipher());

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { cipherId: null, itemId: null, action: null },
          replaceUrl: true,
        }),
      );
    });
  });

  describe("edit and clone", () => {
    it("opens the form in edit mode", async () => {
      await service.edit(buildCipher());

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "edit",
        cipherId,
        CipherType.Login,
      );
      expect(itemDialogOpen).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ mode: "form" }),
      );
    });

    it("opens the form in clone mode", async () => {
      await service.clone(buildCipher());

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "clone",
        cipherId,
        CipherType.Login,
      );
    });

    it("does not clone when the passkey warning is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const withPasskey = buildCipher();
      withPasskey.login.fido2Credentials = [{}] as never;

      await service.clone(withPasskey);

      expect(itemDialogOpen).not.toHaveBeenCalled();
    });
  });

  describe("add", () => {
    it("builds an add config with no seeded values", async () => {
      await service.add(CipherType.Card);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Card,
      );
    });
  });

  describe("viewAttachments", () => {
    it("prompts for premium instead of opening for a personal item without premium", async () => {
      await service.viewAttachments(buildCipher(), false, []);

      expect(premiumUpgradePromptService.promptForPremium).toHaveBeenCalled();
      expect(attachmentsDialogOpen).not.toHaveBeenCalled();
    });

    it("prompts to upgrade the organization when it has no storage allocated", async () => {
      const orgCipher = buildCipher({ organizationId: "org-1" });
      const organization = { id: "org-1", maxStorageGb: 0 } as Organization;

      await service.viewAttachments(orgCipher, false, [organization]);

      expect(messagingService.send).toHaveBeenCalledWith("upgradeOrganization", {
        organizationId: "org-1",
      });
      expect(attachmentsDialogOpen).not.toHaveBeenCalled();
    });

    it("opens for a personal item when the user has premium", async () => {
      await service.viewAttachments(buildCipher(), true, []);

      expect(attachmentsDialogOpen).toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    it("archives once confirmed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.archive(buildCipher());

      expect(cipherArchiveService.archiveWithServer).toHaveBeenCalledWith(cipherId, userId);
    });

    it("does not archive when the confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.archive(buildCipher());

      expect(cipherArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });
  });

  describe("unarchive", () => {
    it("unarchives without a confirmation step", async () => {
      await service.unarchive(buildCipher());

      expect(cipherArchiveService.unarchiveWithServer).toHaveBeenCalledWith(cipherId, userId);
    });
  });

  describe("delete", () => {
    it("soft deletes an item that is not already in the trash", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.delete(buildCipher());

      expect(cipherService.softDeleteWithServer).toHaveBeenCalledWith(cipherId, userId);
      expect(cipherService.deleteWithServer).not.toHaveBeenCalled();
    });

    it("permanently deletes an item already in the trash", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.delete(buildCipher({ deletedDate: new Date() }));

      expect(cipherService.deleteWithServer).toHaveBeenCalledWith(cipherId, userId);
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("does not delete when the confirmation is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.delete(buildCipher());

      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("reports missing permissions instead of deleting an item the user cannot edit", async () => {
      await service.delete(buildCipher({ edit: false }));

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "missingPermissions" }),
      );
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });
  });

  describe("restore", () => {
    it("restores an item in the trash", async () => {
      await service.restore(buildCipher({ deletedDate: new Date() }));

      expect(cipherService.restoreWithServer).toHaveBeenCalledWith(cipherId, userId);
    });

    it("ignores an item that is not deleted", async () => {
      await service.restore(buildCipher());

      expect(cipherService.restoreWithServer).not.toHaveBeenCalled();
    });
  });

  describe("toggleFavorite", () => {
    it("flips the flag and persists it", async () => {
      const fullView = buildCipher({ favorite: false });
      cipherService.getFullCipherView.mockResolvedValue(fullView);

      await service.toggleFavorite(fullView);

      expect(fullView.favorite).toBe(true);
      expect(cipherService.updateWithServer).toHaveBeenCalledWith(fullView, userId);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ message: "itemAddedToFavorites" }),
      );
    });
  });
});

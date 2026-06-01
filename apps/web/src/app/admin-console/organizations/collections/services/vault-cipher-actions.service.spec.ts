import { EnvironmentInjector, runInInjectionContext } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { CipherId, CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import {
  AttachmentDialogResult,
  AttachmentsV2Component,
  CipherFormConfig,
  CipherFormConfigService,
  CollectionAssignmentResult,
  PasswordRepromptService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterModel,
  RoutedVaultFilterService,
  VaultFilter,
  VaultItemDialogComponent,
  VaultItemDialogResult,
} from "@bitwarden/vault";
import * as EntityEventsModule from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";

import * as AssignCollectionsModule from "../../../../vault/components/assign-collections";
import { BulkDeleteDialogResult } from "../../../../vault/individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";
import * as BulkDeleteModule from "../../../../vault/individual-vault/bulk-action-dialogs/bulk-delete-dialog/bulk-delete-dialog.component";

import { VaultCipherActionsService } from "./vault-cipher-actions.service";
import { VaultCollectionService } from "./vault-collection.service";

const USER_ID = "user-1" as UserId;
const ORG_ID = "org-1" as OrganizationId;

function makeDialogRef<T>(result: T): DialogRef<T> {
  return { closed: of(result) } as unknown as DialogRef<T>;
}

function buildOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG_ID,
    canEditAllCiphers: true,
    canEditAnyCollection: true,
    canEditUnassignedCiphers: true,
    permissions: { editAnyCollection: true },
    allowAdminAccessToAllCollectionItems: false,
    maxStorageGb: 1,
    useEvents: false,
    ...overrides,
  } as Organization;
}

function buildCipher(overrides: Partial<CipherView> = {}): CipherView {
  return {
    id: "cipher-1" as CipherId,
    reprompt: CipherRepromptType.None,
    edit: true,
    isDeleted: false,
    deletedDate: null,
    isUnassigned: false,
    organizationId: ORG_ID,
    viewPassword: true,
    collectionIds: ["col-1" as CollectionId],
    login: { hasFido2Credentials: false },
    name: "Test Cipher",
    ...overrides,
  } as unknown as CipherView;
}

describe("VaultCipherActionsService", () => {
  let service: VaultCipherActionsService;
  let cipherService: MockProxy<CipherService>;
  let passwordRepromptService: MockProxy<PasswordRepromptService>;
  let cipherFormConfigService: MockProxy<CipherFormConfigService>;
  let totpService: MockProxy<TotpService>;
  let eventCollectionService: MockProxy<EventCollectionService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;
  let messagingService: MockProxy<MessagingService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let i18nService: MockProxy<I18nService>;
  let organizationService: MockProxy<OrganizationService>;

  let organization: Organization;
  let refresh: jest.Mock;
  let navigate: jest.Mock;
  let mockFormConfig: CipherFormConfig;
  let activeFilterSubject: BehaviorSubject<VaultFilter>;

  function initService(org = organization) {
    organizationService.organizations$.mockReturnValue(of([org]));

    const envInjector = TestBed.inject(EnvironmentInjector);
    service = runInInjectionContext(envInjector, () => {
      return new VaultCipherActionsService();
    });

    service.refresh$.subscribe(refresh);
    service.navigate$.subscribe(({ queryParams, options }) => navigate(queryParams, options));
  }

  beforeEach(() => {
    cipherService = mock<CipherService>();
    passwordRepromptService = mock<PasswordRepromptService>();
    cipherFormConfigService = mock<CipherFormConfigService>();
    totpService = mock<TotpService>();
    eventCollectionService = mock<EventCollectionService>();
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    messagingService = mock<MessagingService>();
    platformUtilsService = mock<PlatformUtilsService>();
    i18nService = mock<I18nService>();
    organizationService = mock<OrganizationService>();

    i18nService.t.mockReturnValue("translated");
    passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);
    passwordRepromptService.protectedFields.mockReturnValue(["Password"]);
    eventCollectionService.collect.mockResolvedValue(undefined);

    mockFormConfig = { mode: "edit" } as unknown as CipherFormConfig;
    cipherFormConfigService.buildConfig.mockResolvedValue(mockFormConfig);

    organization = buildOrg();
    refresh = jest.fn();
    navigate = jest.fn();
    activeFilterSubject = new BehaviorSubject({
      collectionId: "col-1" as CollectionId,
    } as unknown as VaultFilter);

    TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: cipherService },
        { provide: PasswordRepromptService, useValue: passwordRepromptService },
        { provide: CipherFormConfigService, useValue: cipherFormConfigService },
        { provide: TotpService, useValue: totpService },
        { provide: EventCollectionService, useValue: eventCollectionService },
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: AccountService, useValue: mockAccountServiceWith(USER_ID) },
        { provide: MessagingService, useValue: messagingService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: I18nService, useValue: i18nService },
        { provide: Router, useValue: mock<Router>() },
        { provide: OrganizationService, useValue: organizationService },
        {
          provide: RoutedVaultFilterService,
          useValue: {
            filter$: of({
              organizationId: ORG_ID,
              type: undefined,
            } as unknown as RoutedVaultFilterModel),
          },
        },
        {
          provide: RoutedVaultFilterBridgeService,
          useValue: { activeFilter$: activeFilterSubject.asObservable() },
        },
        {
          provide: VaultCollectionService,
          useValue: { editableCollections$: of([] as CollectionAdminView[]) },
        },
      ],
    });

    initService();
  });

  describe("hasOpenDialog", () => {
    it("returns false when no dialog is open", () => {
      expect(service.hasOpenDialog).toBe(false);
    });

    it("returns true while a dialog is open", () => {
      const neverClose$ = new Subject<VaultItemDialogResult | undefined>();
      jest
        .spyOn(VaultItemDialogComponent, "open")
        .mockReturnValue({ closed: neverClose$.asObservable() } as unknown as DialogRef<
          VaultItemDialogResult | undefined
        >);

      void service.openVaultItemDialog("view", mockFormConfig);

      expect(service.hasOpenDialog).toBe(true);
    });
  });

  describe("editCipherAttachments", () => {
    it("navigates away and returns early when reprompt fails", async () => {
      const cipher = buildCipher({ reprompt: CipherRepromptType.Password });
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.editCipherAttachments(cipher);

      expect(navigate).toHaveBeenCalledWith({ cipherId: null, itemId: null }, expect.anything());
      expect(messagingService.send).not.toHaveBeenCalled();
    });

    it("sends upgradeOrganization message when org has no storage", async () => {
      const cipher = buildCipher();
      initService(buildOrg({ maxStorageGb: 0 }));

      await service.editCipherAttachments(cipher);

      expect(messagingService.send).toHaveBeenCalledWith(
        "upgradeOrganization",
        expect.objectContaining({ organizationId: ORG_ID }),
      );
    });

    it("calls refresh when an attachment is uploaded", async () => {
      const cipher = buildCipher();
      jest
        .spyOn(AttachmentsV2Component, "open")
        .mockReturnValue(makeDialogRef({ action: AttachmentDialogResult.Uploaded }) as any);

      await service.editCipherAttachments(cipher);

      expect(refresh).toHaveBeenCalled();
    });

    it("calls refresh when an attachment is removed", async () => {
      const cipher = buildCipher();
      jest
        .spyOn(AttachmentsV2Component, "open")
        .mockReturnValue(makeDialogRef({ action: AttachmentDialogResult.Removed }) as any);

      await service.editCipherAttachments(cipher);

      expect(refresh).toHaveBeenCalled();
    });

    it("does not call refresh when dialog closes without action", async () => {
      const cipher = buildCipher();
      jest.spyOn(AttachmentsV2Component, "open").mockReturnValue(makeDialogRef(undefined) as any);

      await service.editCipherAttachments(cipher);

      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("addCipher", () => {
    beforeEach(() => {
      jest.spyOn(VaultItemDialogComponent, "open").mockReturnValue(makeDialogRef(undefined));
    });

    it("passes the explicit cipherType to buildConfig when one is provided", async () => {
      await service.addCipher(CipherType.Card);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Card,
      );
    });

    it("falls back to activeFilter.cipherType when no cipherType is provided", async () => {
      activeFilterSubject.next({
        cipherType: CipherType.Login,
        collectionId: "col-1" as CollectionId,
      } as unknown as VaultFilter);

      await service.addCipher();

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.Login,
      );
    });

    it("prefers the explicit cipherType over activeFilter.cipherType when both are set", async () => {
      activeFilterSubject.next({
        cipherType: CipherType.Login,
        collectionId: "col-1" as CollectionId,
      } as unknown as VaultFilter);

      await service.addCipher(CipherType.SecureNote);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith(
        "add",
        undefined,
        CipherType.SecureNote,
      );
    });

    it("passes the falsy activeFilter.cipherType through when neither source has a type", async () => {
      activeFilterSubject.next({
        cipherType: null,
        collectionId: "col-1" as CollectionId,
      } as unknown as VaultFilter);

      await service.addCipher();

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith("add", undefined, null);
    });
  });

  describe("editCipher", () => {
    beforeEach(() => {
      jest.spyOn(VaultItemDialogComponent, "open").mockReturnValue(makeDialogRef(undefined));
    });

    it("navigates away and returns early when reprompt fails", async () => {
      const cipher = buildCipher({ reprompt: CipherRepromptType.Password });
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.editCipher(cipher);

      expect(navigate).toHaveBeenCalledWith({ cipherId: null, itemId: null }, expect.anything());
      expect(cipherFormConfigService.buildConfig).not.toHaveBeenCalled();
    });

    it("builds config with 'edit' mode for a normal edit", async () => {
      const cipher = buildCipher();

      await service.editCipher(cipher);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith("edit", cipher.id);
    });

    it("builds config with 'clone' mode when cloneCipher is true", async () => {
      const cipher = buildCipher();

      await service.editCipher(cipher, true);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith("clone", cipher.id);
    });

    it("works when cipher is undefined (add mode via buildConfig)", async () => {
      await service.editCipher(undefined);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith("edit", undefined);
    });
  });

  describe("viewCipherById", () => {
    it("returns early when cipher is falsy", async () => {
      await service.viewCipherById(null as unknown as CipherView);

      expect(cipherFormConfigService.buildConfig).not.toHaveBeenCalled();
    });

    it("navigates away when reprompt fails", async () => {
      const cipher = buildCipher({ reprompt: CipherRepromptType.Password });
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.viewCipherById(cipher);

      expect(navigate).toHaveBeenCalledWith(
        { cipherId: null, itemId: null, action: null },
        expect.anything(),
      );
      expect(cipherFormConfigService.buildConfig).not.toHaveBeenCalled();
    });

    it("opens dialog in view mode", async () => {
      const cipher = buildCipher();
      const openSpy = jest
        .spyOn(VaultItemDialogComponent, "open")
        .mockReturnValue(makeDialogRef(undefined));

      await service.viewCipherById(cipher);

      expect(openSpy).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({ mode: "view" }),
      );
    });
  });

  describe("openVaultItemDialog", () => {
    it("calls refresh when dialog result is Saved", async () => {
      jest
        .spyOn(VaultItemDialogComponent, "open")
        .mockReturnValue(makeDialogRef(VaultItemDialogResult.Saved));

      await service.openVaultItemDialog("view", mockFormConfig);

      expect(refresh).toHaveBeenCalled();
    });

    it("calls refresh when dialog result is Deleted", async () => {
      jest
        .spyOn(VaultItemDialogComponent, "open")
        .mockReturnValue(makeDialogRef(VaultItemDialogResult.Deleted));

      await service.openVaultItemDialog("view", mockFormConfig);

      expect(refresh).toHaveBeenCalled();
    });

    it("does not call refresh when dialog result is PremiumUpgrade", async () => {
      jest
        .spyOn(VaultItemDialogComponent, "open")
        .mockReturnValue(makeDialogRef(VaultItemDialogResult.PremiumUpgrade));

      await service.openVaultItemDialog("view", mockFormConfig);

      expect(refresh).not.toHaveBeenCalled();
    });

    it("clears dialog ref after dialog closes", async () => {
      jest.spyOn(VaultItemDialogComponent, "open").mockReturnValue(makeDialogRef(undefined));

      await service.openVaultItemDialog("view", mockFormConfig);

      expect(service.hasOpenDialog).toBe(false);
    });
  });

  describe("cloneCipher", () => {
    it("returns false when user declines fido2 credential warning", async () => {
      const cipher = buildCipher({ login: { hasFido2Credentials: true } } as any);
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.cloneCipher(cipher);

      expect(result).toBe(false);
      expect(cipherFormConfigService.buildConfig).not.toHaveBeenCalled();
    });

    it("proceeds to clone when user confirms fido2 warning", async () => {
      const cipher = buildCipher({ login: { hasFido2Credentials: true } } as any);
      dialogService.openSimpleDialog.mockResolvedValue(true);
      jest.spyOn(VaultItemDialogComponent, "open").mockReturnValue(makeDialogRef(undefined));

      await service.cloneCipher(cipher);

      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith("clone", cipher.id);
    });

    it("clones without fido2 dialog when cipher has no passkeys", async () => {
      const cipher = buildCipher({ login: { hasFido2Credentials: false } } as any);
      jest.spyOn(VaultItemDialogComponent, "open").mockReturnValue(makeDialogRef(undefined));

      await service.cloneCipher(cipher);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(cipherFormConfigService.buildConfig).toHaveBeenCalledWith("clone", cipher.id);
    });
  });

  describe("restore", () => {
    it("returns early without action when cipher is not in trash", async () => {
      const cipher = buildCipher({ isDeleted: false, deletedDate: null });

      await service.restore(cipher);

      expect(cipherService.restoreWithServer).not.toHaveBeenCalled();
    });

    it("shows permissions error and does not restore when user lacks edit access", async () => {
      const cipher = buildCipher({ isDeleted: true, deletedDate: new Date(), edit: false });
      initService(
        buildOrg({
          permissions: { editAnyCollection: false } as any,
          allowAdminAccessToAllCollectionItems: false,
        }),
      );

      await service.restore(cipher);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(cipherService.restoreWithServer).not.toHaveBeenCalled();
    });

    it("does not restore when reprompt fails", async () => {
      const cipher = buildCipher({
        isDeleted: true,
        deletedDate: new Date(),
        reprompt: CipherRepromptType.Password,
      });
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.restore(cipher);

      expect(cipherService.restoreWithServer).not.toHaveBeenCalled();
    });

    it("calls restoreWithServer, shows success toast, and calls refresh", async () => {
      const cipher = buildCipher({ isDeleted: true, deletedDate: new Date() });
      cipherService.restoreWithServer.mockResolvedValue(undefined);

      await service.restore(cipher);

      expect(cipherService.restoreWithServer).toHaveBeenCalledWith(
        cipher.id,
        USER_ID,
        expect.any(Boolean),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("logs error and returns gracefully when restoreWithServer throws", async () => {
      const cipher = buildCipher({ isDeleted: true, deletedDate: new Date() });
      cipherService.restoreWithServer.mockRejectedValue(new Error("server error"));

      await service.restore(cipher);

      expect(logService.error).toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("bulkRestore", () => {
    it("shows permissions error when user lacks edit access to any cipher", async () => {
      initService(
        buildOrg({
          permissions: { editAnyCollection: false } as any,
          allowAdminAccessToAllCollectionItems: false,
        }),
      );
      const ciphers = [buildCipher({ edit: false })];

      await service.bulkRestore(ciphers);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(cipherService.restoreManyWithServer).not.toHaveBeenCalled();
    });

    it("returns early when reprompt fails", async () => {
      const ciphers = [buildCipher({ reprompt: CipherRepromptType.Password })];
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.bulkRestore(ciphers);

      expect(cipherService.restoreManyWithServer).not.toHaveBeenCalled();
    });

    it("shows nothing-selected toast when no editable or unassigned ciphers found", async () => {
      initService(buildOrg({ canEditAllCiphers: false }));
      const ciphers = [buildCipher({ edit: false, collectionIds: ["col-1" as CollectionId] })];

      await service.bulkRestore(ciphers);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(cipherService.restoreManyWithServer).not.toHaveBeenCalled();
    });

    it("sends all cipher ids when org can edit all ciphers", async () => {
      cipherService.restoreManyWithServer.mockResolvedValue(undefined);
      const ciphers = [
        buildCipher({ id: "c1" as CipherId }),
        buildCipher({ id: "c2" as CipherId }),
      ];

      await service.bulkRestore(ciphers);

      expect(cipherService.restoreManyWithServer).toHaveBeenCalledWith(
        expect.arrayContaining(["c1", "c2"]),
        USER_ID,
        ORG_ID,
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("separates unassigned from editable ciphers when org cannot edit all", async () => {
      initService(buildOrg({ canEditAllCiphers: false }));
      cipherService.restoreManyWithServer.mockResolvedValue(undefined);
      const unassigned = buildCipher({
        id: "unassigned-1" as CipherId,
        collectionIds: [],
        isUnassigned: true,
      });
      const editable = buildCipher({
        id: "editable-1" as CipherId,
        edit: true,
        collectionIds: ["col-1" as CollectionId],
      });

      await service.bulkRestore([unassigned, editable]);

      expect(cipherService.restoreManyWithServer).toHaveBeenCalledWith(
        expect.arrayContaining(["unassigned-1", "editable-1"]),
        USER_ID,
        ORG_ID,
      );
    });
  });

  describe("deleteCipher", () => {
    it("shows permissions error and returns false when cipher is not editable", async () => {
      initService(buildOrg({ canEditAllCiphers: false }));
      const cipher = buildCipher({ edit: false });

      const result = await service.deleteCipher(cipher);

      expect(result).toBe(false);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("returns false when reprompt fails", async () => {
      const cipher = buildCipher({ reprompt: CipherRepromptType.Password });
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      const result = await service.deleteCipher(cipher);

      expect(result).toBe(false);
    });

    it("returns false when user cancels the confirmation dialog", async () => {
      const cipher = buildCipher();
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.deleteCipher(cipher);

      expect(result).toBe(false);
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
    });

    it("calls softDeleteWithServer and refreshes for a non-permanent delete", async () => {
      const cipher = buildCipher({ isDeleted: false });
      dialogService.openSimpleDialog.mockResolvedValue(true);
      cipherService.softDeleteWithServer.mockResolvedValue(undefined);

      const result = await service.deleteCipher(cipher);

      expect(result).toBe(true);
      expect(cipherService.softDeleteWithServer).toHaveBeenCalledWith(
        cipher.id,
        USER_ID,
        expect.any(Boolean),
      );
      expect(cipherService.deleteWithServer).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
    });

    it("calls deleteWithServer and refreshes for a permanent delete", async () => {
      const cipher = buildCipher({ isDeleted: true, deletedDate: new Date() });
      dialogService.openSimpleDialog.mockResolvedValue(true);
      cipherService.deleteWithServer.mockResolvedValue(undefined);

      const result = await service.deleteCipher(cipher);

      expect(result).toBe(true);
      expect(cipherService.deleteWithServer).toHaveBeenCalledWith(
        cipher.id,
        USER_ID,
        expect.any(Boolean),
      );
      expect(cipherService.softDeleteWithServer).not.toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
    });

    it("returns false and logs error when the server call throws", async () => {
      const cipher = buildCipher();
      dialogService.openSimpleDialog.mockResolvedValue(true);
      cipherService.softDeleteWithServer.mockRejectedValue(new Error("network error"));

      const result = await service.deleteCipher(cipher);

      expect(result).toBe(false);
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("bulkDelete", () => {
    it("shows permissions error when a cipher is not editable", async () => {
      initService(buildOrg({ canEditAllCiphers: false }));
      const ciphers = [buildCipher({ edit: false })];
      const collections: any[] = [];

      await service.bulkDelete(ciphers, collections, organization);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("shows nothing-selected toast when both lists are empty", async () => {
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(true);

      await service.bulkDelete([], [], organization);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("calls refresh when bulk delete dialog returns Deleted", async () => {
      jest
        .spyOn(BulkDeleteModule, "openBulkDeleteDialog")
        .mockReturnValue(makeDialogRef(BulkDeleteDialogResult.Deleted));
      const cipher = buildCipher();

      await service.bulkDelete([cipher], [], organization);

      expect(refresh).toHaveBeenCalled();
    });

    it("does not call refresh when bulk delete dialog is cancelled", async () => {
      jest
        .spyOn(BulkDeleteModule, "openBulkDeleteDialog")
        .mockReturnValue(makeDialogRef(undefined));
      const cipher = buildCipher();

      await service.bulkDelete([cipher], [], organization);

      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("copy", () => {
    it("copies username value to clipboard", async () => {
      const cipher = buildCipher({ login: { username: "user@example.com" } } as any);

      await service.copy(cipher, "username");

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "user@example.com",
        expect.any(Object),
      );
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "info" }),
      );
    });

    it("copies password value and collects a password-copied event", async () => {
      const cipher = buildCipher({ login: { password: "s3cr3t" } } as any);

      await service.copy(cipher, "password");

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "s3cr3t",
        expect.any(Object),
      );
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientCopiedPassword,
        cipher.id,
      );
    });

    it("fetches TOTP code and collects a hidden-field-copied event", async () => {
      const cipher = buildCipher({ login: { totp: "totp-seed" } } as any);
      totpService.getCode$.mockReturnValue(of({ code: "123456" } as any));

      await service.copy(cipher, "totp");

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith(
        "123456",
        expect.any(Object),
      );
      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.Cipher_ClientCopiedHiddenField,
        cipher.id,
      );
    });

    it("shows error toast when totp seed is null", async () => {
      const cipher = buildCipher({ login: { totp: null } } as any);

      await service.copy(cipher, "totp");

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("does not copy when the field value is null", async () => {
      const cipher = buildCipher({ login: { username: null } } as any);

      await service.copy(cipher, "username");

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });

    it("does not copy when reprompt fails for a protected field", async () => {
      const cipher = buildCipher({
        reprompt: CipherRepromptType.Password,
        login: { password: "s3cr3t" },
      } as any);
      passwordRepromptService.protectedFields.mockReturnValue(["Password"]);
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.copy(cipher, "password");

      expect(platformUtilsService.copyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe("bulkAssignToCollections", () => {
    it("returns early when reprompt fails", async () => {
      const items = [buildCipher({ reprompt: CipherRepromptType.Password })];
      passwordRepromptService.showPasswordPrompt.mockResolvedValue(false);

      await service.bulkAssignToCollections(items);

      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("shows nothing-selected toast when items list is empty", async () => {
      await service.bulkAssignToCollections([]);

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });

    it("calls refresh when collection assignment is saved", async () => {
      const items = [buildCipher()];
      jest
        .spyOn(AssignCollectionsModule.AssignCollectionsWebComponent, "open")
        .mockReturnValue(makeDialogRef(CollectionAssignmentResult.Saved) as any);

      await service.bulkAssignToCollections(items);

      expect(refresh).toHaveBeenCalled();
    });

    it("does not call refresh when assignment dialog is cancelled", async () => {
      const items = [buildCipher()];
      jest
        .spyOn(AssignCollectionsModule.AssignCollectionsWebComponent, "open")
        .mockReturnValue(makeDialogRef(undefined) as any);

      await service.bulkAssignToCollections(items);

      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("viewEvents", () => {
    it("opens entity events dialog with the cipher's details", async () => {
      const cipher = buildCipher({ name: "My Cipher" });
      const openSpy = jest
        .spyOn(EntityEventsModule, "openEntityEventsDialog")
        .mockImplementation(() => {});

      await service.viewEvents(cipher);

      expect(openSpy).toHaveBeenCalledWith(
        dialogService,
        expect.objectContaining({
          data: expect.objectContaining({
            entityId: cipher.id,
            name: cipher.name,
            organizationId: ORG_ID,
            entity: "cipher",
            showUser: true,
          }),
        }),
      );
    });
  });
});

// IntersectionObserver is not available in JSDOM; mock it so DialogComponent scroll detection doesn't throw.
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
});

import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, NEVER, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs/abstractions/event-collection.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { CipherFormConfig } from "../cipher-form";
import { AttachmentDialogResult } from "../cipher-view/attachments/attachments-v2.component";

import {
  VaultItemDialogComponent,
  VaultItemDialogParams,
  VaultItemDialogResult,
} from "./vault-item-dialog.component";

class TestVaultItemDialogComponent extends VaultItemDialogComponent {
  setTestCipher(cipher: Partial<CipherView> | undefined) {
    this.cipher = cipher as CipherView;
  }

  setTestParams(params: Partial<VaultItemDialogParams>) {
    this.params = { ...this.params, ...params } as VaultItemDialogParams;
  }

  setTestFormConfig(config: Partial<CipherFormConfig>) {
    this.formConfig = { ...this.formConfig, ...config } as CipherFormConfig;
  }

  mockCipherFormComponent(patchCipher: jest.Mock) {
    Object.defineProperty(this, "cipherFormComponent", {
      value: () => ({ patchCipher }),
      configurable: true,
    });
  }

  mockViewChildren() {
    Object.defineProperty(this, "dialogContent", {
      value: () => ({ nativeElement: { parentElement: { scrollTop: 0 } } }),
      configurable: true,
    });
    Object.defineProperty(this, "dialogComponent", {
      value: () => ({ handleAutofocus: jest.fn(), focusHeader: jest.fn() }),
      configurable: true,
    });
  }

  triggerFormReady() {
    this["_formReadySubject"].next();
  }
}

describe("VaultItemDialogComponent", () => {
  let component: TestVaultItemDialogComponent;
  let fixture: ComponentFixture<TestVaultItemDialogComponent>;

  const close = jest.fn();
  const mockRouter = { navigate: jest.fn().mockResolvedValue(true) };
  const mockDialogService = {
    open: jest.fn(),
    openDrawer: jest.fn(),
    openSimpleDialog: jest.fn().mockResolvedValue(true),
  };
  const mockArchiveService = {
    hasArchiveFlagEnabled$: of(false),
    userCanArchive$: jest.fn().mockReturnValue(of(false)),
    archiveWithServer: jest.fn().mockResolvedValue({}),
    unarchiveWithServer: jest.fn().mockResolvedValue({}),
  };

  let cipherServiceMock: MockProxy<CipherService>;
  let cipherAuthorizationServiceMock: MockProxy<CipherAuthorizationService>;
  let revealedCipherServiceMock: MockProxy<RevealedCipherService>;
  const canEditCipherReturnValue$ = new BehaviorSubject(false);
  const canDeleteCipherReturnValue$ = new BehaviorSubject(false);

  const baseFormConfig: Partial<CipherFormConfig> = {
    mode: "edit",
    cipherType: CipherType.Login,
    collections: [],
    organizations: [],
    admin: false,
    originalCipher: undefined,
  };

  const baseParams: VaultItemDialogParams = {
    mode: "view",
    formConfig: baseFormConfig as CipherFormConfig,
    isAdminConsoleAction: false,
    restore: undefined,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    cipherServiceMock = mock<CipherService>({
      get: jest.fn().mockReturnValue(of({ id: "new-cipher-id" } as any)),
    });
    cipherServiceMock.cipherView$.mockReturnValue(NEVER);
    cipherAuthorizationServiceMock = mock<CipherAuthorizationService>({
      canEditCipher$: jest.fn().mockReturnValue(canEditCipherReturnValue$),
      canDeleteCipher$: jest.fn().mockReturnValue(canDeleteCipherReturnValue$),
    });
    revealedCipherServiceMock = mock<RevealedCipherService>();
    revealedCipherServiceMock.getOrReveal.mockResolvedValue(null);
    revealedCipherServiceMock.displayView$.mockImplementation((_, storedView) => of(storedView));

    await TestBed.configureTestingModule({
      imports: [TestVaultItemDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: DIALOG_DATA, useValue: { ...baseParams, formConfig: { ...baseFormConfig } } },
        { provide: DialogRef, useValue: { close } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ToastService, useValue: { showToast: jest.fn() } },
        { provide: MessagingService, useValue: { send: jest.fn() } },
        { provide: LogService, useValue: { error: jest.fn() } },
        { provide: CipherService, useValue: cipherServiceMock },
        { provide: Router, useValue: mockRouter },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "test-user-id" as any }) },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)) },
        },
        {
          provide: PremiumUpgradePromptService,
          useValue: { upgradeConfirmed$: of(false), promptForPremium: jest.fn() },
        },
        { provide: CipherAuthorizationService, useValue: cipherAuthorizationServiceMock },
        { provide: ApiService, useValue: mock<ApiService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>() },
        { provide: CipherArchiveService, useValue: mockArchiveService },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: jest.fn().mockReturnValue(of(false)) },
        },
        { provide: RevealedCipherService, useValue: revealedCipherServiceMock },
      ],
    })
      .overrideProvider(DialogService, { useValue: mockDialogService })
      .compileComponents();

    fixture = TestBed.createComponent(TestVaultItemDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("dialog title", () => {
    it("sets title for view mode and Login type", () => {
      component.setTestCipher({ type: CipherType.Login } as any);
      component.setTestParams({ mode: "view" });
      component.setTestFormConfig({ cipherType: CipherType.Login });
      component["updateTitle"]();

      expect(component["title"]).toBe("viewItemHeaderLoginSentenceCase");
    });

    it("sets title for form mode (edit) and Card type", () => {
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ mode: "edit", cipherType: CipherType.Card });
      component["updateTitle"]();

      expect(component["title"]).toBe("editItemHeaderCardSentenceCase");
    });

    it("sets title for form mode (add) and Identity type", () => {
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ mode: "add", cipherType: CipherType.Identity });
      component["updateTitle"]();

      expect(component["title"]).toBe("addItemHeaderIdentity");
    });

    it("sets title for form mode (clone) and Card type", () => {
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ mode: "clone", cipherType: CipherType.Card });
      component["updateTitle"]();

      expect(component["title"]).toBe("addItemHeaderCard");
    });
  });

  describe("disableEdit", () => {
    it("returns false when formConfig mode is partial-edit even if canEdit is false", () => {
      component["canEdit"] = false;
      component.setTestFormConfig({ mode: "partial-edit" });

      expect(component["disableEdit"]).toBe(false);
    });

    it("returns true when canEdit is false and formConfig mode is not partial-edit", () => {
      component["canEdit"] = false;
      component.setTestFormConfig({ mode: "edit" });

      expect(component["disableEdit"]).toBe(true);
    });

    it("returns false when canEdit is true regardless of formConfig mode", () => {
      component["canEdit"] = true;
      component.setTestFormConfig({ mode: "edit" });

      expect(component["disableEdit"]).toBe(false);
    });
  });

  describe("restricted ciphers", () => {
    beforeEach(() => {
      component.setTestParams({ mode: "view" });
      component["canEdit"] = true;
      component["canDelete"] = true;
    });

    it("editBlockedByRestriction is false for a normal cipher", () => {
      component.setTestCipher({ id: "c1", type: CipherType.Login } as any);

      expect(component["editBlockedByRestriction"]).toBe(false);
    });

    it("editBlockedByRestriction is true when the cipher is restricted", () => {
      component.setTestCipher({ id: "c1", type: CipherType.Login, partial: true } as any);

      expect(component["editBlockedByRestriction"]).toBe(true);
    });

    it("hides Edit for a restricted cipher even when the user could otherwise edit", () => {
      component.setTestCipher({ id: "c1", type: CipherType.Login, partial: true } as any);

      // Saving a restricted cipher would clobber the server-suppressed fields.
      expect(component["showEdit"]).toBe(false);
    });

    it("shows Edit for the same cipher once it is no longer restricted", () => {
      component.setTestCipher({ id: "c1", type: CipherType.Login } as any);

      expect(component["showEdit"]).toBe(true);
    });

    it("shows the footer's Archive buttons but hides Delete for a restricted cipher", () => {
      component.setTestCipher({ id: "c1", type: CipherType.Login, partial: true } as any);

      expect(component["showActionButtons"]).toBe(true);
      expect(component["showDeleteButton"]).toBe(false);
    });

    it("shows Delete for the same cipher once it is no longer restricted", () => {
      component.setTestCipher({ id: "c1", type: CipherType.Login } as any);

      expect(component["showActionButtons"]).toBe(true);
      expect(component["showDeleteButton"]).toBe(true);
    });

    it("falls back to view mode when opened in form mode", async () => {
      jest
        .spyOn(component as any, "getDecryptedCipherView")
        .mockResolvedValue({ id: "c1", type: CipherType.Login, partial: true, collectionIds: [] });
      canEditCipherReturnValue$.next(true);
      component.setTestParams({ mode: "form" });

      await component.ngOnInit();

      expect(component["params"].mode).toBe("view");
      expect(component["loadForm"]).toBe(false);
      canEditCipherReturnValue$.next(false);
    });
  });

  describe("submitButtonText$", () => {
    it("returns 'unArchiveAndSave' when user has no premium and cipher is archived", async () => {
      Object.defineProperty(component, "userHasPremium$", {
        get: () => of(false),
        configurable: true,
      });
      component.setTestCipher({ isArchived: true } as any);

      expect(await firstValueFrom(component["submitButtonText$"])).toBe("unArchiveAndSave");
    });

    it("returns 'save' when cipher is archived and user has premium", async () => {
      Object.defineProperty(component, "userHasPremium$", {
        get: () => of(true),
        configurable: true,
      });
      component.setTestCipher({ isArchived: true } as any);

      expect(await firstValueFrom(component["submitButtonText$"])).toBe("save");
    });

    it("returns 'save' when cipher is not archived", async () => {
      Object.defineProperty(component, "userHasPremium$", {
        get: () => of(false),
        configurable: true,
      });
      component.setTestCipher({ isArchived: false } as any);

      expect(await firstValueFrom(component["submitButtonText$"])).toBe("save");
    });
  });

  describe("archive", () => {
    it("shows a confirmation dialog before archiving", async () => {
      component.setTestCipher({ id: "cipher-id", collectionIds: [] } as any);
      jest.spyOn(component as any, "updateCipherFromResponse").mockResolvedValue(undefined);

      await component.archive();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "archiveItem" },
        content: { key: "archiveItemDialogContent" },
        acceptButtonText: { key: "archiveVerb" },
        type: "info",
      });
    });

    it("calls archiveService.archiveWithServer with the cipher id and active user id", async () => {
      component.setTestCipher({ id: "cipher-id", collectionIds: [] } as any);
      jest.spyOn(component as any, "updateCipherFromResponse").mockResolvedValue(undefined);

      await component.archive();

      expect(mockArchiveService.archiveWithServer).toHaveBeenCalledWith(
        "cipher-id",
        "test-user-id",
      );
    });

    it("does not archive when the user cancels the confirmation", async () => {
      component.setTestCipher({ id: "cipher-id", collectionIds: [] } as any);
      mockDialogService.openSimpleDialog.mockResolvedValueOnce(false);

      await component.archive();

      expect(mockArchiveService.archiveWithServer).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("keeps the dialog open and explains the failure when the server refuses", async () => {
      const toastService = TestBed.inject(ToastService);
      component.setTestCipher({ id: "cipher-id", isDeleted: false, partial: true } as any);
      cipherServiceMock.softDeleteWithServer.mockRejectedValue(new Error("not found"));

      await component.delete();

      expect(close).not.toHaveBeenCalled();
      expect(TestBed.inject(MessagingService).send).not.toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "restrictedItemChangeRefused" }),
      );
      expect(toastService.showToast).not.toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("closes as Deleted and reports success when the delete lands", async () => {
      const toastService = TestBed.inject(ToastService);
      component.setTestCipher({ id: "cipher-id", isDeleted: false } as any);
      cipherServiceMock.softDeleteWithServer.mockResolvedValue(undefined);

      await component.delete();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "deletedItem" }),
      );
      expect(TestBed.inject(MessagingService).send).toHaveBeenCalledWith("deletedCipher");
      expect(close).toHaveBeenCalledWith(VaultItemDialogResult.Deleted);
    });
  });

  describe("unarchive", () => {
    it("calls archiveService.unarchiveWithServer with the cipher id and active user id", async () => {
      component.setTestCipher({ id: "cipher-id", collectionIds: [] } as any);
      jest.spyOn(component as any, "updateCipherFromResponse").mockResolvedValue(undefined);

      await component.unarchive();

      expect(mockArchiveService.unarchiveWithServer).toHaveBeenCalledWith(
        "cipher-id",
        "test-user-id",
      );
    });
  });

  describe("showArchiveOptions", () => {
    it("returns true when archive flag enabled, not admin console, and mode is view", () => {
      (component as any)["archiveFlagEnabled"] = () => true;
      component.setTestParams({ isAdminConsoleAction: false, mode: "view" });

      expect(component["showArchiveOptions"]).toBe(true);
    });

    it("returns false when isAdminConsoleAction is true", () => {
      (component as any)["archiveFlagEnabled"] = () => true;
      component.setTestParams({ isAdminConsoleAction: true, mode: "view" });

      expect(component["showArchiveOptions"]).toBe(false);
    });

    it("returns false when mode is not view", () => {
      (component as any)["archiveFlagEnabled"] = () => true;
      component.setTestParams({ isAdminConsoleAction: false, mode: "form" });

      expect(component["showArchiveOptions"]).toBe(false);
    });
  });

  describe("showArchiveBtn", () => {
    it("returns true when user can archive and cipher canBeArchived", () => {
      (component as any)["userCanArchive"] = () => true;
      component.setTestCipher({ canBeArchived: true } as any);

      expect(component["showArchiveBtn"]).toBe(true);
    });

    it("returns false when user cannot archive", () => {
      (component as any)["userCanArchive"] = () => false;
      component.setTestCipher({ canBeArchived: true } as any);

      expect(component["showArchiveBtn"]).toBe(false);
    });

    it("returns false when cipher cannot be archived", () => {
      (component as any)["userCanArchive"] = () => true;
      component.setTestCipher({ canBeArchived: false } as any);

      expect(component["showArchiveBtn"]).toBe(false);
    });
  });

  describe("showUnarchiveBtn", () => {
    it("returns true when cipher is archived and not deleted", () => {
      component.setTestCipher({ isArchived: true, isDeleted: false } as any);

      expect(component["showUnarchiveBtn"]).toBe(true);
    });

    it("returns false when cipher is not archived", () => {
      component.setTestCipher({ isArchived: false, isDeleted: false } as any);

      expect(component["showUnarchiveBtn"]).toBe(false);
    });

    it("returns false when cipher is archived but deleted", () => {
      component.setTestCipher({ isArchived: true, isDeleted: true } as any);

      expect(component["showUnarchiveBtn"]).toBe(false);
    });
  });

  describe("changeMode", () => {
    beforeEach(() => {
      component.setTestCipher({ type: CipherType.Login, id: "cipher-id" } as any);
      component.mockViewChildren();
    });

    it("refocuses the dialog header", async () => {
      const focusHeader = jest.fn();
      Object.defineProperty(component, "dialogComponent", {
        value: () => ({ focusHeader }),
        configurable: true,
      });

      await component["changeMode"]("view");

      expect(focusHeader).toHaveBeenCalled();
    });

    describe("to view", () => {
      beforeEach(() => {
        component.setTestParams({ mode: "form" });
      });

      it("sets params.mode to view", async () => {
        await component["changeMode"]("view");

        expect(component["params"].mode).toBe("view");
      });

      it("updates the url with action: view", async () => {
        await component["changeMode"]("view");

        expect(mockRouter.navigate).toHaveBeenCalledWith([], {
          queryParams: { action: "view", itemId: "cipher-id" },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      });
    });

    describe("to form", () => {
      beforeEach(() => {
        component.setTestParams({ mode: "view" });
      });

      it("sets loadForm to true and waits for form ready before setting mode", async () => {
        const changeModePromise = component["changeMode"]("form");

        expect(component["loadForm"]).toBe(true);

        component.triggerFormReady();
        await changeModePromise;

        expect(component["params"].mode).toBe("form");
      });

      it("updates the url with action: edit", async () => {
        const changeModePromise = component["changeMode"]("form");
        component.triggerFormReady();
        await changeModePromise;

        expect(mockRouter.navigate).toHaveBeenCalledWith([], {
          queryParams: { action: "edit", itemId: "cipher-id" },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      });
    });
  });

  describe("cancel", () => {
    it("closes the dialog with undefined when unmodified", async () => {
      await component.cancel();

      expect(close).toHaveBeenCalledWith(undefined);
    });

    it("closes the dialog with Saved when cipher was modified", async () => {
      component["_cipherModified"] = true;

      await component.cancel();

      expect(close).toHaveBeenCalledWith(VaultItemDialogResult.Saved);
    });

    describe("from form mode", () => {
      beforeEach(() => {
        component.setTestCipher({ id: "cipher-id", collectionIds: [] } as any);
        component.setTestParams({ mode: "form" });
        component.setTestFormConfig({ mode: "edit" });
        jest.spyOn(component as any, "changeMode").mockResolvedValue(undefined);
      });

      it("refreshes the cipher from local state and switches to view mode", async () => {
        const storedCipher = { id: "cipher-id" } as unknown as Cipher;
        const refreshedCipherView = { id: "cipher-id", attachments: [] } as any;
        cipherServiceMock.get.mockResolvedValue(storedCipher);
        cipherServiceMock.decrypt.mockResolvedValue(refreshedCipherView);

        await component.cancel();

        expect(cipherServiceMock.get).toHaveBeenCalledWith("cipher-id", "test-user-id");
        expect(component["cipher"]).toBe(refreshedCipherView);
        expect(component["formConfig"].originalCipher).toBe(storedCipher);
        expect((component as any).changeMode).toHaveBeenCalledWith("view");
      });

      it("leaves the existing cipher in place when local state has no cipher", async () => {
        const originalCipher = component["cipher"];
        cipherServiceMock.get.mockResolvedValue(null);

        await component.cancel();

        expect(component["cipher"]).toBe(originalCipher);
        expect((component as any).changeMode).toHaveBeenCalledWith("view");
      });

      it("switches to view mode after a failed save left the decrypted cache empty", async () => {
        // A failed save clears the cache, and cipherView$ then never emits.
        cipherServiceMock.cipherView$.mockReturnValue(NEVER);
        cipherServiceMock.get.mockResolvedValue({ id: "cipher-id" } as unknown as Cipher);
        cipherServiceMock.decrypt.mockResolvedValue({ id: "cipher-id" } as any);

        await component.cancel();

        expect((component as any).changeMode).toHaveBeenCalledWith("view");
      });

      it("does not refresh and closes the dialog when formConfig mode is clone", async () => {
        component.setTestFormConfig({ mode: "clone" });

        await component.cancel();

        expect(cipherServiceMock.get).not.toHaveBeenCalled();
        expect((component as any).changeMode).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledWith(undefined);
      });
    });

    it("does not refresh the cipher when in view mode", async () => {
      component.setTestCipher({ id: "cipher-id" } as any);
      component.setTestParams({ mode: "view" });

      await component.cancel();

      expect(cipherServiceMock.get).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledWith(undefined);
    });
  });

  describe("static open()", () => {
    it("calls dialogService.open with VaultItemDialogComponent", () => {
      const fakeDialogService = { open: jest.fn() } as any;

      VaultItemDialogComponent.open(fakeDialogService, baseParams);

      expect(fakeDialogService.open).toHaveBeenCalledWith(VaultItemDialogComponent, {
        data: baseParams,
      });
    });
  });

  describe("static openDrawer()", () => {
    it("calls dialogService.openDrawer with VaultItemDialogComponent", async () => {
      const fakeDialogService = { openDrawer: jest.fn() } as any;

      await VaultItemDialogComponent.openDrawer(fakeDialogService, baseParams);

      expect(fakeDialogService.openDrawer).toHaveBeenCalledWith(VaultItemDialogComponent, {
        data: baseParams,
      });
    });
  });

  describe("onCipherSaved", () => {
    beforeEach(() => {
      // Spy on changeMode to avoid needing DOM dependencies in these tests
      jest.spyOn(component as any, "changeMode").mockResolvedValue(undefined);
    });

    it("updates canEdit based on the saved cipher after creating a new item", async () => {
      (component as any)._originalFormMode = "add";

      const savedCipherView = { id: "new-cipher-id", collectionIds: [] } as any;

      canEditCipherReturnValue$.next(true);

      await component["onCipherSaved"](savedCipherView);

      expect(component["canEdit"]).toBe(true);
      expect(cipherAuthorizationServiceMock.canEditCipher$).toHaveBeenCalledWith(
        savedCipherView,
        component["params"].isAdminConsoleAction,
      );
    });

    it("updates canDelete based on the saved cipher after creating a new item", async () => {
      (component as any)._originalFormMode = "add";

      const savedCipherView = { id: "new-cipher-id", collectionIds: [] } as any;

      canDeleteCipherReturnValue$.next(true);

      await component["onCipherSaved"](savedCipherView);

      expect(component["canDelete"]).toBe(true);
      expect(cipherAuthorizationServiceMock.canDeleteCipher$).toHaveBeenCalledWith(
        savedCipherView,
        component["params"].isAdminConsoleAction,
      );
    });
  });

  describe("openAttachmentsDialog", () => {
    it("decrypts the admin cipher through the cipher service after an upload", async () => {
      const billingService = TestBed.inject(BillingAccountProfileStateService);
      jest.mocked(billingService.hasPremiumFromAnySource$).mockReturnValue(of(true));
      mockDialogService.open.mockReturnValue({
        closed: of({ action: AttachmentDialogResult.Uploaded }),
      });
      const apiService = TestBed.inject(ApiService) as MockProxy<ApiService>;
      apiService.getCipherAdmin.mockResolvedValue({ id: "cipher-id" } as any);
      cipherServiceMock.decrypt.mockResolvedValue(new CipherView());
      Object.defineProperty(component, "cipherFormComponent", {
        value: () => ({ patchCipher: jest.fn() }),
        configurable: true,
      });
      component.setTestFormConfig({ admin: true, originalCipher: { id: "cipher-id" } as any });

      await component.openAttachmentsDialog();

      expect(cipherServiceMock.decrypt).toHaveBeenCalledWith(expect.any(Cipher), "test-user-id");
    });
  });

  describe("revealed views (RevealedCipherService)", () => {
    /** The restricted copy local state holds. */
    const storedCipher = { id: "gated-1", partialData: '{"name":"gated"}' } as unknown as Cipher;
    const storedView = { id: "gated-1", partial: true, collectionIds: [] } as unknown as CipherView;
    const revealedView = {
      id: "gated-1",
      partial: false,
      collectionIds: [],
    } as unknown as CipherView;
    let display$: BehaviorSubject<CipherView>;

    /** Flush the `displayView$` handler, which awaits the permission reads. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    /** Opens the dialog on the restricted cipher, revealed at open or not. */
    async function open(
      options: { revealedAtOpen?: boolean; mode?: "view" | "form" } = {},
    ): Promise<void> {
      const { revealedAtOpen = false, mode = "view" } = options;
      jest.spyOn(component as any, "getDecryptedCipherView").mockResolvedValue(storedView);
      revealedCipherServiceMock.getOrReveal.mockResolvedValue(revealedAtOpen ? revealedView : null);
      display$ = new BehaviorSubject(revealedAtOpen ? revealedView : storedView);
      revealedCipherServiceMock.displayView$.mockReturnValue(display$);
      component.setTestParams({ mode });
      component.setTestFormConfig({ originalCipher: storedCipher });
      component["loadForm"] = mode === "form";

      await component.ngOnInit();
      await settle();
    }

    afterEach(() => {
      canEditCipherReturnValue$.next(false);
      canDeleteCipherReturnValue$.next(false);
    });

    it("shows the stored view while nothing is revealed", async () => {
      await open();

      expect(revealedCipherServiceMock.displayView$).toHaveBeenCalledWith(
        "test-user-id",
        storedView,
      );
      expect(component["cipher"]).toBe(storedView);
      expect(component["showEdit"]).toBe(false);
      expect(component["formConfig"].originalCipher).toBe(storedCipher);
    });

    it("shows the revealed view and re-reads permissions when a reveal begins", async () => {
      await open();
      canEditCipherReturnValue$.next(true);

      display$.next(revealedView);
      await settle();

      expect(component["cipher"]).toBe(revealedView);
      expect(component["canEdit"]).toBe(true);
      expect(component["showEdit"]).toBe(true);
      expect(cipherAuthorizationServiceMock.canEditCipher$).toHaveBeenCalledWith(
        revealedView,
        false,
      );
      // Delete stays blocked for a revealed cipher.
      expect(component["showDeleteButton"]).toBe(false);
      // The form reads the revealed view through the form service, never from `originalCipher`.
      expect(component["formConfig"].originalCipher).toBe(storedCipher);
    });

    it("opens an edit on the revealed view", async () => {
      canEditCipherReturnValue$.next(true);

      await open({ revealedAtOpen: true, mode: "form" });

      expect(revealedCipherServiceMock.getOrReveal).toHaveBeenCalledWith("test-user-id", "gated-1");
      expect(component["cipher"]).toBe(revealedView);
      expect(component["params"].mode).toBe("form");
    });

    it("falls back to the stored view and leaves form mode when the reveal ends", async () => {
      canEditCipherReturnValue$.next(true);
      await open({ revealedAtOpen: true, mode: "form" });

      display$.next(storedView);
      await settle();

      expect(component["cipher"]).toBe(storedView);
      // The form's own state still holds the full view, so it must not stay mounted.
      expect(component["loadForm"]).toBe(false);
      expect(component["params"].mode).toBe("view");
      expect(component["canEdit"]).toBe(false);
      expect(component["canDelete"]).toBe(false);
      expect(component["formConfig"].originalCipher).toBe(storedCipher);
    });

    describe("returning to view mode after a save", () => {
      beforeEach(() => {
        jest.spyOn(component as any, "changeMode").mockResolvedValue(undefined);
        cipherServiceMock.get.mockResolvedValue(storedCipher);
        cipherServiceMock.decrypt.mockResolvedValue(storedView);
      });

      /** The restricted result `CipherService` returns for a restricted cipher's save. */
      const saveResult = {
        id: "gated-1",
        partial: true,
        collectionIds: [],
      } as unknown as CipherView;

      it("shows the saved cipher revealed again rather than the save's restricted result", async () => {
        await open({ revealedAtOpen: true });
        const refreshedView = { ...revealedView } as CipherView;
        revealedCipherServiceMock.refresh.mockImplementation(async () =>
          display$.next(refreshedView),
        );

        await component["onCipherSaved"](saveResult);

        expect(revealedCipherServiceMock.refresh).toHaveBeenCalledWith("test-user-id", "gated-1");
        expect(component["cipher"]).toBe(refreshedView);
        expect(component["formConfig"].originalCipher).toBe(storedCipher);
      });

      it("waits for the refreshed view before returning to view mode", async () => {
        await open({ revealedAtOpen: true });
        const refreshedView = { ...revealedView } as CipherView;
        revealedCipherServiceMock.refresh.mockImplementation(async () =>
          display$.next(refreshedView),
        );
        let shownOnViewMode: CipherView | undefined;
        jest.spyOn(component as any, "changeMode").mockImplementation(async () => {
          shownOnViewMode = component["cipher"];
        });

        await component["onCipherSaved"](saveResult);

        expect(shownOnViewMode).toBe(refreshedView);
      });

      it("keeps the revealed view when the refresh delivers nothing new", async () => {
        await open({ revealedAtOpen: true });

        await component["onCipherSaved"](saveResult);

        expect(component["cipher"]).toBe(revealedView);
      });

      it("falls back to the saved stored copy when the reveal ended before the refresh", async () => {
        canEditCipherReturnValue$.next(true);
        await open({ revealedAtOpen: true });
        const savedStoredView = { ...storedView, name: "saved" } as unknown as CipherView;
        cipherServiceMock.decrypt.mockResolvedValue(savedStoredView);
        revealedCipherServiceMock.refresh.mockImplementation(async () => display$.next(storedView));

        await expect(component["onCipherSaved"](saveResult)).resolves.toBeUndefined();

        expect(cipherServiceMock.decrypt).toHaveBeenCalledWith(storedCipher, "test-user-id");
        expect(component["cipher"]).toBe(savedStoredView);
        expect(component["loadForm"]).toBe(false);
        expect(component["canEdit"]).toBe(false);
        // The save itself landed, so the dialog must still report the item as modified.
        expect(component["_cipherModified"]).toBe(true);
      });
    });

    describe("cancelling an edit", () => {
      it("keeps the displayed view without reading local state", async () => {
        canEditCipherReturnValue$.next(true);
        await open({ revealedAtOpen: true, mode: "form" });
        jest.spyOn(component as any, "changeMode").mockResolvedValue(undefined);

        await component.cancel();

        expect(cipherServiceMock.cipherView$).not.toHaveBeenCalled();
        expect(revealedCipherServiceMock.get).not.toHaveBeenCalled();
        expect(component["cipher"]).toBe(revealedView);
        expect((component as any).changeMode).toHaveBeenCalledWith("view");
      });
    });

    describe("refreshing the form after an attachment change", () => {
      const reloadedView = {
        id: "gated-1",
        attachments: [{ id: "attachment-1" }],
        revisionDate: new Date("2026-09-04T10:30:59.000Z"),
      } as unknown as CipherView;
      let patchCipher: jest.Mock;

      beforeEach(async () => {
        await open({ revealedAtOpen: true });
        (
          TestBed.inject(BillingAccountProfileStateService)
            .hasPremiumFromAnySource$ as unknown as jest.Mock
        ).mockReturnValue(of(true));
        mockDialogService.open.mockReturnValue({
          closed: of({ action: AttachmentDialogResult.Uploaded }),
        });
        patchCipher = jest.fn();
        component.mockCipherFormComponent(patchCipher);
      });

      it("patches attachments and revision date from the refreshed revealed view", async () => {
        revealedCipherServiceMock.get.mockReturnValue(reloadedView);

        await component["openAttachmentsDialog"]();

        expect(revealedCipherServiceMock.refresh).toHaveBeenCalledWith("test-user-id", "gated-1");
        // Local state holds only the restricted, pre-upload copy.
        expect(cipherServiceMock.cipherView$).not.toHaveBeenCalled();
        const currentCipher = {
          attachments: [],
          revisionDate: new Date(0),
        } as unknown as CipherView;
        patchCipher.mock.calls[0][0](currentCipher);
        expect(currentCipher.attachments).toBe(reloadedView.attachments);
        expect(currentCipher.revisionDate).toBe(reloadedView.revisionDate);
      });

      it("leaves the form alone, without throwing, when the reveal ended", async () => {
        revealedCipherServiceMock.get.mockReturnValue(undefined);

        await expect(component["openAttachmentsDialog"]()).resolves.toBeUndefined();

        expect(patchCipher).not.toHaveBeenCalled();
        // The attachment was still uploaded, so the dialog must still report the item as modified.
        expect(component["_cipherModified"]).toBe(true);
      });
    });
  });

  describe("syncing with local state", () => {
    const storedCipher = { id: "cipher-1" } as unknown as Cipher;
    const openedView = {
      id: "cipher-1",
      name: "opened",
      collectionIds: [],
      edit: true,
      viewPassword: true,
      revisionDate: new Date("2026-10-01T00:00:00.000Z"),
    } as unknown as CipherView;
    let localView$: BehaviorSubject<CipherView | undefined>;

    /** Flush the handler, which awaits local state and permission reads. */
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

    async function open(options: Partial<CipherFormConfig> = {}): Promise<void> {
      jest.spyOn(component as any, "getDecryptedCipherView").mockResolvedValue(openedView);
      localView$ = new BehaviorSubject<CipherView | undefined>(openedView);
      cipherServiceMock.cipherView$.mockReturnValue(localView$);
      cipherServiceMock.get.mockResolvedValue(storedCipher);
      component.setTestParams({ mode: "view" });
      component.setTestFormConfig({ originalCipher: storedCipher, ...options });

      await component.ngOnInit();
      await settle();
    }

    afterEach(() => {
      canEditCipherReturnValue$.next(false);
      canDeleteCipherReturnValue$.next(false);
    });

    it("shows a newer revision from a background sync", async () => {
      await open();
      const syncedCipher = { id: "cipher-1", name: "synced" } as unknown as Cipher;
      cipherServiceMock.get.mockResolvedValue(syncedCipher);
      canEditCipherReturnValue$.next(true);
      canDeleteCipherReturnValue$.next(true);
      const syncedView = {
        ...openedView,
        name: "synced",
        revisionDate: new Date("2026-10-02T00:00:00.000Z"),
      } as unknown as CipherView;

      localView$.next(syncedView);
      await settle();

      expect(cipherServiceMock.cipherView$).toHaveBeenCalledWith("test-user-id", "cipher-1");
      expect(component["cipher"]).toBe(syncedView);
      expect(component["formConfig"].originalCipher).toBe(syncedCipher);
      expect(component["canEdit"]).toBe(true);
      expect(component["canDelete"]).toBe(true);
    });

    it("shows a permission change that leaves the revision date alone", async () => {
      await open();
      const syncedView = { ...openedView, edit: false } as unknown as CipherView;

      localView$.next(syncedView);
      await settle();

      expect(component["cipher"]).toBe(syncedView);
    });

    it("ignores an emission with nothing new", async () => {
      await open();

      localView$.next({ ...openedView } as unknown as CipherView);
      await settle();

      expect(component["cipher"]).toBe(openedView);
    });

    it("leaves an open form alone", async () => {
      await open();
      component.setTestParams({ mode: "form" });
      component["loadForm"] = true;

      localView$.next({
        ...openedView,
        revisionDate: new Date("2026-10-02T00:00:00.000Z"),
      } as unknown as CipherView);
      await settle();

      expect(component["cipher"]).toBe(openedView);
      expect(component["formConfig"].originalCipher).toBe(storedCipher);
    });

    it("closes as Deleted when the cipher is deleted elsewhere", async () => {
      await open();
      component["_cipherModified"] = true;
      cipherServiceMock.get.mockResolvedValue(null);

      localView$.next(undefined);
      await settle();

      expect(close).toHaveBeenCalledWith(VaultItemDialogResult.Deleted);
      expect(component["_cipherModified"]).toBe(false);
    });

    it("stays open when the cipher left the decrypted views but is still stored", async () => {
      await open();

      localView$.next(undefined);
      await settle();

      expect(close).not.toHaveBeenCalled();
    });

    it("leaves closing to the dialog's own delete", async () => {
      await open();
      cipherServiceMock.get.mockResolvedValue(null);
      cipherServiceMock.softDeleteWithServer.mockImplementation(async () => {
        localView$.next(undefined);
        await settle();
      });

      await component.delete();

      expect(close).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledWith(VaultItemDialogResult.Deleted);
    });

    it("does not follow local state in the admin console", async () => {
      await open({ isAdminConsole: true });

      expect(cipherServiceMock.cipherView$).not.toHaveBeenCalled();
    });

    it("follows a newly created cipher once it is saved", async () => {
      jest.spyOn(component as any, "changeMode").mockResolvedValue(undefined);
      cipherServiceMock.cipherView$.mockReturnValue(new BehaviorSubject(undefined));
      cipherServiceMock.get.mockResolvedValue(storedCipher);
      (component as any)._originalFormMode = "add";

      await component["onCipherSaved"](openedView);

      expect(cipherServiceMock.cipherView$).toHaveBeenCalledWith("test-user-id", "cipher-1");
    });
  });
});

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
import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs/abstractions/event-collection.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { CipherFormConfig } from "../cipher-form";

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
    cipherAuthorizationServiceMock = mock<CipherAuthorizationService>({
      canEditCipher$: jest.fn().mockReturnValue(canEditCipherReturnValue$),
      canDeleteCipher$: jest.fn().mockReturnValue(canDeleteCipherReturnValue$),
    });

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

      expect(component["title"]).toBe("viewItemHeaderLogin");
    });

    it("sets title for form mode (edit) and Card type", () => {
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ mode: "edit", cipherType: CipherType.Card });
      component["updateTitle"]();

      expect(component["title"]).toBe("editItemHeaderCard");
    });

    it("sets title for form mode (add) and Identity type", () => {
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ mode: "add", cipherType: CipherType.Identity });
      component["updateTitle"]();

      expect(component["title"]).toBe("newItemHeaderIdentity");
    });

    it("sets title for form mode (clone) and Card type", () => {
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ mode: "clone", cipherType: CipherType.Card });
      component["updateTitle"]();

      expect(component["title"]).toBe("newItemHeaderCard");
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
});

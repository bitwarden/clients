import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherRiskService } from "@bitwarden/common/vault/abstractions/cipher-risk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";
import { RoutedVaultFilterService } from "@bitwarden/vault";

import { VaultItemDialogComponent } from "./vault-item-dialog.component";

// Create a test subclass to more easily access protected members
class TestVaultItemDialogComponent extends VaultItemDialogComponent {
  getTestTitle() {
    this["updateTitle"]();
    return this.title;
  }
  setTestParams(params: any) {
    this.params = params;
  }
  setTestCipher(cipher: any) {
    this.cipher = {
      ...cipher,
      login: {
        uris: [],
      },
      card: {},
    };
  }
  setTestFormConfig(formConfig: any) {
    this.formConfig = formConfig;
  }
}

describe("VaultItemDialogComponent", () => {
  let fixture: ComponentFixture<TestVaultItemDialogComponent>;
  let component: TestVaultItemDialogComponent;

  const baseFormConfig = {
    mode: "edit",
    cipherType: CipherType.Login,
    collections: [],
    organizations: [],
    admin: false,
    organizationDataOwnershipDisabled: false,
    folders: [],
  };

  const baseParams = {
    mode: "view",
    formConfig: { ...baseFormConfig },
    disableForm: false,
    activeCollectionId: undefined,
    isAdminConsoleAction: false,
    restore: undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestVaultItemDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: DIALOG_DATA, useValue: { ...baseParams } },
        { provide: DialogRef, useValue: {} },
        { provide: DialogService, useValue: {} },
        {
          provide: ToastService,
          useValue: {
            showToast: () => {},
          },
        },
        { provide: MessagingService, useValue: {} },
        { provide: LogService, useValue: {} },
        { provide: CipherService, useValue: {} },
        { provide: AccountService, useValue: { activeAccount$: of({ id: "UserId" }) } },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag: () => Promise.resolve(false),
            getFeatureFlag$: () => of(false),
          },
        },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: {} },
        {
          provide: BillingAccountProfileStateService,
          useValue: { hasPremiumFromAnySource$: () => ({}) },
        },
        { provide: PremiumUpgradePromptService, useValue: {} },
        { provide: CipherAuthorizationService, useValue: {} },
        { provide: ApiService, useValue: {} },
        { provide: EventCollectionService, useValue: {} },
        { provide: RoutedVaultFilterService, useValue: {} },
        {
          provide: CipherArchiveService,
          useValue: {
            userCanArchive$: jest.fn().mockReturnValue(of(true)),
            hasArchiveFlagEnabled$: of(true),
            archiveWithServer: jest.fn().mockResolvedValue({}),
            unarchiveWithServer: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: OrganizationService,
          useValue: mock<OrganizationService>(),
        },
        {
          provide: CollectionService,
          useValue: mock<CollectionService>(),
        },
        {
          provide: FolderService,
          useValue: mock<FolderService>(),
        },
        {
          provide: TaskService,
          useValue: mock<TaskService>(),
        },
        {
          provide: ApiService,
          useValue: mock<ApiService>(),
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({
              getIconsUrl: () => "https://example.com",
            }),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: {
            showFavicons$: of(true),
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: {
            hasPremiumFromAnySource$: jest.fn().mockReturnValue(of(false)),
          },
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            getClientType: jest.fn().mockReturnValue("Web"),
          },
        },
        { provide: SyncService, useValue: {} },
        { provide: CipherRiskService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestVaultItemDialogComponent);
    component = fixture.componentInstance;
    Object.defineProperty(component, "userHasPremium$", {
      get: () => of(false),
      configurable: true,
    });
    fixture.detectChanges();
  });

  describe("dialog title", () => {
    it("sets title for view mode and Login type", () => {
      component.setTestCipher({ type: CipherType.Login });
      component.setTestParams({ mode: "view" });
      component.setTestFormConfig({ ...baseFormConfig, cipherType: CipherType.Login });
      expect(component.getTestTitle()).toBe("viewItemHeaderLogin");
    });

    it("sets title for form mode (edit) and Card type", () => {
      component.setTestCipher(undefined);
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({ ...baseFormConfig, mode: "edit", cipherType: CipherType.Card });
      expect(component.getTestTitle()).toBe("editItemHeaderCard");
    });

    it("sets title for form mode (add) and Identity type", () => {
      component.setTestCipher(undefined);
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({
        ...baseFormConfig,
        mode: "add",
        cipherType: CipherType.Identity,
      });
      expect(component.getTestTitle()).toBe("newItemHeaderIdentity");
    });

    it("sets title for form mode (clone) and Card type", () => {
      component.setTestCipher(undefined);
      component.setTestParams({ mode: "form" });
      component.setTestFormConfig({
        ...baseFormConfig,
        mode: "clone",
        cipherType: CipherType.Card,
      });
      expect(component.getTestTitle()).toBe("newItemHeaderCard");
    });
  });

  describe("archive", () => {
    it("calls archiveService to archive the cipher", async () => {
      const archiveService = TestBed.inject(CipherArchiveService);
      component.setTestCipher({ id: "111-222-333-4444" });
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();

      await component.archive();

      expect(archiveService.archiveWithServer).toHaveBeenCalledWith("111-222-333-4444", "UserId");
    });
  });

  describe("unarchive", () => {
    it("calls archiveService to unarchive the cipher", async () => {
      const archiveService = TestBed.inject(CipherArchiveService);
      component.setTestCipher({ id: "111-222-333-4444" });
      component.setTestParams({ mode: "form" });
      fixture.detectChanges();

      await component.unarchive();

      expect(archiveService.unarchiveWithServer).toHaveBeenCalledWith("111-222-333-4444", "UserId");
    });
  });

  describe("archive button", () => {
    it("should not show archive button in admin console", () => {
      (component as any).userCanArchive$ = of(true);
      component.setTestCipher({ canBeArchived: true });
      component.setTestParams({ mode: "form", isAdminConsoleAction: true });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeFalsy();
    });

    it("should show archive button when the user can archive the item, item can be archived, and dialog is in view mode", () => {
      component.setTestCipher({ canBeArchived: true });
      (component as any).userCanArchive$ = of(true);
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeTruthy();
    });

    it("should not show archive button when the user does not have premium", () => {
      (component as any).userCanArchive$ = of(false);
      component.setTestCipher({});
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeFalsy();
    });

    it("should not show archive button when the item cannot be archived", () => {
      component.setTestCipher({ canBeArchived: false });
      component.setTestParams({ mode: "form" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeFalsy();
    });

    it("should not show archive button when dialog is not in view mode", () => {
      component.setTestCipher({ canBeArchived: true });
      (component as any).userCanArchive$ = of(true);
      component.setTestParams({ mode: "form" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeFalsy();
    });
  });

  describe("unarchive button", () => {
    it("should show the unarchive button when the item is archived, and dialog in view mode", () => {
      component.setTestCipher({ isArchived: true });
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const unarchiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-unarchive']"));
      expect(unarchiveButton).toBeTruthy();
    });

    it("should not show the unarchive button when the item is not archived", () => {
      component.setTestCipher({ isArchived: false });
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const unarchiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-unarchive']"));
      expect(unarchiveButton).toBeFalsy();
    });

    it("should not show the unarchive button when dialog is not in view mode", () => {
      component.setTestCipher({ isArchived: false });
      component.setTestParams({ mode: "form" });
      fixture.detectChanges();
      const unarchiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-unarchive']"));
      expect(unarchiveButton).toBeFalsy();
    });
  });

  describe("archive badge", () => {
    it('should show "archived" badge when the item is archived and not an admin console action', () => {
      component.setTestCipher({ isArchived: true });
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const archivedBadge = fixture.debugElement.query(By.css("span[bitBadge]"));
      expect(archivedBadge).toBeTruthy();
      expect(archivedBadge.nativeElement.textContent.trim()).toBe("archived");
    });

    it('should not show "archived" badge when the item is archived and is an admin console action', () => {
      component.setTestCipher({ isArchived: true });
      component.setTestParams({ mode: "view", isAdminConsoleAction: true });
      fixture.detectChanges();
      const archivedBadge = fixture.debugElement.query(By.css("span[bitBadge]"));
      expect(archivedBadge).toBeFalsy();
    });
  });

  describe("submitButtonText$", () => {
    it("should return 'unArchiveAndSave' when premium is false and cipher is archived", (done) => {
      jest.spyOn(component as any, "userHasPremium$", "get").mockReturnValue(of(false));
      component.setTestCipher({ isArchived: true });
      fixture.detectChanges();

      component["submitButtonText$"].subscribe((text) => {
        expect(text).toBe("unArchiveAndSave");
        done();
      });
    });

    it("should return 'save' when cipher is archived and user has premium", (done) => {
      jest.spyOn(component as any, "userHasPremium$", "get").mockReturnValue(of(true));
      component.setTestCipher({ isArchived: true });
      fixture.detectChanges();

      component["submitButtonText$"].subscribe((text) => {
        expect(text).toBe("save");
        done();
      });
    });

    it("should return 'save' when cipher is not archived", (done) => {
      jest.spyOn(component as any, "userHasPremium$", "get").mockReturnValue(of(false));
      component.setTestCipher({ isArchived: false });
      fixture.detectChanges();

      component["submitButtonText$"].subscribe((text) => {
        expect(text).toBe("save");
        done();
      });
    });
  });

  describe("disableEdit", () => {
    it("returns false when formConfig mode is partial-edit even if canEdit is false", () => {
      component["canEdit"] = false;
      component.setTestFormConfig({ ...baseFormConfig, mode: "partial-edit" });

      expect(component["disableEdit"]).toBe(false);
    });

    it("returns true when canEdit is false and formConfig mode is not partial-edit", () => {
      component["canEdit"] = false;
      component.setTestFormConfig({ ...baseFormConfig, mode: "edit" });

      expect(component["disableEdit"]).toBe(true);
    });

    it("returns false when canEdit is true regardless of formConfig mode", () => {
      component["canEdit"] = true;
      component.setTestFormConfig({ ...baseFormConfig, mode: "edit" });

      expect(component["disableEdit"]).toBe(false);
    });
  });

  describe("changeMode", () => {
    beforeEach(() => {
      component.setTestCipher({ type: CipherType.Login, id: "cipher-id" });
    });

    it("refocuses the dialog header", async () => {
      const focusOnHeaderSpy = jest.spyOn(component["dialogComponent"](), "handleAutofocus");

      await component["changeMode"]("view");

      expect(focusOnHeaderSpy).toHaveBeenCalled();
    });

    describe("to view", () => {
      beforeEach(() => {
        component.setTestParams({ mode: "form" });
        fixture.detectChanges();
      });

      it("sets mode to view", async () => {
        await component["changeMode"]("view");

        expect(component["params"].mode).toBe("view");
      });

      it("updates the url", async () => {
        const router = TestBed.inject(Router);

        await component["changeMode"]("view");

        expect(router.navigate).toHaveBeenCalledWith([], {
          queryParams: { action: "view", itemId: "cipher-id" },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      });
    });

    describe("to form", () => {
      const waitForFormReady = async () => {
        const changeModePromise = component["changeMode"]("form");

        expect(component["loadForm"]).toBe(true);

        component["onFormReady"]();
        await changeModePromise;
      };

      beforeEach(() => {
        component.setTestParams({ mode: "view" });
        fixture.detectChanges();
      });

      it("waits for form to be ready when switching to form mode", async () => {
        await waitForFormReady();

        expect(component["params"].mode).toBe("form");
      });

      it("updates the url", async () => {
        const router = TestBed.inject(Router);
        await waitForFormReady();

        expect(router.navigate).toHaveBeenCalledWith([], {
          queryParams: { action: "edit", itemId: "cipher-id" },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      });
    });
  });
});

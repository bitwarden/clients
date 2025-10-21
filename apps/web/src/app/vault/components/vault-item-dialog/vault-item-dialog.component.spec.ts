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
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { TaskService } from "@bitwarden/common/vault/tasks";
import { DialogRef, DIALOG_DATA, DialogService, ToastService } from "@bitwarden/components";

import { RoutedVaultFilterService } from "../../individual-vault/vault-filter/services/routed-vault-filter.service";

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
        { provide: ToastService, useValue: {} },
        { provide: MessagingService, useValue: {} },
        { provide: LogService, useValue: {} },
        { provide: CipherService, useValue: {} },
        { provide: AccountService, useValue: { activeAccount$: of({}) } },
        { provide: Router, useValue: {} },
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
            hasArchiveFlagEnabled$: jest.fn().mockReturnValue(of(true)),
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
          useValue: mock<PlatformUtilsService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestVaultItemDialogComponent);
    component = fixture.componentInstance;
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

  describe("archive button", () => {
    it("should show archive button when the user can archive the item and the item can be archived", () => {
      component.setTestCipher({ canBeArchived: true });
      (component as any).userCanArchive$ = of(true);
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeTruthy();
    });

    it("should not show archive button when the user cannot archive the item", () => {
      (component as any).userCanArchive$ = of(false);
      component.setTestCipher({});
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeFalsy();
    });

    it("should not show archive button when the item cannot be archived", () => {
      component.setTestCipher({ canBeArchived: false });
      component.setTestParams({ mode: "view" });
      fixture.detectChanges();
      const archiveButton = fixture.debugElement.query(By.css("[biticonbutton='bwi-archive']"));
      expect(archiveButton).toBeFalsy();
    });
  });

  describe("unarchive button", () => {
    it("should show the unarchive button when the item is archived", () => {
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
  });
});

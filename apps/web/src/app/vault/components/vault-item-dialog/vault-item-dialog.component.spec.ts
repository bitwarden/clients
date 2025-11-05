import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { ActivatedRoute, Router } from "@angular/router";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
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
    this.cipher = cipher;
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
        { provide: AccountService, useValue: { activeAccount$: { pipe: () => ({}) } } },
        { provide: ConfigService, useValue: { getFeatureFlag: () => Promise.resolve(false) } },
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
        { provide: SyncService, useValue: {} },
        { provide: PlatformUtilsService, useValue: {} },
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
});

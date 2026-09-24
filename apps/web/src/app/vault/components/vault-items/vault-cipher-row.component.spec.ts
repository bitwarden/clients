import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, MenuModule } from "@bitwarden/components";
import { ShareLinkMenuItemDirective, ShareLinkService } from "@bitwarden/tools-share";
import {
  CopyCipherFieldService,
  OrganizationNameBadgeComponent,
  VaultCopyButtonsService,
} from "@bitwarden/vault";

import { VaultCipherRowComponent } from "./vault-cipher-row.component";

// eslint-disable-next-line no-console
const originalError = console.error;

// eslint-disable-next-line no-console
console.error = (...args) => {
  if (
    typeof args[0] === "object" &&
    (args[0] as Error).message.includes("Could not parse CSS stylesheet")
  ) {
    // Opening the overlay container in tests causes stylesheets to be parsed,
    // which can lead to JSDOM unable to parse CSS errors. These can be ignored safely.
    return;
  }
  originalError(...args);
};

describe("VaultCipherRowComponent", () => {
  let component: VaultCipherRowComponent<CipherViewLike>;
  let fixture: ComponentFixture<VaultCipherRowComponent<CipherViewLike>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VaultCipherRowComponent],
      imports: [
        CommonModule,
        RouterModule.forRoot([]),
        MenuModule,
        IconButtonModule,
        JslibModule,
        OrganizationNameBadgeComponent,
        PremiumBadgeComponent,
        ShareLinkMenuItemDirective,
      ],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        {
          provide: EnvironmentService,
          useValue: { environment$: new BehaviorSubject({}).asObservable() },
        },
        {
          provide: DomainSettingsService,
          useValue: { showFavicons$: new BehaviorSubject(false).asObservable() },
        },
        { provide: CopyCipherFieldService, useValue: mock<CopyCipherFieldService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: jest.fn().mockReturnValue(of(false)) },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        {
          provide: PlatformUtilsService,
          useValue: mock<PlatformUtilsService>(),
        },
        {
          provide: VaultCopyButtonsService,
          useValue: { showQuickCopyActions$: new BehaviorSubject(false).asObservable() },
        },
        {
          provide: ShareLinkService,
          useValue: { cipherCanBeShared$: () => of(false) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultCipherRowComponent);
    component = fixture.componentInstance;
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  describe("showAssignToCollections", () => {
    let archivedCipher: CipherView;

    beforeEach(() => {
      archivedCipher = new CipherView();
      archivedCipher.id = "cipher-1";
      archivedCipher.name = "Test Cipher";
      archivedCipher.type = CipherType.Login;
      archivedCipher.organizationId = "org-1";
      archivedCipher.deletedDate = null;
      archivedCipher.archivedDate = new Date();

      component.cipher = archivedCipher;
      component.organizations = [{ id: "org-1" } as any];
      component.canAssignCollections = true;
      component.disabled = false;
    });

    it("returns true when cipher is archived and conditions are met", () => {
      expect(component["showAssignToCollections"]).toBe(true);
    });

    it("returns false when cipher is deleted", () => {
      archivedCipher.deletedDate = new Date();

      expect(component["showAssignToCollections"]).toBe(false);
    });

    it("returns false when user cannot assign collections", () => {
      component.canAssignCollections = false;

      expect(component["showAssignToCollections"]).toBe(false);
    });

    it("returns false when there are no organizations", () => {
      component.organizations = [];

      expect(component["showAssignToCollections"]).toBeFalsy();
    });
  });
});

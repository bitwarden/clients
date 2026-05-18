import { OverlayContainer } from "@angular/cdk/overlay";
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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, MenuModule } from "@bitwarden/components";
import {
  CopyCipherFieldDirective,
  CopyCipherFieldService,
  OrganizationNameBadgeComponent,
} from "@bitwarden/vault";

import { CipherLeaseBadgeComponent } from "../../../pam/cipher-lease-badge/cipher-lease-badge.component";

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
  let overlayContainer: OverlayContainer;
  let pamFlag$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    pamFlag$ = new BehaviorSubject<boolean>(false);

    await TestBed.configureTestingModule({
      declarations: [VaultCipherRowComponent],
      imports: [
        CommonModule,
        RouterModule.forRoot([]),
        MenuModule,
        IconButtonModule,
        JslibModule,
        CopyCipherFieldDirective,
        OrganizationNameBadgeComponent,
        PremiumBadgeComponent,
        CipherLeaseBadgeComponent,
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
          useValue: {
            getFeatureFlag$: jest.fn().mockImplementation((flag: FeatureFlag) =>
              flag === FeatureFlag.Pam ? pamFlag$.asObservable() : of(false),
            ),
          },
        },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        {
          provide: PlatformUtilsService,
          useValue: mock<PlatformUtilsService>(),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultCipherRowComponent);
    component = fixture.componentInstance;
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer?.ngOnDestroy();
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  describe("copy password visibility", () => {
    let loginCipher: CipherView;

    beforeEach(() => {
      loginCipher = new CipherView();
      loginCipher.id = "cipher-1";
      loginCipher.name = "Test Login";
      loginCipher.type = CipherType.Login;
      loginCipher.login = new LoginView();
      loginCipher.login.password = "test-password";
      loginCipher.organizationId = undefined;
      loginCipher.deletedDate = null;
      loginCipher.archivedDate = null;

      component.cipher = loginCipher;
      component.disabled = false;
    });

    const openMenuAndGetContent = (): string => {
      fixture.detectChanges();

      const menuTrigger = fixture.nativeElement.querySelector(
        'button[biticonbutton="bwi-ellipsis-v"]',
      ) as HTMLButtonElement;
      expect(menuTrigger).toBeTruthy();

      menuTrigger.click();
      fixture.detectChanges();

      return overlayContainer.getContainerElement().innerHTML;
    };

    it("renders copy password button in menu when viewPassword is true", () => {
      component.cipher.viewPassword = true;

      const overlayContent = openMenuAndGetContent();

      expect(overlayContent).toContain('appcopyfield="password"');
      expect(overlayContent).toContain("copyPassword");
    });

    it("does not render copy password button in menu when viewPassword is false", () => {
      component.cipher.viewPassword = false;

      const overlayContent = openMenuAndGetContent();

      expect(overlayContent).not.toContain('appcopyfield="password"');
    });

    it("does not render copy password button in menu when viewPassword is undefined", () => {
      component.cipher.viewPassword = undefined;

      const overlayContent = openMenuAndGetContent();

      expect(overlayContent).not.toContain('appcopyfield="password"');
    });
  });

  describe("hasBankAccountOptions", () => {
    let bankAccountCipher: CipherView;

    beforeEach(() => {
      bankAccountCipher = new CipherView();
      bankAccountCipher.id = "cipher-1";
      bankAccountCipher.name = "Test Bank Account";
      bankAccountCipher.type = CipherType.BankAccount;
      bankAccountCipher.deletedDate = null;

      component.cipher = bankAccountCipher;
      component.disabled = false;
    });

    it("returns true when accountNumber is populated", () => {
      bankAccountCipher.bankAccount.accountNumber = "123456789";
      expect(component["hasBankAccountOptions"]).toBe(true);
    });

    it("returns true when routingNumber is populated", () => {
      bankAccountCipher.bankAccount.routingNumber = "987654321";
      expect(component["hasBankAccountOptions"]).toBe(true);
    });

    it("returns true when pin is populated", () => {
      bankAccountCipher.bankAccount.pin = "1234";
      expect(component["hasBankAccountOptions"]).toBe(true);
    });

    it("returns true when iban is populated", () => {
      bankAccountCipher.bankAccount.iban = "GB29NWBK60161331926819";
      expect(component["hasBankAccountOptions"]).toBe(true);
    });

    it("returns false when no bank account fields are populated", () => {
      expect(component["hasBankAccountOptions"]).toBe(false);
    });

    it("returns false when cipher is not a bank account type", () => {
      bankAccountCipher.type = CipherType.Login;
      expect(component["hasBankAccountOptions"]).toBe(false);
    });

    it("returns false when cipher is deleted", () => {
      bankAccountCipher.bankAccount.accountNumber = "123456789";
      bankAccountCipher.deletedDate = new Date();
      expect(component["hasBankAccountOptions"]).toBe(false);
    });
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

  describe("cipher lease badge", () => {
    let cipher: CipherView;

    beforeEach(() => {
      cipher = new CipherView();
      cipher.id = "cipher-1";
      cipher.name = "Test Login";
      cipher.type = CipherType.Login;
      cipher.login = new LoginView();
      cipher.organizationId = undefined;
      cipher.deletedDate = null;

      component.cipher = cipher;
      component.disabled = false;
    });

    const badgeEl = (): HTMLElement | null =>
      fixture.nativeElement.querySelector("app-cipher-lease-badge");

    it("hides the badge when the Pam feature flag is OFF", () => {
      pamFlag$.next(false);
      fixture.componentRef.setInput("leaseState", "gated_no_lease");
      fixture.detectChanges();

      expect(badgeEl()).toBeNull();
    });

    it("hides the badge when leaseState is 'unleased' even with the flag ON", () => {
      pamFlag$.next(true);
      fixture.componentRef.setInput("leaseState", "unleased");
      fixture.detectChanges();

      expect(badgeEl()).toBeNull();
    });

    it("shows the badge when the flag is ON and leaseState is 'gated_no_lease'", () => {
      pamFlag$.next(true);
      fixture.componentRef.setInput("leaseState", "gated_no_lease");
      fixture.detectChanges();

      expect(badgeEl()).not.toBeNull();
    });

    it("shows the badge when the flag is ON and leaseState is 'gated_active_lease'", () => {
      pamFlag$.next(true);
      fixture.componentRef.setInput("leaseState", "gated_active_lease");
      fixture.componentRef.setInput("leaseExpiresAt", new Date(Date.now() + 60_000));
      fixture.detectChanges();

      expect(badgeEl()).not.toBeNull();
    });
  });
});

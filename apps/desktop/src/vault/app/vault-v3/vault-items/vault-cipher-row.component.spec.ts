import { OverlayContainer } from "@angular/cdk/overlay";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

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
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { CopyCipherFieldService } from "@bitwarden/vault";

import { VaultCipherRowComponent } from "./vault-cipher-row.component";

// eslint-disable-next-line no-console
const originalError = console.error;

// eslint-disable-next-line no-console
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "object" &&
    (args[0] as Error).message?.includes("Could not parse CSS stylesheet")
  ) {
    // CDK overlay stylesheet parsing errors in JSDOM are safe to ignore.
    return;
  }
  originalError(...args);
};

describe("VaultCipherRowComponent", () => {
  let fixture: ComponentFixture<VaultCipherRowComponent<CipherViewLike>>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VaultCipherRowComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: CopyCipherFieldService, useValue: mock<CopyCipherFieldService>() },
        { provide: AccountService, useValue: mock<AccountService>() },
        { provide: CipherService, useValue: mock<CipherService>() },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>(),
        },
        {
          provide: ConfigService,
          useValue: { getFeatureFlag$: jest.fn().mockReturnValue(of(false)) },
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: new BehaviorSubject({ getIconsUrl: () => "" }).asObservable(),
          },
        },
        {
          provide: DomainSettingsService,
          useValue: { showFavicons$: new BehaviorSubject(false).asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultCipherRowComponent);
    overlayContainer = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlayContainer?.ngOnDestroy();
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
  });

  const createLoginCipher = (): CipherView => {
    const cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.name = "Test Login";
    cipher.type = CipherType.Login;
    cipher.deletedDate = null;
    cipher.archivedDate = null;
    cipher.viewPassword = true;
    cipher.login = new LoginView();
    cipher.login.username = "test-user";
    cipher.login.password = "test-password";
    const uri = new LoginUriView();
    uri.uri = "https://example.com";
    cipher.login.uris = [uri];
    return cipher;
  };

  const openOptionsMenuAndGetContent = (): string => {
    fixture.detectChanges();
    const menuTrigger = fixture.nativeElement.querySelector(
      'button[biticonbutton="bwi-ellipsis-v"]',
    ) as HTMLButtonElement;
    expect(menuTrigger).toBeTruthy();
    menuTrigger.click();
    fixture.detectChanges();
    return overlayContainer.getContainerElement().innerHTML;
  };

  describe("#cipherOptions menu — login cipher with launchable URI", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("cipher", createLoginCipher());
      fixture.componentRef.setInput("disabled", false);
    });

    it("does not render the launch item", () => {
      const content = openOptionsMenuAndGetContent();
      expect(content).not.toContain("bwi-external-link");
    });

    it("does not render copy field items", () => {
      const content = openOptionsMenuAndGetContent();
      expect(content).not.toContain("appcopyfield");
    });

    it("does not render the quick-action divider", () => {
      const content = openOptionsMenuAndGetContent();
      expect(content).not.toContain("bit-menu-divider");
    });
  });

  describe("#cipherOptions menu — card cipher", () => {
    it("does not render copy field items", () => {
      const cardCipher = new CipherView();
      cardCipher.name = "Test Card";
      cardCipher.type = CipherType.Card;
      cardCipher.deletedDate = null;
      cardCipher.archivedDate = null;

      fixture.componentRef.setInput("cipher", cardCipher);
      fixture.componentRef.setInput("disabled", false);

      const content = openOptionsMenuAndGetContent();
      expect(content).not.toContain("appcopyfield");
    });
  });

  describe("row quick-action buttons", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("cipher", createLoginCipher());
      fixture.componentRef.setInput("disabled", false);
      fixture.detectChanges();
    });

    it("still renders the launch button in the row", () => {
      const launchBtn = fixture.nativeElement.querySelector(
        'button[biticonbutton="bwi-external-link"]',
      );
      expect(launchBtn).toBeTruthy();
    });

    it("still renders the copy button in the row", () => {
      const copyBtn = fixture.nativeElement.querySelector('button[biticonbutton="bwi-clone"]');
      expect(copyBtn).toBeTruthy();
    });
  });

  describe("batch bar checkbox", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("cipher", createLoginCipher());
      fixture.componentRef.setInput("disabled", false);
    });

    it("does not render when showBatchBar is false", () => {
      fixture.componentRef.setInput("showBatchBar", false);

      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it("renders when showBatchBar is true", () => {
      fixture.componentRef.setInput("showBatchBar", true);

      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).not.toBeNull();
    });

    it("sets aria-label to the cipher name", () => {
      fixture.componentRef.setInput("showBatchBar", true);

      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;

      expect(checkbox.getAttribute("aria-label")).toBe("Test Login");
    });

    it("reflects the selected state on the checkbox", () => {
      fixture.componentRef.setInput("showBatchBar", true);
      fixture.componentRef.setInput("selected", true);

      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("emits checkboxChange when the checkbox changes", () => {
      fixture.componentRef.setInput("showBatchBar", true);

      fixture.detectChanges();

      const spy = jest.spyOn((fixture.componentInstance as any).checkboxChange, "emit");

      const checkbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"]',
      ) as HTMLInputElement;

      checkbox.dispatchEvent(new Event("change"));

      expect(spy).toHaveBeenCalled();
    });
  });
});

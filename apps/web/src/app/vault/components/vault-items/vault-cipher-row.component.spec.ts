import { OverlayContainer } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterModule } from "@angular/router";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconButtonModule, MenuModule } from "@bitwarden/components";
import { CopyCipherFieldDirective, CopyCipherFieldService } from "@bitwarden/vault";

import { OrganizationNameBadgeComponent } from "../../individual-vault/organization-badge/organization-name-badge.component";

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [VaultCipherRowComponent, OrganizationNameBadgeComponent],
      imports: [
        CommonModule,
        RouterModule.forRoot([]),
        MenuModule,
        IconButtonModule,
        JslibModule,
        CopyCipherFieldDirective,
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
});

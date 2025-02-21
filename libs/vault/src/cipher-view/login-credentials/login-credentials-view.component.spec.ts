import { DebugElement } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { Fido2CredentialView } from "@bitwarden/common/vault/models/view/fido2-credential.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  BitFormFieldComponent,
  BitPasswordInputToggleDirective,
  ColorPasswordComponent,
  CopyClickDirective,
  ToastService,
} from "@bitwarden/components";

import { LoginCredentialsViewComponent } from "./login-credentials-view.component";

describe("LoginCredentialsViewComponent", () => {
  let component: LoginCredentialsViewComponent;
  let fixture: ComponentFixture<LoginCredentialsViewComponent>;

  const hasPremiumFromAnySource$ = new BehaviorSubject<boolean>(true);
  const mockAccount = {
    id: "test-user-id" as UserId,
    email: "test@example.com",
    emailVerified: true,
    name: "Test User",
    type: 0,
    status: 0,
    kdf: 0,
    kdfIterations: 0,
  };
  const activeAccount$ = new BehaviorSubject(mockAccount);

  const cipher = {
    id: "cipher-id",
    name: "Mock Cipher",
    type: CipherType.Login,
    login: new LoginView(),
  } as CipherView;

  cipher.login.password = "cipher-password";
  cipher.login.username = "cipher-username";
  const date = new Date("2024-02-02");
  cipher.login.fido2Credentials = [{ creationDate: date } as Fido2CredentialView];

  const collect = jest.fn();

  beforeEach(async () => {
    collect.mockClear();

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: BillingAccountProfileStateService,
          useValue: mock<BillingAccountProfileStateService>({
            hasPremiumFromAnySource$: () => hasPremiumFromAnySource$,
          }),
        },
        { provide: AccountService, useValue: mock<AccountService>({ activeAccount$ }) },
        { provide: PremiumUpgradePromptService, useValue: mock<PremiumUpgradePromptService>() },
        { provide: EventCollectionService, useValue: mock<EventCollectionService>({ collect }) },
        { provide: PlatformUtilsService, useValue: mock<PlatformUtilsService>() },
        { provide: ToastService, useValue: mock<ToastService>() },
        { provide: I18nService, useValue: { t: (...keys: string[]) => keys.join(" ") } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginCredentialsViewComponent);
    component = fixture.componentInstance;
    component.cipher = cipher;
    fixture.detectChanges();
  });

  describe("username", () => {
    let usernameField: DebugElement;

    beforeEach(() => {
      usernameField = fixture.debugElement.queryAll(By.directive(BitFormFieldComponent))[0];
    });

    it("displays the username", () => {
      const usernameInput = usernameField.query(By.css("input")).nativeElement;

      expect(usernameInput.value).toBe(cipher.login.username);
    });

    it("configures CopyClickDirective for the username", () => {
      const usernameCopyButton = usernameField.query(By.directive(CopyClickDirective));
      const usernameCopyClickDirective = usernameCopyButton.injector.get(CopyClickDirective);

      expect(usernameCopyClickDirective.valueToCopy).toBe(cipher.login.username);
    });
  });

  describe("password", () => {
    let passwordField: DebugElement;

    beforeEach(() => {
      passwordField = fixture.debugElement.queryAll(By.directive(BitFormFieldComponent))[1];
    });

    it("displays the password", () => {
      const passwordInput = passwordField.query(By.css("input")).nativeElement;

      expect(passwordInput.value).toBe(cipher.login.password);
    });

    describe("copy", () => {
      it("does not allow copy when `viewPassword` is false", () => {
        cipher.viewPassword = false;
        fixture.detectChanges();

        const passwordCopyButton = passwordField.query(By.directive(CopyClickDirective));

        expect(passwordCopyButton).toBeNull();
      });

      it("configures CopyClickDirective for the password", () => {
        cipher.viewPassword = true;
        fixture.detectChanges();

        const passwordCopyButton = passwordField.query(By.directive(CopyClickDirective));
        const passwordCopyClickDirective = passwordCopyButton.injector.get(CopyClickDirective);

        expect(passwordCopyClickDirective.valueToCopy).toBe(cipher.login.password);
      });
    });

    describe("toggle password", () => {
      it("does not allow password to be viewed when `viewPassword` is false", () => {
        cipher.viewPassword = false;
        fixture.detectChanges();

        const viewPasswordButton = passwordField.query(
          By.directive(BitPasswordInputToggleDirective),
        );

        expect(viewPasswordButton).toBeNull();
      });

      it("shows password color component", () => {
        cipher.viewPassword = true;
        fixture.detectChanges();

        const viewPasswordButton = passwordField.query(
          By.directive(BitPasswordInputToggleDirective),
        );
        const toggleInputDirective = viewPasswordButton.injector.get(
          BitPasswordInputToggleDirective,
        );

        toggleInputDirective.onClick();
        fixture.detectChanges();

        const passwordColor = passwordField.query(By.directive(ColorPasswordComponent));

        expect(passwordColor.componentInstance.password).toBe(cipher.login.password);
      });

      it("records event", () => {
        cipher.viewPassword = true;
        fixture.detectChanges();

        const viewPasswordButton = passwordField.query(
          By.directive(BitPasswordInputToggleDirective),
        );
        const toggleInputDirective = viewPasswordButton.injector.get(
          BitPasswordInputToggleDirective,
        );

        toggleInputDirective.onClick();
        fixture.detectChanges();

        expect(collect).toHaveBeenCalledWith(
          EventType.Cipher_ClientToggledPasswordVisible,
          cipher.id,
          false,
          cipher.organizationId,
        );
      });
    });
  });

  describe("fido2Credentials", () => {
    let fido2Field: DebugElement;

    beforeEach(() => {
      fido2Field = fixture.debugElement.queryAll(By.directive(BitFormFieldComponent))[2];

      // Mock datePipe to avoid timezone related issues within tests
      jest.spyOn(component["datePipe"], "transform").mockReturnValue("2/2/24 6:00PM");
      fixture.detectChanges();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("displays the creation date", () => {
      const fido2Input = fido2Field.query(By.css("input")).nativeElement;

      expect(fido2Input.value).toBe("dateCreated 2/2/24 6:00PM");
    });
  });
});

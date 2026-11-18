import { LiveAnnouncer } from "@angular/cdk/a11y";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { Loader } from "../../metadata";
import { ImportOption, ImportResult } from "../../models";
import {
  DefaultImportStagingService,
  ImporterUpgradeCapabilities,
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
  ImportUpgradeMetadataServiceAbstraction,
  ImportUpgradeServiceAbstraction,
} from "../../services";
import { DialogImportOutcomePresenter, ImportOutcomePresenter } from "../import-confirmation";
import { LastPassDirectImportService } from "../lastpass/lastpass-direct-import.service";
import { LastPassLoginSession } from "../lastpass/lastpass-login-session";

import { KeeperDirectImportUpgradeService } from "./direct/keeper/keeper-direct-import-upgrade.service";
import { ImportControlsLastPassLoginComponent } from "./import-controls-lastpass-login.component";
import { ImportControlsComponent } from "./import-controls.component";

describe("ImportControlsComponent: LastPass login in the card", () => {
  let fixture: ComponentFixture<ImportControlsComponent>;
  let importService: MockProxy<ImportUpgradeServiceAbstraction>;
  let importMetadataService: MockProxy<ImportUpgradeMetadataServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let lastPassService: MockProxy<LastPassDirectImportService>;
  let policyService: MockProxy<PolicyService>;
  let accountService: MockProxy<AccountService>;
  let syncService: MockProxy<SyncService>;
  let result: ImportResult;

  const component = () => fixture.componentInstance as any;
  const byId = (id: string) => fixture.debugElement.query(By.css(`#${id}`));
  const text = () => fixture.nativeElement.textContent as string;
  const isDisabled = (id: string) => {
    const button = byId(id).nativeElement as HTMLButtonElement;
    return button.disabled || button.getAttribute("aria-disabled") === "true";
  };
  const isShown = (id: string) => {
    const element = byId(id)?.nativeElement as HTMLElement | undefined;
    return element != null && element.closest("[hidden]") === null;
  };
  const continueDisabled = () => isDisabled("importer-controls_button_continue");
  const backDisabled = () => isDisabled("importer-controls_button_back");
  // The button draws a spinner over its label while a request is in flight.
  const continueBusy = () =>
    fixture.debugElement.query(By.css("#importer-controls_button_continue bit-spinner")) != null;
  const controls = () => component().formGroup.controls;
  const loginControls = () =>
    fixture.debugElement.query(By.directive(ImportControlsLastPassLoginComponent)).componentInstance
      .form.controls;

  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const typeAndContinue = async (id: string, value: string) => {
    const input = byId(id).nativeElement as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event("input"));
    // The keystroke and the click are separate events: the screen renders in between.
    await settle();
    await component().submit();
    await settle();
  };
  const typePassword = (value: string) =>
    typeAndContinue("importer-controls_input_lastpass-password", value);
  const typeCode = (value: string) =>
    typeAndContinue("importer-controls_input_lastpass-code", value);

  const providers = () => [
    { provide: ImportUpgradeServiceAbstraction, useValue: importService },
    { provide: ImportUpgradeMetadataServiceAbstraction, useValue: importMetadataService },
    {
      provide: ImportDestinationServiceAbstraction,
      useValue: Object.assign(mock<ImportDestinationServiceAbstraction>(), {
        destinations$: of({ options: [], hasStep: false }),
      }),
    },
    { provide: ImportStagingServiceAbstraction, useValue: new DefaultImportStagingService() },
    { provide: PlatformUtilsService, useValue: platformUtilsService },
    { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
    { provide: LogService, useValue: mock<LogService>() },
    { provide: LiveAnnouncer, useValue: mock<LiveAnnouncer>() },
    { provide: DialogService, useValue: dialogService },
    { provide: ImportOutcomePresenter, useClass: DialogImportOutcomePresenter },
    { provide: ToastService, useValue: toastService },
    { provide: PolicyService, useValue: policyService },
    { provide: AccountService, useValue: accountService },
    { provide: SyncService, useValue: syncService },
    {
      provide: KeeperDirectImportUpgradeService,
      useValue: mock<KeeperDirectImportUpgradeService>(),
    },
    { provide: LastPassDirectImportService, useValue: lastPassService },
    {
      provide: AbstractThemingService,
      useValue: { theme$: of(ThemeTypes.Light) } as Partial<AbstractThemingService>,
    },
  ];

  const mount = async (clientType: ClientType = ClientType.Desktop) => {
    platformUtilsService.getClientType.mockReturnValue(clientType);
    await TestBed.configureTestingModule({
      imports: [ImportControlsComponent],
      providers: providers(),
    }).compileComponents();
    fixture = TestBed.createComponent(ImportControlsComponent);
    fixture.componentRef.setInput("importType", "lastpasscsv");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    component().continueFromIntro();
    fixture.detectChanges();
  };

  /** Fills the email, then runs `script` as LastPass's login, driving the same session the
   *  service drives. */
  const startLogin = async (
    script: (session: LastPassLoginSession) => Promise<unknown>,
    clientType: ClientType = ClientType.Desktop,
  ) => {
    await mount(clientType);
    controls().lastPassEmail.setValue("user@example.com");
    lastPassService.handleImport.mockImplementation(async (_email, _shared, session) => {
      await script(session!);
      return "url,username,password\n";
    });
    await component().submit();
    await settle();
  };

  beforeEach(() => {
    result = new ImportResult();
    importService = mock<ImportUpgradeServiceAbstraction>();
    importService.getImporter.mockReturnValue({} as any);
    importService.import.mockResolvedValue(result);
    const lastPass: ImportOption = {
      id: "lastpasscsv",
      name: "LastPass",
      featuredImporter: false,
      isBrowser: false,
      acceptedFileTypes: ["csv"],
      pasteFormats: ["csv"],
      hasDirectImporter: true,
      loaders: [Loader.file],
    };
    importService.getImportOption.mockImplementation((id) =>
      id === "lastpasscsv" ? lastPass : undefined,
    );
    importMetadataService = mock<ImportUpgradeMetadataServiceAbstraction>();
    importMetadataService.init.mockResolvedValue(undefined);
    importMetadataService.metadata$.mockReturnValue(
      of<ImporterUpgradeCapabilities>({ type: "lastpasscsv", loaders: [Loader.file] }),
    );
    platformUtilsService = mock<PlatformUtilsService>();
    dialogService = mock<DialogService>();
    dialogService.open.mockReturnValue({ closed: of(undefined) } as any);
    dialogService.openSimpleDialog.mockResolvedValue(true);
    toastService = mock<ToastService>();
    policyService = mock<PolicyService>();
    policyService.policyAppliesToUser$.mockReturnValue(of(false));
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "test-user-id" } as unknown as Account);
    syncService = mock<SyncService>();
    syncService.fullSync.mockResolvedValue(true);
    lastPassService = mock<LastPassDirectImportService>();
  });

  describe("email", () => {
    it("labels the field Email and keeps the shared-folders option", async () => {
      await mount();

      expect(text()).toContain("email");
      expect(text()).not.toContain("lastPassEmail");
      expect(text()).toContain("includeSharedFolders");
    });

    it("focuses the Email field when the credentials step appears", async () => {
      await mount();
      await settle();

      expect(document.activeElement).toBe(
        byId("importer-controls_input_lastpass-email").nativeElement,
      );
    });

    it("explains an empty or invalid email with the design's messages", async () => {
      await mount();

      await component().submit();
      expect(controls().lastPassEmail.errors.lastPassEmailRequired.message).toBe(
        "lastPassLoginEmailRequired",
      );

      controls().lastPassEmail.setValue("not-an-email");
      expect(controls().lastPassEmail.errors.lastPassEmailInvalid.message).toBe(
        "lastPassLoginEmailInvalid",
      );
      expect(lastPassService.handleImport).not.toHaveBeenCalled();
    });

    it("shows the logo, heading and subtitle", async () => {
      await mount();

      expect(text()).toContain("importDataLoginTitle");
      expect(text()).toContain("importDataLoginSubtitle");
    });
  });

  describe("master password", () => {
    it("asks in the card, masked and with a show/hide toggle, not in a dialog", async () => {
      let answer: string | undefined;
      await startLogin(async (session) => {
        answer = await session.promptForPassword({ previousPasswordRejected: false });
      });

      const input = byId("importer-controls_input_lastpass-password").nativeElement;
      expect(input.type).toBe("password");
      expect(fixture.nativeElement.querySelector("[bitPasswordInputToggle]")).toBeTruthy();
      expect(text()).toContain("masterPassword");
      expect(text()).toContain("lastPassLoginPasswordDesc");
      expect(isShown("importer-controls_input_lastpass-email")).toBe(false);
      expect(continueDisabled()).toBe(false);
      expect(dialogService.open).not.toHaveBeenCalled();

      await typePassword("hunter2");
      await component().lastPassLogin();

      expect(answer).toBe("hunter2");
    });

    it("requires a password, marking the field instead of answering", async () => {
      const prompt = jest.fn();
      await startLogin(async (session) => {
        prompt(await session.promptForPassword({ previousPasswordRejected: false }));
      });

      await component().submit();
      await settle();

      expect(loginControls().lastPassPassword.errors.lastPassPasswordRequired.message).toBe(
        "lastPassLoginPasswordRequired",
      );
      expect(loginControls().lastPassPassword.touched).toBe(true);
      expect(prompt).not.toHaveBeenCalled();
    });

    it("shows a rejected password on its field and keeps the user there", async () => {
      await startLogin(async (session) => {
        await session.promptForPassword({ previousPasswordRejected: false });
        await session.promptForPassword({ previousPasswordRejected: true });
      });

      await typePassword("wrong");

      expect(isShown("importer-controls_input_lastpass-password")).toBe(true);
      expect(loginControls().lastPassPassword.errors.lastPassPasswordRejected.message).toBe(
        "lastPassLoginPasswordInvalid",
      );
      expect(loginControls().lastPassPassword.value).toBe("");
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });

  describe("verification code", () => {
    it("asks in the card with the design's subtitle, not in a dialog", async () => {
      let code: string | undefined;
      await startLogin(async (session) => {
        code = (await session.provideGoogleAuthPasscode()).passcode;
      });

      expect(text()).toContain("verificationCode");
      expect(text()).toContain("lastPassLoginCodeDesc");
      expect(continueDisabled()).toBe(false);
      expect(dialogService.open).not.toHaveBeenCalled();

      await typeCode("  123456 ");
      await component().lastPassLogin();

      expect(code).toBe("123456");
    });

    it("requires a code, marking the field instead of answering", async () => {
      const prompt = jest.fn();
      await startLogin(async (session) => {
        prompt(await session.provideYubikeyPasscode());
      });

      await component().submit();
      await settle();

      expect(loginControls().lastPassCode.errors.lastPassCodeRequired.message).toBe(
        "verificationCodeRequired",
      );
      expect(loginControls().lastPassCode.touched).toBe(true);
      expect(prompt).not.toHaveBeenCalled();
    });

    it("shows a rejected code on its field and keeps the user there", async () => {
      await startLogin(async (session) => {
        await session.provideGoogleAuthPasscode();
        session.rejectSubmittedCode();
        await session.provideGoogleAuthPasscode();
      });

      await typeCode("000000");

      expect(isShown("importer-controls_input_lastpass-code")).toBe(true);
      expect(loginControls().lastPassCode.errors.lastPassCodeRejected.message).toBe(
        "lastPassLoginCodeInvalid",
      );
      expect(loginControls().lastPassCode.value).toBe("000000");
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("takes the code for an out-of-band login, and locks the prompt once it is approved in the app", async () => {
      let approve: () => void = () => undefined;
      const approved = new Promise<void>((resolve) => {
        approve = resolve;
      });
      let finishLogin: () => void = () => undefined;
      const loginFinished = new Promise<void>((resolve) => {
        finishLogin = resolve;
      });
      await startLogin(async (session) => {
        void session.approveLastPassAuth();
        await approved;
        session.closeMFADialog();
        await loginFinished;
      });

      expect(text()).toContain("verificationCode");

      approve();
      await settle();

      expect(continueBusy()).toBe(true);
      expect(
        byId("importer-controls_input_lastpass-code").nativeElement.closest("[inert]"),
      ).not.toBeNull();
      expect(text()).not.toContain("importingYourAccount");

      finishLogin();
      await component().lastPassLogin();
    });
  });

  describe("SSO", () => {
    it("shows the waiting card with Continue disabled, and Back and Import manually instead active", async () => {
      await startLogin(async (session) => {
        await session.prepareSso();
        await session.waitForSsoCancel();
      });

      expect(text()).toContain("lastPassLoginWaitingForSso");
      expect(text()).toContain("lastPassLoginWaitingForSsoDesc");
      expect(fixture.nativeElement.querySelector("bit-spinner")).toBeTruthy();
      expect(continueDisabled()).toBe(true);
      expect(continueBusy()).toBe(false);
      expect(backDisabled()).toBe(false);
      expect(isDisabled("importer-controls_button_import-manually-instead")).toBe(false);
    });

    it("cancels at once on Back, without a confirmation or an error", async () => {
      let cancelled: unknown;
      await startLogin(async (session) => {
        try {
          await session.waitForSsoCancel();
        } catch (error) {
          cancelled = error;
          throw error;
        }
      });
      const backSpy = jest.fn();
      component().back.subscribe(backSpy);

      component().onBack();
      await settle();

      expect((cancelled as Error).message).toBe("SSO auth cancelled");
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(text()).not.toContain("lastPassLoginWaitingForSso");
      expect(backSpy).not.toHaveBeenCalled();
    });

    it("cancels at once on Import manually instead, and shows the file import", async () => {
      await startLogin(async (session) => {
        await session.waitForSsoCancel();
      });

      component().toggleToManual();
      await settle();

      expect(component().primaryMode()).toBe("manual");
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(text()).not.toContain("lastPassLoginWaitingForSso");
    });

    it("imports without any click once SSO completes", async () => {
      let release: () => void = () => undefined;
      const callback = new Promise<void>((resolve) => {
        release = resolve;
      });
      await startLogin(async (session) => {
        void session.waitForSsoCancel().catch((): void => undefined);
        await callback;
        session.completeSso();
      });
      const continueSpy = jest.fn();
      component().continue.subscribe(continueSpy);

      release();
      await component().lastPassLogin();
      await settle();

      expect(importService.import).toHaveBeenCalledWith(
        {},
        "url,username,password\n",
        undefined,
        undefined,
        false,
      );
      expect(continueSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("failures", () => {
    it("shows an unknown account on the email field, back on the email screen", async () => {
      await startLogin(async () => {
        throw new Error("Invalid username");
      });
      await component().lastPassLogin();
      await settle();

      expect(controls().lastPassEmail.errors).toEqual({
        errors: { message: "incorrectUsernameOrPassword" },
      });
      expect(isShown("importer-controls_input_lastpass-email")).toBe(true);
      expect(controls().lastPassEmail.value).toBe("user@example.com");
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("toasts any other failure and starts over from the intro", async () => {
      await startLogin(async () => {
        throw new Error("No accounts to transform");
      });
      await component().lastPassLogin();
      await settle();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: undefined,
        message: "noLastPassDataFound",
      });
      expect(controls().lastPassEmail.value).toBe("");
      expect(component().directStep()).toBe("intro");
    });

    it("recovers on a retry after a failure, instead of leaving submit() blocked", async () => {
      await startLogin(async () => {
        throw new Error("Invalid username");
      });
      await component().lastPassLogin();
      await settle();
      expect(importService.import).not.toHaveBeenCalled();

      lastPassService.handleImport.mockResolvedValueOnce("url,username,password\n");
      await component().submit();
      await component().lastPassLogin();

      expect(lastPassService.handleImport).toHaveBeenCalledTimes(2);
      expect(importService.import).toHaveBeenCalledTimes(1);
    });
  });

  describe("importing", () => {
    it("locks Back and Import manually instead while the vault is written", async () => {
      let finishImport: (value: ImportResult) => void = () => undefined;
      importService.import.mockReturnValue(
        new Promise<ImportResult>((resolve) => {
          finishImport = resolve;
        }),
      );
      await startLogin(async () => undefined);
      await settle();

      expect(continueBusy()).toBe(true);
      expect(backDisabled()).toBe(true);
      expect(isDisabled("importer-controls_button_import-manually-instead")).toBe(true);

      finishImport(result);
      await component().lastPassLogin();
    });
  });

  describe("busy state", () => {
    const waitForServer = () => {
      let release: () => void = () => undefined;
      const replies = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { replies, release: () => release() };
    };

    it("keeps the email field on screen while Continue shows the spinner", async () => {
      const server = waitForServer();
      await startLogin(async () => server.replies);

      expect(isShown("importer-controls_input_lastpass-email")).toBe(true);
      expect(continueBusy()).toBe(true);
      expect(text()).not.toContain("importingYourAccount");

      server.release();
      await component().lastPassLogin();
    });

    it("keeps the password field on screen, locked and cleared, while Continue shows the spinner", async () => {
      const server = waitForServer();
      await startLogin(async (session) => {
        await session.promptForPassword({ previousPasswordRejected: false });
        await server.replies;
      });
      const input = byId("importer-controls_input_lastpass-password").nativeElement;

      await typePassword("hunter2");

      expect(continueBusy()).toBe(true);
      expect(byId("importer-controls_input_lastpass-password").nativeElement).toBe(input);
      expect(input.value).toBe("");
      expect(input.closest("[inert]")).not.toBeNull();
      expect(loginControls().lastPassPassword.disabled).toBe(true);
      expect(text()).not.toContain("lastPassLoginPasswordRequired");
      expect(text()).toContain("lastPassLoginPasswordDesc");

      server.release();
      await component().lastPassLogin();
    });

    it("keeps the code field on screen, locked and showing what was entered, while Continue shows the spinner", async () => {
      const server = waitForServer();
      await startLogin(async (session) => {
        await session.provideGoogleAuthPasscode();
        await server.replies;
      });
      const input = byId("importer-controls_input_lastpass-code").nativeElement;

      await typeCode("123456");

      expect(continueBusy()).toBe(true);
      expect(byId("importer-controls_input_lastpass-code").nativeElement).toBe(input);
      expect(input.value).toBe("123456");
      expect(input.closest("[inert]")).not.toBeNull();
      expect(loginControls().lastPassCode.disabled).toBe(true);
      expect(text()).not.toContain("verificationCodeRequired");
      expect(text()).toContain("lastPassLoginCodeDesc");

      server.release();
      await component().lastPassLogin();
    });

    it("unlocks the field when LastPass rejects the answer", async () => {
      await startLogin(async (session) => {
        await session.promptForPassword({ previousPasswordRejected: false });
        await session.promptForPassword({ previousPasswordRejected: true });
      });

      await typePassword("wrong");

      expect(continueBusy()).toBe(false);
      expect(
        byId("importer-controls_input_lastpass-password").nativeElement.closest("[inert]"),
      ).toBeNull();
    });
  });
});

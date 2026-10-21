import { readFileSync } from "fs";
import { join } from "path";

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

import {
  Cancel,
  DeviceApprovalChannel,
  KeeperAuthError,
  KeeperAuthErrorCode,
  KeeperRegion,
  Resend,
  TwoFactorMethod,
  Ui,
} from "../../importers/keeper/access";
import { Loader } from "../../metadata";
import { ImportOption, ImportResult } from "../../models";
import {
  ImporterUpgradeCapabilities,
  ImportUpgradeMetadataServiceAbstraction,
  ImportUpgradeServiceAbstraction,
} from "../../services";
import { ImportErrorDialogComponent } from "../dialog";
import { KeeperAuthDialogComponent } from "../keeper/dialog/keeper-auth-dialog.component";
import {
  KEEPER_SSO_TAB_MONITOR,
  KeeperSsoTabMonitor,
} from "../keeper/services/keeper-sso-tab-monitor";
import { LastPassDirectImportService } from "../lastpass/lastpass-direct-import.service";

import { KeeperDirectImportUpgradeService } from "./direct/keeper/keeper-direct-import-upgrade.service";
import { ImportControlsKeeperLoginComponent } from "./import-controls-keeper-login.component";
import { ImportControlsComponent } from "./import-controls.component";

describe("ImportControlsComponent: Keeper login in the card", () => {
  let fixture: ComponentFixture<ImportControlsComponent>;
  let importService: MockProxy<ImportUpgradeServiceAbstraction>;
  let importMetadataService: MockProxy<ImportUpgradeMetadataServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let keeperService: MockProxy<KeeperDirectImportUpgradeService>;
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
    fixture.debugElement.query(By.directive(ImportControlsKeeperLoginComponent)).componentInstance
      .form.controls;

  const settle = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  // A scripted Keeper client answers only after `reply()`, so each prompt passes through the busy
  // state a real login has between a submit and the server's answer.
  let replies: Array<() => void>;
  const serverReply = () => new Promise<void>((resolve) => replies.push(resolve));
  const reply = async () => {
    await settle();
    replies.shift()?.();
    await settle();
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
  const typeCode = (value: string) => typeAndContinue("importer-controls_input_keeper-code", value);
  const typePassword = (value: string) =>
    typeAndContinue("importer-controls_input_keeper-password", value);
  const codeInput = () =>
    byId("importer-controls_input_keeper-code").nativeElement as HTMLInputElement;

  const providers = () => [
    { provide: ImportUpgradeServiceAbstraction, useValue: importService },
    { provide: ImportUpgradeMetadataServiceAbstraction, useValue: importMetadataService },
    { provide: PlatformUtilsService, useValue: platformUtilsService },
    { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
    { provide: LogService, useValue: mock<LogService>() },
    { provide: LiveAnnouncer, useValue: mock<LiveAnnouncer>() },
    { provide: DialogService, useValue: dialogService },
    { provide: ToastService, useValue: toastService },
    { provide: PolicyService, useValue: policyService },
    { provide: AccountService, useValue: accountService },
    { provide: SyncService, useValue: syncService },
    { provide: KeeperDirectImportUpgradeService, useValue: keeperService },
    { provide: LastPassDirectImportService, useValue: mock<LastPassDirectImportService>() },
    {
      provide: AbstractThemingService,
      useValue: { theme$: of(ThemeTypes.Light) } as Partial<AbstractThemingService>,
    },
  ];

  const mount = async (clientType: ClientType, extraProviders: unknown[] = []) => {
    platformUtilsService.getClientType.mockReturnValue(clientType);
    await TestBed.configureTestingModule({
      imports: [ImportControlsComponent],
      providers: [...providers(), ...extraProviders],
    }).compileComponents();
    fixture = TestBed.createComponent(ImportControlsComponent);
    fixture.componentRef.setInput("importType", "keeper");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    component().continueFromIntro();
    fixture.detectChanges();
  };

  /** Fills the email, then runs `script` as Keeper's login, driving the same Ui the SDK drives. */
  const startLogin = async (
    script: (ui: Ui) => Promise<unknown>,
    clientType: ClientType = ClientType.Desktop,
    extraProviders: unknown[] = [],
  ) => {
    await mount(clientType, extraProviders);
    controls().keeperEmail.setValue("user@example.com");
    keeperService.handleImport.mockImplementation(async (_email, _region, ui) => {
      await script(ui);
      return { result, errors: [] };
    });
    await component().submit();
    await settle();
  };

  beforeEach(() => {
    replies = [];
    result = new ImportResult();
    importService = mock<ImportUpgradeServiceAbstraction>();
    importService.importImportResult.mockResolvedValue(result);
    const keeper: ImportOption = {
      id: "keeper",
      name: "Keeper",
      featuredImporter: false,
      isBrowser: false,
      acceptedFileTypes: ["csv", "json"],
      pasteFormats: ["csv", "json"],
      hasDirectImporter: true,
      loaders: [Loader.file],
    };
    importService.getImportOption.mockImplementation((id) =>
      id === "keeper" ? keeper : undefined,
    );
    importMetadataService = mock<ImportUpgradeMetadataServiceAbstraction>();
    importMetadataService.init.mockResolvedValue(undefined);
    importMetadataService.metadata$.mockReturnValue(
      of<ImporterUpgradeCapabilities>({ type: "keeper", loaders: [Loader.file] }),
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
    keeperService = mock<KeeperDirectImportUpgradeService>();
  });

  describe("credentials", () => {
    it("labels the fields Email and Server, per the design", async () => {
      await mount(ClientType.Desktop);

      expect(text()).toContain("email");
      expect(text()).toContain("keeperLoginServerLabel");
      expect(text()).not.toContain("keeperEmailHint");
    });

    // Web and the extension load Tailwind's preflight, which gives every heading and paragraph a
    // bottom margin that `noMargin` doesn't remove. Only explicit classes keep the card header's
    // spacing the same as desktop's and as Figma's.
    it("sets the card header's margins explicitly, so the title and subtitle sit together", async () => {
      await mount(ClientType.Desktop);

      const title = fixture.nativeElement.querySelector(
        "importer-controls-direct h2",
      ) as HTMLElement;
      const subtitle = title.nextElementSibling as HTMLElement;

      expect(title.classList).toContain("tw-mb-0");
      expect(subtitle.classList).toContain("tw-mb-0");
    });

    it("focuses the email field when the credentials step appears", async () => {
      await mount(ClientType.Desktop);
      await settle();

      expect(document.activeElement).toBe(
        byId("importer-controls_input_keeper-email").nativeElement,
      );
    });

    it("explains an empty or invalid email with the design's messages", async () => {
      await mount(ClientType.Desktop);

      await component().submit();
      expect(controls().keeperEmail.errors.keeperEmailRequired.message).toBe(
        "keeperLoginEmailRequired",
      );

      controls().keeperEmail.setValue("not-an-email");
      expect(controls().keeperEmail.errors.keeperEmailInvalid.message).toBe(
        "keeperLoginEmailInvalid",
      );
      expect(keeperService.handleImport).not.toHaveBeenCalled();
    });
  });

  describe("device approval", () => {
    it("shows the method picker in the card, not in the legacy dialog, and Continue answers it", async () => {
      let selected: unknown;
      await startLogin(async (ui) => {
        selected = await ui.selectApprovalMethod([
          DeviceApprovalChannel.Email,
          DeviceApprovalChannel.KeeperPush,
        ]);
      });

      expect(text()).toContain("keeperLoginApprovalMethod");
      expect(byId("importer-controls_radio_keeper-approval-1")).toBeTruthy();
      expect(byId("importer-controls_radio_keeper-approval-2")).toBeTruthy();
      expect(loginControls().keeperApprovalMethod.value).toBe(DeviceApprovalChannel.Email);
      expect(continueDisabled()).toBe(false);
      expect(dialogService.open).not.toHaveBeenCalledWith(
        KeeperAuthDialogComponent,
        expect.anything(),
      );

      loginControls().keeperApprovalMethod.setValue(DeviceApprovalChannel.KeeperPush);
      await component().submit();
      await component().keeperLogin();

      expect(selected).toBe(DeviceApprovalChannel.KeeperPush);
      expect(importService.importImportResult).toHaveBeenCalled();
    });

    it("offers Keeper DNA, and choosing it waits for the device with no code field", async () => {
      await startLogin(async (ui) => {
        await ui.selectApprovalMethod([
          DeviceApprovalChannel.Email,
          DeviceApprovalChannel.TwoFactor,
          DeviceApprovalChannel.KeeperDna,
        ]);
        await ui.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true });
      });
      expect(text()).toContain("keeperDna");

      loginControls().keeperApprovalMethod.setValue(DeviceApprovalChannel.KeeperDna);
      await component().submit();
      await settle();

      expect(text()).toContain("keeperLoginDnaSent");
      expect(text()).toContain("keeperLoginDnaSentDesc");
      expect(byId("importer-controls_input_keeper-code")).toBeNull();
      expect(continueDisabled()).toBe(true);
    });

    it("labels the two-factor approval channel 'Two-factor method'", async () => {
      await startLogin(async (ui) => {
        await ui.selectApprovalMethod([
          DeviceApprovalChannel.Email,
          DeviceApprovalChannel.TwoFactor,
        ]);
      });

      expect(text()).toContain("twoFactorMethod");
    });
  });

  describe("an email code followed by a second-factor code", () => {
    it("accepts the TOTP code typed after the email code, without a 'required' error", async () => {
      let releaseServer: () => void = () => undefined;
      const serverReplies = new Promise<void>((resolve) => {
        releaseServer = resolve;
      });
      const answers: unknown[] = [];
      await startLogin(async (ui) => {
        answers.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
        await serverReplies;
        answers.push(await ui.provideTwoFactorCode(TwoFactorMethod.Totp));
      });

      loginControls().keeperCode.setValue("111111");
      await component().submit();
      await settle();
      releaseServer();
      await settle();

      expect(text()).toContain("keeperLoginAuthenticatorDesc");
      expect(loginControls().keeperCode.enabled).toBe(true);
      expect(loginControls().keeperCode.touched).toBe(false);

      const input = byId("importer-controls_input_keeper-code").nativeElement as HTMLInputElement;
      input.value = "222222";
      input.dispatchEvent(new Event("input"));
      expect(loginControls().keeperCode.value).toBe("222222");
      await component().submit();
      await settle();

      expect(answers).toEqual(["111111", "222222"]);
    });
  });

  describe("a rejected code, after the server has had time to answer", () => {
    // The tests above chain prompts instantly. A real login always passes through the busy state
    // between a submit and the server's answer. The field stays mounted and Continue shows its
    // spinner, so the card doesn't flicker.
    const rejectedAfterServerReplies = async (
      firstPrompt: (ui: Ui) => Promise<unknown>,
      secondPrompt: (ui: Ui) => Promise<unknown>,
      submitFirst: () => Promise<void>,
    ) => {
      let releaseServer: () => void = () => undefined;
      const serverReplies = new Promise<void>((resolve) => {
        releaseServer = resolve;
      });
      await startLogin(async (ui) => {
        await firstPrompt(ui);
        await serverReplies;
        await secondPrompt(ui);
      });
      await submitFirst();
      await settle();
      expect(continueBusy()).toBe(true);
      expect(text()).not.toContain("importingYourAccount");
      releaseServer();
      await settle();
    };

    it("shows 'invalid' on the email verification code field, not 'required'", async () => {
      await rejectedAfterServerReplies(
        (ui) => ui.provideApprovalCode(DeviceApprovalChannel.Email),
        (ui) => ui.provideApprovalCode(DeviceApprovalChannel.Email, { previousCodeRejected: true }),
        async () => {
          loginControls().keeperCode.setValue("000000");
          await component().submit();
        },
      );

      // The field displays the first error key
      expect(Object.keys(loginControls().keeperCode.errors)[0]).toBe("keeperCodeRejected");
      expect(loginControls().keeperCode.errors.keeperCodeRejected.message).toBe(
        "keeperLoginCodeInvalid",
      );
      expect(loginControls().keeperCode.touched).toBe(true);
    });

    it("shows 'invalid' on the TOTP code field, not 'required'", async () => {
      await rejectedAfterServerReplies(
        (ui) => ui.provideTwoFactorCode(TwoFactorMethod.Totp),
        (ui) => ui.provideTwoFactorCode(TwoFactorMethod.Totp, { previousCodeRejected: true }),
        async () => {
          loginControls().keeperCode.setValue("000000");
          await component().submit();
        },
      );

      // The field displays the first error key
      expect(Object.keys(loginControls().keeperCode.errors)[0]).toBe("keeperCodeRejected");
      expect(loginControls().keeperCode.errors.keeperCodeRejected.message).toBe(
        "keeperLoginCodeInvalid",
      );
      expect(loginControls().keeperCode.touched).toBe(true);
    });

    it("shows 'invalid' on the master password field, not 'required'", async () => {
      await rejectedAfterServerReplies(
        (ui) => ui.promptForPassword(),
        (ui) => ui.promptForPassword({ previousPasswordRejected: true }),
        async () => {
          loginControls().keeperPassword.setValue("wrong");
          await component().submit();
        },
      );

      expect(Object.keys(loginControls().keeperPassword.errors)[0]).toBe("keeperPasswordRejected");
      expect(loginControls().keeperPassword.errors.keeperPasswordRejected.message).toBe(
        "keeperLoginPasswordInvalid",
      );
      expect(loginControls().keeperPassword.touched).toBe(true);
    });
  });

  // Each script repeats the Ui calls the Keeper client makes in a real login (client.ts), with the
  // server's answer arriving only after `reply()`, so every prompt passes through the busy state.
  describe("login sequences as the Keeper client runs them", () => {
    it("email code rejected, then accepted", async () => {
      const answers: unknown[] = [];
      await startLogin(async (ui) => {
        answers.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
        await serverReply();
        answers.push(
          await ui.provideApprovalCode(DeviceApprovalChannel.Email, { previousCodeRejected: true }),
        );
      });
      expect(text()).toContain("keeperLoginEmailCodeDesc");

      await typeCode("000000");
      expect(continueBusy()).toBe(true);
      expect(text()).toContain("keeperLoginEmailCodeDesc");
      await reply();

      expect(text()).toContain("keeperLoginEmailCodeDesc");
      expect(text()).toContain("keeperLoginCodeInvalid");
      expect(codeInput().value).toBe("000000");

      await typeCode("123456");

      expect(answers).toEqual(["000000", "123456"]);
    });

    it("email code, then an authenticator code, then a rejected and an accepted password", async () => {
      const answers: unknown[] = [];
      await startLogin(async (ui) => {
        answers.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
        await serverReply();
        answers.push(await ui.provideTwoFactorCode(TwoFactorMethod.Totp));
        await serverReply();
        answers.push(await ui.promptForPassword());
        await serverReply();
        answers.push(await ui.promptForPassword({ previousPasswordRejected: true }));
      });

      await typeCode("111111");
      await reply();
      expect(text()).toContain("keeperLoginAuthenticatorDesc");
      expect(text()).not.toContain("keeperLoginEmailCodeDesc");
      expect(text()).not.toContain("verificationCodeRequired");

      await typeCode("222222");
      await reply();
      expect(text()).toContain("keeperLoginPasswordDesc");
      expect(text()).not.toContain("keeperLoginPasswordRequired");

      await typePassword("wrong");
      await reply();
      expect(text()).toContain("keeperLoginPasswordInvalid");
      expect(
        (byId("importer-controls_input_keeper-password").nativeElement as HTMLInputElement).value,
      ).toBe("");

      await typePassword("right");

      expect(answers).toEqual(["111111", "222222", "wrong", "right"]);
    });

    it("authenticator code rejected, then accepted", async () => {
      const answers: unknown[] = [];
      await startLogin(async (ui) => {
        answers.push(await ui.provideTwoFactorCode(TwoFactorMethod.Totp));
        await serverReply();
        answers.push(
          await ui.provideTwoFactorCode(TwoFactorMethod.Totp, { previousCodeRejected: true }),
        );
      });

      await typeCode("000000");
      await reply();
      expect(text()).toContain("keeperLoginAuthenticatorDesc");
      expect(text()).toContain("keeperLoginCodeInvalid");

      await typeCode("654321");

      expect(answers).toEqual(["000000", "654321"]);
    });

    it("resending an email code keeps the field and shows no error", async () => {
      const answers: unknown[] = [];
      await startLogin(async (ui) => {
        answers.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
        answers.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
      });

      byId("importer-controls_button_keeper-resend-code").nativeElement.click();
      await settle();

      expect(answers).toEqual([Resend]);
      expect(toastService.showToast).toHaveBeenCalled();
      expect(text()).toContain("keeperLoginEmailCodeDesc");
      expect(text()).not.toContain("keeperLoginCodeInvalid");
      expect(codeInput().value).toBe("");
    });

    describe("Resend code as the code field's hint", () => {
      const resendHint = () =>
        fixture.debugElement.query(By.css("bit-hint #importer-controls_button_keeper-resend-code"));
      const typeInto = async (value: string) => {
        codeInput().value = value;
        codeInput().dispatchEvent(new Event("input"));
        await settle();
      };
      const emailCodeLogin = (rejectedSecondTime = false) =>
        startLogin(async (ui) => {
          await ui.provideApprovalCode(DeviceApprovalChannel.Email);
          await ui.provideApprovalCode(DeviceApprovalChannel.Email, {
            previousCodeRejected: rejectedSecondTime,
          });
        });

      it("shows below the field, as its hint", async () => {
        await emailCodeLogin();

        expect(resendHint()).not.toBeNull();
        expect(text()).not.toContain("verificationCodeRequired");
      });

      it("is replaced by the inline error when an empty field is submitted", async () => {
        await emailCodeLogin();

        await component().submit();
        await settle();

        expect(text()).toContain("verificationCodeRequired");
        expect(byId("importer-controls_button_keeper-resend-code")).toBeNull();
      });

      it("returns as soon as the user starts typing again", async () => {
        await emailCodeLogin();
        await component().submit();
        await settle();
        expect(byId("importer-controls_button_keeper-resend-code")).toBeNull();

        await typeInto("1");

        expect(resendHint()).not.toBeNull();
        expect(text()).not.toContain("verificationCodeRequired");
      });

      it("is replaced by the inline error when the code was rejected, and returns when typing", async () => {
        await emailCodeLogin(true);
        await typeCode("000000");
        await settle();
        expect(text()).toContain("keeperLoginCodeInvalid");
        expect(byId("importer-controls_button_keeper-resend-code")).toBeNull();

        await typeInto("1");

        expect(resendHint()).not.toBeNull();
        expect(text()).not.toContain("keeperLoginCodeInvalid");
      });
    });

    // Resend only where a code may really be sent: email, a text message, or the Two-factor method
    // path, where Keeper doesn't say which method the account uses.
    it("offers Resend for a text message and for the unknown-method path, not an authenticator code", async () => {
      await startLogin(async (ui) => {
        await ui.provideTwoFactorCode(TwoFactorMethod.Sms, { canResend: true });
        await serverReply();
        await ui.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true, canResend: true });
        await serverReply();
        await ui.provideTwoFactorCode(TwoFactorMethod.Totp);
      });
      expect(text()).toContain("keeperLoginSmsDesc");
      expect(byId("importer-controls_button_keeper-resend-code")).toBeTruthy();

      await typeCode("123456");
      await reply();
      expect(text()).toContain("twoFactorCodePrompt");
      expect(byId("importer-controls_button_keeper-resend-code")).toBeTruthy();

      await typeCode("123456");
      await reply();
      expect(text()).toContain("keeperLoginAuthenticatorDesc");
      expect(byId("importer-controls_button_keeper-resend-code")).toBeNull();
    });

    it("Keeper DNA wait blocks Continue, and Back cancels the login", async () => {
      let answer: unknown;
      await startLogin(async (ui) => {
        answer = await ui.waitForDnaPush();
      });

      expect(text()).toContain("keeperLoginDnaSentDesc");
      expect(continueDisabled()).toBe(true);

      component().onBack();
      await settle();

      expect(answer).toBe(Cancel);
    });

    it("Back from the hidden Two-factor method code shows a fresh step 2, not the approval picker", async () => {
      const picked: unknown[] = [];
      const methods = [DeviceApprovalChannel.Email, DeviceApprovalChannel.TwoFactor];
      await startLogin(async (ui) => {
        picked.push(await ui.selectApprovalMethod(methods));
        picked.push(
          await ui.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true, canResend: true }),
        );
      });
      expect(text()).toContain("keeperLoginApprovalMethodDesc");

      loginControls().keeperApprovalMethod.setValue(DeviceApprovalChannel.TwoFactor);
      await component().submit();
      await settle();
      expect(text()).toContain("twoFactorCodePrompt");

      component().onBack();
      await settle();

      expect(picked).toEqual([DeviceApprovalChannel.TwoFactor, Cancel]);
      expect(text()).not.toContain("keeperLoginApprovalMethodDesc");
      expect(component().directStep()).toBe("intro");
    });

    it("an unsupported second factor shows an error toast and stays on the email and server, with no error on the email", async () => {
      await startLogin(async (ui) => {
        await ui.showError("keeperUnsupported2faMethod");
        throw new KeeperAuthError(KeeperAuthErrorCode.UnsupportedTwoFactorMethod, "none");
      });
      await component().keeperLogin();
      await settle();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "keeperLoginUnsupportedTwoFactor" }),
      );
      expect(component().directStep()).toBe("credentials");
      expect(isShown("importer-controls_input_keeper-email")).toBe(true);
      expect(controls().keeperEmail.value).toBe("user@example.com");
      expect(controls().keeperRegion.value).toBe(KeeperRegion.Us);
      expect(controls().keeperEmail.errors).toBeNull();
      expect(continueDisabled()).toBe(false);
    });

    it("an unsupported-method failure the card did not report still shows on the email", async () => {
      await startLogin(async () => {
        throw new KeeperAuthError(KeeperAuthErrorCode.UnsupportedTwoFactorMethod, "none");
      });
      await component().keeperLogin();
      await settle();

      expect(controls().keeperEmail.errors).toEqual({
        errors: { message: "keeperUnsupported2faMethod" },
      });
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });

  // The tests above echo i18n keys. These render with the real English strings and check the exact
  // text the Figma frames show, screen by screen.
  describe("copy on each screen, against the Figma frames", () => {
    type Message = { message: string; placeholders?: Record<string, { content: string }> };
    const messages: Record<string, Message> = JSON.parse(
      readFileSync(join(__dirname, "../../../../../apps/web/src/locales/en/messages.json"), "utf8"),
    );
    const real = (key: string, ...subs: string[]): string => {
      const entry = messages[key];
      if (entry === undefined) {
        throw new Error(`No en message for ${key}`);
      }
      return Object.entries(entry.placeholders ?? {}).reduce(
        (text, [name, { content }]) =>
          text.replace(
            new RegExp(`\\$${name.toUpperCase()}\\$`, "g"),
            subs[Number(content.slice(1)) - 1],
          ),
        entry.message,
      );
    };
    const withRealCopy = [
      {
        provide: I18nService,
        useValue: mock<I18nService>({ t: (key: string, ...s: string[]) => real(key, ...s) }),
      },
    ];
    const login = (script: (ui: Ui) => Promise<unknown>) =>
      startLogin(script, ClientType.Desktop, withRealCopy);
    const shows = (...expected: string[]) => expected.forEach((t) => expect(text()).toContain(t));

    it("credentials: logo title, default subtitle, labels, and the email errors", async () => {
      await mount(ClientType.Desktop, withRealCopy);
      shows(
        "Log in to Keeper",
        "Your credentials are encrypted in transit and never stored.",
        "Email",
        "Server",
        "Import manually instead",
        "Back",
        "Continue",
      );

      await component().submit();
      await settle();
      expect(controls().keeperEmail.errors.keeperEmailRequired.message).toBe("Email is required.");
      shows("Email is required.");

      await typeAndContinue("importer-controls_input_keeper-email", "not-an-email");
      expect(controls().keeperEmail.errors.keeperEmailInvalid.message).toBe(
        "Enter a valid email address.",
      );
      shows("Enter a valid email address.");
    });

    it("device approval picker: subtitle, group label and the four choices", async () => {
      await login(async (ui) => {
        await ui.selectApprovalMethod([
          DeviceApprovalChannel.Email,
          DeviceApprovalChannel.KeeperPush,
          DeviceApprovalChannel.TwoFactor,
          DeviceApprovalChannel.KeeperDna,
        ]);
      });
      shows(
        "Log in to Keeper",
        "Approve this device by selecting a method below.",
        "Device approval method",
        "Email",
        "Keeper Push",
        "Two-factor method",
        "Keeper DNA",
      );
      expect(text()).not.toContain("Your credentials are encrypted");
    });

    it("email code: subtitle, label, Resend, and both code errors", async () => {
      await login(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
        await serverReply();
        await ui.provideApprovalCode(DeviceApprovalChannel.Email, { previousCodeRejected: true });
      });
      shows(
        "Please check your email and enter the verification code below.",
        "Verification code",
        "Resend code",
      );

      await component().submit();
      await settle();
      shows("Verification code is required.");

      await typeCode("000000");
      await reply();
      shows("Enter a valid verification code.");
    });

    it("resending shows the toast text from Figma", async () => {
      await login(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });

      byId("importer-controls_button_keeper-resend-code").nativeElement.click();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "Resent verification code" }),
      );
    });

    it.each([
      [
        "authenticator app",
        (ui: Ui) => ui.provideTwoFactorCode(TwoFactorMethod.Totp),
        "Please enter the code from your authenticator app.",
        false,
      ],
      [
        "text message",
        (ui: Ui) => ui.provideTwoFactorCode(TwoFactorMethod.Sms, { canResend: true }),
        "Please enter the code sent as a text message.",
        true,
      ],
    ])("%s: subtitle and label, Resend: %s", async (_name, script, subtitle, resend) => {
      await login(async (ui) => {
        await script(ui);
      });

      shows(subtitle, "Verification code");
      expect(text().includes("Resend code")).toBe(resend);
    });

    it("Keeper Push wait: title, body, and a disabled Continue", async () => {
      await login(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      });

      shows(
        "Your credentials are encrypted in transit and never stored.",
        "Keeper Push sent",
        "Keeper Push notification sent to approved device.",
      );
      expect(continueDisabled()).toBe(true);
    });

    it("Keeper DNA wait: title, body, and a disabled Continue", async () => {
      await login(async (ui) => {
        await ui.selectApprovalMethod([
          DeviceApprovalChannel.TwoFactor,
          DeviceApprovalChannel.KeeperDna,
        ]);
        await ui.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true });
      });
      loginControls().keeperApprovalMethod.setValue(DeviceApprovalChannel.KeeperDna);
      await component().submit();
      await settle();

      shows(
        "Your credentials are encrypted in transit and never stored.",
        "Keeper DNA sent",
        "Approve the Keeper DNA notification on your device.",
      );
      expect(continueDisabled()).toBe(true);
    });

    it("admin approval wait: title and body", async () => {
      await login(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.AdminApproval);
      });

      shows("Admin approval requested", "We’ve sent an admin approval request to your admin.");
      expect(continueDisabled()).toBe(true);
    });

    it("master password: subtitle, label and both password errors", async () => {
      await login(async (ui) => {
        await ui.promptForPassword();
        await serverReply();
        await ui.promptForPassword({ previousPasswordRejected: true });
      });
      shows("Please enter your Keeper master password.", "Master password");

      await component().submit();
      await settle();
      shows("Password is required.");

      await typePassword("wrong");
      await reply();
      shows("Enter a valid password.");
    });

    it("Cancel request dialog: title, body and buttons use the Figma text", async () => {
      await login(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      });

      component().onBack();

      const options = dialogService.openSimpleDialog.mock.calls[0][0] as any;
      expect(real(options.title.key)).toBe("Cancel request");
      expect(real(options.content.key)).toBe(
        "Your approval request will be canceled. Are you sure you want to proceed?",
      );
      expect(real(options.acceptButtonText.key)).toBe("Cancel request");
      expect(real(options.cancelButtonText.key)).toBe("Close");
      expect(options.type).toBe("danger");
    });

    it("unsupported second factor: the toast carries the design's message", async () => {
      await login(async (ui) => {
        await ui.showError("keeperUnsupported2faMethod");
        throw new KeeperAuthError(KeeperAuthErrorCode.UnsupportedTwoFactorMethod, "none");
      });
      await component().keeperLogin();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          message: "Unsupported two-factor method. Switch methods or import manually.",
        }),
      );
    });
  });

  describe("email verification", () => {
    it("says the code was sent to the user's email, as the legacy dialog does", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });

      expect(text()).toContain("keeperLoginEmailCodeDesc");
    });

    it("requires a code, trims it, and sends it", async () => {
      let code: unknown;
      await startLogin(async (ui) => {
        code = await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });

      expect(byId("importer-controls_input_keeper-code")).toBeTruthy();
      await component().submit();
      expect(loginControls().keeperCode.errors.keeperCodeRequired.message).toBe(
        "verificationCodeRequired",
      );
      expect(code).toBeUndefined();

      loginControls().keeperCode.setValue(" 123456 ");
      await component().submit();
      await component().keeperLogin();

      expect(code).toBe("123456");
    });

    it("resends the code and tells the user", async () => {
      const prompts: unknown[] = [];
      await startLogin(async (ui) => {
        const first = await ui.provideApprovalCode(DeviceApprovalChannel.Email);
        prompts.push(first);
        if (first === Resend) {
          prompts.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
        }
      });

      byId("importer-controls_button_keeper-resend-code").nativeElement.click();
      await settle();

      expect(prompts[0]).toBe(Resend);
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "keeperLoginCodeResent" }),
      );

      loginControls().keeperCode.setValue("654321");
      await component().submit();
      await component().keeperLogin();
      expect(prompts[1]).toBe("654321");
    });

    it("shows a rejected code on the field, keeping what was entered", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
        await ui.provideApprovalCode(DeviceApprovalChannel.Email, { previousCodeRejected: true });
      });

      loginControls().keeperCode.setValue("bad");
      await component().submit();
      await settle();

      expect(loginControls().keeperCode.errors.keeperCodeRejected.message).toBe(
        "keeperLoginCodeInvalid",
      );
      expect(loginControls().keeperCode.touched).toBe(true);
      expect(loginControls().keeperCode.value).toBe("bad");
    });
  });

  describe("waiting states", () => {
    // Web and the extension load Tailwind's preflight, which gives every paragraph a 16px bottom
    // margin that `noMargin` doesn't remove. Figma's card ends 24px under the text, so the body
    // sets its margin explicitly and the title keeps its 12px.
    it("sets the margins under the title and body explicitly", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      });

      const [title, body] = fixture.debugElement
        .queryAll(By.css("importer-controls-keeper-login [role=status] p"))
        .map((el) => el.nativeElement as HTMLElement);

      expect(title.classList).toContain("tw-mb-3");
      expect(body.classList).toContain("tw-mb-0");
    });

    it.each([
      [
        "Keeper Push",
        DeviceApprovalChannel.KeeperPush,
        "keeperPushSent",
        "keeperLoginPushSentDesc",
      ],
      [
        "admin approval",
        DeviceApprovalChannel.AdminApproval,
        "adminApprovalRequested",
        "keeperLoginAdminRequestedDesc",
      ],
    ])(
      "%s shows a spinner and its message, disables Continue, and keeps Back active",
      async (_name, channel, title, body) => {
        await startLogin(async (ui) => {
          await ui.provideApprovalCode(channel);
        });

        expect(text()).toContain(title);
        expect(text()).toContain(body);
        expect(fixture.debugElement.query(By.css("bit-spinner"))).toBeTruthy();
        expect(continueDisabled()).toBe(true);
        expect(backDisabled()).toBe(false);
        expect(byId("importer-controls_button_import-manually-instead")).toBeTruthy();
      },
    );

    it("shows the Continue spinner right after Continue, before Keeper answers, and keeps the email form", async () => {
      keeperService.handleImport.mockReturnValue(new Promise(() => undefined));
      await mount(ClientType.Desktop);
      controls().keeperEmail.setValue("user@example.com");

      await component().submit();
      await settle();

      expect(continueBusy()).toBe(true);
      expect(text()).not.toContain("importingYourAccount");
      expect(continueDisabled()).toBe(true);
      expect(backDisabled()).toBe(false);
      expect(isShown("importer-controls_input_keeper-email")).toBe(true);
    });
  });

  describe("busy state", () => {
    it("keeps the code field on screen, locked and showing what was entered, while Continue shows the spinner", async () => {
      let release: () => void = () => undefined;
      const serverReplies = new Promise<void>((resolve) => {
        release = resolve;
      });
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
        await serverReplies;
      });
      const input = codeInput();

      await typeCode("123456");

      expect(continueBusy()).toBe(true);
      expect(codeInput()).toBe(input);
      expect(codeInput().value).toBe("123456");
      expect(codeInput().closest("[inert]")).not.toBeNull();
      expect(text()).toContain("keeperLoginEmailCodeDesc");
      expect(text()).not.toContain("importingYourAccount");

      release();
      await component().keeperLogin();
    });

    it("keeps the password field on screen while Continue shows the spinner", async () => {
      let release: () => void = () => undefined;
      const serverReplies = new Promise<void>((resolve) => {
        release = resolve;
      });
      await startLogin(async (ui) => {
        await ui.promptForPassword();
        await serverReplies;
      });

      await typePassword("hunter2");

      expect(continueBusy()).toBe(true);
      expect(byId("importer-controls_input_keeper-password")).toBeTruthy();
      expect(text()).toContain("keeperLoginPasswordDesc");
      expect(text()).not.toContain("importingYourAccount");

      release();
      await component().keeperLogin();
    });

    it("keeps the method picker on screen after Continue", async () => {
      let release: () => void = () => undefined;
      const serverReplies = new Promise<void>((resolve) => {
        release = resolve;
      });
      await startLogin(async (ui) => {
        await ui.selectApprovalMethod([
          DeviceApprovalChannel.Email,
          DeviceApprovalChannel.KeeperPush,
        ]);
        await serverReplies;
      });

      await component().submit();
      await settle();

      expect(continueBusy()).toBe(true);
      expect(byId("importer-controls_radio_keeper-approval-1")).toBeTruthy();

      release();
      await component().keeperLogin();
    });

    it("is not busy while waiting on a push, which keeps its own spinner card", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      });

      expect(continueBusy()).toBe(false);
      expect(text()).toContain("keeperPushSent");
      expect(continueDisabled()).toBe(true);
    });
  });

  describe("master password", () => {
    it("requires the password, shows a rejection, and clears the field after use", async () => {
      await startLogin(async (ui) => {
        await ui.promptForPassword();
        await ui.promptForPassword({ previousPasswordRejected: true });
      });

      expect(byId("importer-controls_input_keeper-password")).toBeTruthy();
      await component().submit();
      expect(loginControls().keeperPassword.errors.keeperPasswordRequired.message).toBe(
        "keeperLoginPasswordRequired",
      );

      loginControls().keeperPassword.setValue("hunter2");
      await component().submit();
      await settle();

      expect(loginControls().keeperPassword.errors.keeperPasswordRejected.message).toBe(
        "keeperLoginPasswordInvalid",
      );
      expect(loginControls().keeperPassword.value).toBe("");
    });
  });

  describe("cloud SSO", () => {
    it("asks desktop users to paste the token, with the help text behind the (?) icon", async () => {
      let token: unknown;
      await startLogin(async (ui) => {
        token = await ui.ssoLogin("https://keepersecurity.com/sso");
      });

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith("https://keepersecurity.com/sso");
      expect(byId("importer-controls_input_keeper-sso-token")).toBeTruthy();

      await component().submit();
      expect(loginControls().keeperSsoToken.touched).toBe(true);
      expect(token).toBeUndefined();

      loginControls().keeperSsoToken.setValue(" abc ");
      await component().submit();
      await component().keeperLogin();
      expect(token).toBe("abc");
    });

    it("shows only a spinner in the extension while the SSO tab captures the token", async () => {
      const monitor = mock<KeeperSsoTabMonitor>();
      monitor.launchAndWaitForToken.mockReturnValue(new Promise<string>(() => undefined));

      await startLogin(
        async (ui) => {
          await ui.ssoLogin("https://keepersecurity.com/sso");
        },
        ClientType.Browser,
        [{ provide: KEEPER_SSO_TAB_MONITOR, useValue: monitor }],
      );

      expect(monitor.launchAndWaitForToken).toHaveBeenCalled();
      expect(byId("importer-controls_input_keeper-sso-token")).toBeNull();
      expect(fixture.debugElement.query(By.css("bit-spinner"))).toBeTruthy();
      expect(continueDisabled()).toBe(true);
    });
  });

  describe("second factor and errors", () => {
    it("lets Continue confirm a push-style second factor", async () => {
      let answer: unknown;
      await startLogin(async (ui) => {
        answer = await ui.provideTwoFactorCode(TwoFactorMethod.KeeperPush);
      });

      expect(text()).toContain("mfaPushDesc");
      expect(continueDisabled()).toBe(false);

      await component().submit();
      await component().keeperLogin();
      expect(answer).toBe("");
    });

    it("returns to the email form with the login error when Keeper rejects the login", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
        throw new KeeperAuthError(KeeperAuthErrorCode.MfaFailed, "mfa failed");
      });

      loginControls().keeperCode.setValue("123456");
      await component().submit();
      await component().keeperLogin();
      fixture.detectChanges();

      expect(controls().keeperEmail.errors).toEqual({
        errors: { message: "multifactorAuthenticationFailed" },
      });
      expect(isShown("importer-controls_input_keeper-email")).toBe(true);
      expect(continueDisabled()).toBe(false);
    });
  });

  describe("leaving mid-login", () => {
    const cancelledByClient = async (ui: Ui, outcome: { value?: unknown }) => {
      outcome.value = await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      if (outcome.value === Cancel) {
        throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
      }
    };

    it("Close on the cancel dialog keeps waiting for the Keeper Push approval", async () => {
      const outcome: { value?: unknown } = {};
      dialogService.openSimpleDialog.mockResolvedValue(false);
      await startLogin((ui) => cancelledByClient(ui, outcome));

      component().onBack();
      component().toggleToManual();
      await settle();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(2);
      expect(outcome.value).toBeUndefined();
      expect(text()).toContain("keeperPushSent");
      expect(component().primaryMode()).toBe("direct");
    });

    // The push is approved on the device while the cancel dialog is still open.
    const approvedWhileDialogOpen = async (next: (ui: Ui) => Promise<unknown>) => {
      let approve: () => void = () => undefined;
      const approved = new Promise<void>((resolve) => {
        approve = resolve;
      });
      let confirm: (value: boolean) => void = () => undefined;
      dialogService.openSimpleDialog.mockReturnValue(
        new Promise<boolean>((resolve) => {
          confirm = resolve;
        }),
      );
      const outcome: { value?: unknown } = {};
      await startLogin(async (ui) => {
        await Promise.race([ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush), approved]);
        outcome.value = await next(ui);
        if (outcome.value === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
      });

      component().onBack();
      approve();
      await settle();
      return { confirm: async (value: boolean) => (confirm(value), await settle()), outcome };
    };

    it("Cancel request does nothing once the approval has started the import", async () => {
      importService.importImportResult.mockReturnValue(new Promise<ImportResult>(() => undefined));
      const { confirm } = await approvedWhileDialogOpen(async () => undefined);
      expect(continueBusy()).toBe(true);

      await confirm(true);

      expect(continueBusy()).toBe(true);
      expect(continueDisabled()).toBe(true);
      expect(component().directStep()).toBe("credentials");
    });

    it("Cancel request still cancels when the approval moved the login to the password", async () => {
      const { confirm, outcome } = await approvedWhileDialogOpen((ui) => ui.promptForPassword());
      expect(text()).toContain("keeperLoginPasswordDesc");

      await confirm(true);
      await component().keeperLogin();

      expect(outcome.value).toBe(Cancel);
      expect(component().directStep()).toBe("intro");
    });

    it("Back asks first on a Keeper Push wait, then cancels and shows a fresh step 2", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin((ui) => cancelledByClient(ui, outcome));
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "cancelRequest" },
          content: { key: "keeperLoginCancelRequestDesc" },
          type: "danger",
        }),
      );
      expect(outcome.value).toBe(Cancel);
      expect(back).not.toHaveBeenCalled();
      expect(component().directStep()).toBe("intro");
      expect(controls().keeperEmail.errors).toBeNull();
      expect(dialogService.open).not.toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(importService.importImportResult).not.toHaveBeenCalled();
    });

    it("Back during admin approval cancels the request without asking", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin(async (ui) => {
        outcome.value = await ui.provideApprovalCode(DeviceApprovalChannel.AdminApproval);
        if (outcome.value === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
      });
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(back).not.toHaveBeenCalled();
      expect(outcome.value).toBe(Cancel);
      expect(controls().keeperEmail.errors).toBeNull();
    });

    it("Import manually instead cancels the login and opens the file flow", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin((ui) => cancelledByClient(ui, outcome));

      byId("importer-controls_button_import-manually-instead").nativeElement.click();
      await settle();
      await component().keeperLogin();

      expect(outcome.value).toBe(Cancel);
      expect(component().primaryMode()).toBe("manual");
      expect(controls().keeperEmail.errors).toBeNull();
    });

    it("can't be left once the vault is being written, and the import completes", async () => {
      let finishImport: () => void = () => undefined;
      importService.importImportResult.mockReturnValue(
        new Promise<ImportResult>((resolve) => {
          finishImport = () => resolve(result);
        }),
      );
      await startLogin(async () => undefined);
      const back = jest.fn();
      const continued = jest.fn();
      component().back.subscribe(back);
      component().continue.subscribe(continued);

      expect(continueBusy()).toBe(true);
      expect(backDisabled()).toBe(true);
      expect(isDisabled("importer-controls_button_import-manually-instead")).toBe(true);
      expect(continueDisabled()).toBe(true);

      component().onBack();
      component().toggleToManual();
      await settle();
      expect(back).not.toHaveBeenCalled();
      expect(component().primaryMode()).toBe("direct");

      finishImport();
      await settle();
      await component().keeperLogin();

      expect(importService.importImportResult).toHaveBeenCalledTimes(1);
      expect(continued).toHaveBeenCalledTimes(1);
      expect(backDisabled()).toBe(false);
    });

    it("does not import a login that finishes after the user left", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      });

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(importService.importImportResult).not.toHaveBeenCalled();
    });

    it("cancels a pending prompt when the component is destroyed", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin((ui) => cancelledByClient(ui, outcome));

      fixture.destroy();
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      expect(outcome.value).toBe(Cancel);
    });
  });

  // Figma acceptance criteria: Back never lands on a page inside step 2. From any page reached
  // after step 2's first one it shows a fresh step 2, and only from the first page does it leave.
  describe("Back button clicked from the master password page", () => {
    it("starts step 2 over, even after the empty field was blurred", async () => {
      await startLogin(async (ui) => {
        await ui.promptForPassword();
      });
      const back = jest.fn();
      component().back.subscribe(back);
      const password = byId("importer-controls_input_keeper-password").nativeElement;
      password.focus();
      password.dispatchEvent(new Event("blur"));
      fixture.detectChanges();

      byId("importer-controls_button_back").nativeElement.click();
      await settle();

      expect(component().directStep()).toBe("intro");
      expect(byId("importer-controls_input_keeper-password")).toBeNull();
      expect(back).not.toHaveBeenCalled();
    });

    it.each(["importer-controls_button_back", "importer-controls_button_import-manually-instead"])(
      "%s doesn't take focus from the field on mousedown, so the footer can't jump",
      async (id) => {
        await startLogin(async (ui) => {
          await ui.promptForPassword();
        });

        const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        byId(id).nativeElement.dispatchEvent(mousedown);

        expect(mousedown.defaultPrevented).toBe(true);
      },
    );

    it("Resend code doesn't take focus from the empty code field on mousedown", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });

      const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
      byId("importer-controls_button_keeper-resend-code").nativeElement.dispatchEvent(mousedown);

      expect(mousedown.defaultPrevented).toBe(true);
    });
  });

  describe("Back starts step 2 over", () => {
    // The third column: whether Back asks first, which it does only where a request was sent to
    // the user's device.
    const stageScripts: Array<[string, (ui: Ui) => Promise<unknown>, boolean]> = [
      ["a method picker", (ui) => ui.selectApprovalMethod([1, 2]), false],
      ["the email code", (ui) => ui.provideApprovalCode(DeviceApprovalChannel.Email), false],
      [
        "a Keeper Push wait",
        (ui) => ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush),
        true,
      ],
      ["a Keeper DNA wait", (ui) => ui.waitForDnaPush(), true],
      [
        "an admin approval wait",
        (ui) => ui.provideApprovalCode(DeviceApprovalChannel.AdminApproval),
        false,
      ],
      ["an authenticator code", (ui) => ui.provideTwoFactorCode(TwoFactorMethod.Totp), false],
      ["the master password", (ui) => ui.promptForPassword(), false],
    ];

    it.each(stageScripts)(
      "from %s: cancels the login and shows an empty first page, without leaving step 2",
      async (_name, script, asks) => {
        const outcome: { value?: unknown } = {};
        await startLogin(async (ui) => {
          outcome.value = await script(ui);
          if (outcome.value === Cancel) {
            throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
          }
        });
        const back = jest.fn();
        component().back.subscribe(back);

        component().onBack();
        await settle();
        await component().keeperLogin();

        expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(asks ? 1 : 0);
        expect(outcome.value).toBe(Cancel);
        expect(back).not.toHaveBeenCalled();
        expect(component().directStep()).toBe("intro");
        expect(controls().keeperEmail.value).toBe("");
        expect(controls().keeperEmail.errors).toBeNull();
        expect(importService.importImportResult).not.toHaveBeenCalled();
      },
    );

    it("from the fresh first page, leaves for step 1", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      expect(back).not.toHaveBeenCalled();

      component().onBack();
      expect(back).toHaveBeenCalledTimes(1);
    });

    it("from the credentials page: shows the first page, with nothing typed", async () => {
      await mount(ClientType.Desktop);
      controls().keeperEmail.setValue("user@example.com");
      controls().keeperRegion.setValue(KeeperRegion.Eu);
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();

      expect(back).not.toHaveBeenCalled();
      expect(component().directStep()).toBe("intro");
      expect(controls().keeperEmail.value).toBe("");
      expect(controls().keeperRegion.value).toBe(KeeperRegion.Us);
    });
  });

  describe("keyboard focus", () => {
    const focusedId = () => document.activeElement?.id;

    it("moves focus to the verification code field when that prompt appears", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });

      expect(focusedId()).toBe("importer-controls_input_keeper-code");
    });

    it("moves focus to the chosen radio when a method picker appears", async () => {
      await startLogin(async (ui) => {
        await ui.selectApprovalMethod([
          DeviceApprovalChannel.Email,
          DeviceApprovalChannel.KeeperPush,
        ]);
      });

      const focused = document.activeElement as HTMLInputElement;
      expect(focused.type).toBe("radio");
      expect(focused.checked).toBe(true);
    });

    it("moves focus to the status message while waiting, not to the disabled Continue", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      });

      expect(document.activeElement?.getAttribute("role")).toBe("status");
      expect(focusedId()).not.toBe("importer-controls_button_continue");
    });

    it("moves focus to the password field", async () => {
      await startLogin(async (ui) => {
        await ui.promptForPassword();
      });

      expect(focusedId()).toBe("importer-controls_input_keeper-password");
    });

    it("returns focus to the Email field when a failed login brings the form back", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
        throw new KeeperAuthError(KeeperAuthErrorCode.MfaFailed, "mfa failed");
      });

      loginControls().keeperCode.setValue("123456");
      await component().submit();
      await component().keeperLogin();
      await settle();

      expect(focusedId()).toBe("importer-controls_input_keeper-email");
    });
  });
});

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
  Resend,
  TryAnother,
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

      expect(text()).toContain("totpCodePrompt");
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
    // between a submit and the server's answer, which removes and re-creates the code field.
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
      expect(text()).toContain("importingYourAccount");
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
      await component().submit();
      await settle();
    };
    const typeCode = (value: string) =>
      typeAndContinue("importer-controls_input_keeper-code", value);
    const typePassword = (value: string) =>
      typeAndContinue("importer-controls_input_keeper-password", value);
    const codeInput = () =>
      byId("importer-controls_input_keeper-code").nativeElement as HTMLInputElement;

    beforeEach(() => {
      replies = [];
    });

    it("email code rejected, then accepted", async () => {
      const answers: unknown[] = [];
      await startLogin(async (ui) => {
        answers.push(await ui.provideApprovalCode(DeviceApprovalChannel.Email));
        await serverReply();
        answers.push(
          await ui.provideApprovalCode(DeviceApprovalChannel.Email, { previousCodeRejected: true }),
        );
      });
      expect(text()).toContain("approvalEmailDesc");

      await typeCode("000000");
      expect(text()).toContain("importingYourAccount");
      await reply();

      expect(text()).toContain("approvalEmailDesc");
      expect(text()).toContain("keeperLoginCodeInvalid");
      expect(codeInput().value).toBe("");

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
      expect(text()).toContain("totpCodePrompt");
      expect(text()).not.toContain("approvalEmailDesc");
      expect(text()).not.toContain("verificationCodeRequired");

      await typeCode("222222");
      await reply();
      expect(text()).toContain("keeperMasterPasswordPrompt");
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
      expect(text()).toContain("totpCodePrompt");
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
      expect(text()).toContain("approvalEmailDesc");
      expect(text()).not.toContain("keeperLoginCodeInvalid");
      expect(codeInput().value).toBe("");
    });

    it("text message code offers Resend; authenticator code does not", async () => {
      await startLogin(async (ui) => {
        await ui.provideTwoFactorCode(TwoFactorMethod.Sms, { canResend: true });
        await serverReply();
        await ui.provideTwoFactorCode(TwoFactorMethod.Totp);
      });
      expect(text()).toContain("smsCodePrompt");
      expect(byId("importer-controls_button_keeper-resend-code")).toBeTruthy();

      await typeCode("123456");
      await reply();

      expect(text()).toContain("totpCodePrompt");
      expect(byId("importer-controls_button_keeper-resend-code")).toBeNull();
    });

    it("Keeper DNA wait blocks Continue, and Back cancels the login", async () => {
      let answer: unknown;
      await startLogin(async (ui) => {
        answer = await ui.waitForDnaPush();
      });

      expect(text()).toContain("keeperDnaPushWaiting");
      expect(continueDisabled()).toBe(true);

      component().onBack();
      await settle();

      expect(answer).toBe(Cancel);
    });

    it("admin approval wait asks before Back cancels the request", async () => {
      let answer: unknown;
      dialogService.openSimpleDialog.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      await startLogin(async (ui) => {
        answer = await ui.provideApprovalCode(DeviceApprovalChannel.AdminApproval);
      });
      expect(text()).toContain("keeperLoginAdminRequestedDesc");

      component().onBack();
      await settle();
      expect(answer).toBeUndefined();

      component().onBack();
      await settle();
      expect(answer).toBe(Cancel);
    });

    it("Back from the hidden Two-factor method code returns to the approval picker", async () => {
      const picked: unknown[] = [];
      const methods = [DeviceApprovalChannel.Email, DeviceApprovalChannel.TwoFactor];
      await startLogin(async (ui) => {
        picked.push(await ui.selectApprovalMethod(methods));
        picked.push(
          await ui.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true, canResend: true }),
        );
        picked.push(await ui.selectApprovalMethod(methods));
      });
      expect(text()).toContain("selectApprovalMethodDesc");

      loginControls().keeperApprovalMethod.setValue(DeviceApprovalChannel.TwoFactor);
      await component().submit();
      await settle();
      expect(text()).toContain("twoFactorCodePrompt");

      component().onBack();
      await settle();

      expect(picked).toEqual([DeviceApprovalChannel.TwoFactor, TryAnother]);
      expect(text()).toContain("selectApprovalMethodDesc");
    });

    it("an unsupported second factor shows Keeper's error, then the failure on the email field", async () => {
      await startLogin(async (ui) => {
        await ui.showError("keeperUnsupported2faMethod");
        throw new KeeperAuthError(KeeperAuthErrorCode.UnsupportedTwoFactorMethod, "none");
      });
      expect(text()).toContain("keeperUnsupported2faMethod");

      await component().submit();
      await component().keeperLogin();
      await settle();

      expect(controls().keeperEmail.errors.errors.message).toBe("keeperUnsupported2faMethod");
      expect(isShown("importer-controls_input_keeper-email")).toBe(true);
    });
  });

  describe("email verification", () => {
    it("says the code was sent to the user's email, as the legacy dialog does", async () => {
      await startLogin(async (ui) => {
        await ui.provideApprovalCode(DeviceApprovalChannel.Email);
      });

      expect(text()).toContain("approvalEmailDesc");
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

    it("shows a rejected code on the field and starts the next prompt empty", async () => {
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
      expect(loginControls().keeperCode.value).toBe("");
    });
  });

  describe("waiting states", () => {
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

    it("shows the spinner right after Continue, before Keeper answers, without a button spinner", async () => {
      keeperService.handleImport.mockReturnValue(new Promise(() => undefined));
      await mount(ClientType.Desktop);
      controls().keeperEmail.setValue("user@example.com");

      await component().submit();
      await settle();

      expect(text()).toContain("importingYourAccount");
      expect(continueDisabled()).toBe(true);
      expect(backDisabled()).toBe(false);
      expect(isShown("importer-controls_input_keeper-email")).toBe(false);
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

    it("shows an unsupported-method error in the card, then returns to the form with the message", async () => {
      await startLogin(async (ui) => {
        await ui.showError("keeperUnsupported2faMethod");
        throw new KeeperAuthError(KeeperAuthErrorCode.UnsupportedTwoFactorMethod, "unsupported");
      });

      expect(byId("importer-controls_callout_keeper-error")).toBeTruthy();

      await component().submit();
      await component().keeperLogin();
      fixture.detectChanges();

      expect(controls().keeperEmail.errors).toEqual({
        errors: { message: "keeperUnsupported2faMethod" },
      });
      expect(isShown("importer-controls_input_keeper-email")).toBe(true);
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

    it("Back cancels a pending Keeper Push login without asking, and leaves quietly", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin((ui) => cancelledByClient(ui, outcome));
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(outcome.value).toBe(Cancel);
      expect(back).toHaveBeenCalledTimes(1);
      expect(controls().keeperEmail.errors).toBeNull();
      expect(dialogService.open).not.toHaveBeenCalledWith(
        ImportErrorDialogComponent,
        expect.anything(),
      );
      expect(importService.importImportResult).not.toHaveBeenCalled();
    });

    it("Back during admin approval asks first: Close keeps waiting, Cancel request leaves", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin(async (ui) => {
        outcome.value = await ui.provideApprovalCode(DeviceApprovalChannel.AdminApproval);
        if (outcome.value === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
      });
      const back = jest.fn();
      component().back.subscribe(back);

      dialogService.openSimpleDialog.mockResolvedValue(false);
      component().onBack();
      await settle();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          title: { key: "approvalRequestWillBeCanceled" },
          content: { key: "pendingApprovalCancelConfirmation" },
          acceptButtonText: { key: "cancelRequest" },
          cancelButtonText: { key: "close" },
          type: "danger",
        }),
      );
      expect(back).not.toHaveBeenCalled();
      expect(outcome.value).toBeUndefined();
      expect(text()).toContain("adminApprovalRequested");

      dialogService.openSimpleDialog.mockResolvedValue(true);
      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(back).toHaveBeenCalledTimes(1);
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

      expect(text()).toContain("importingYourAccount");
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

  describe("Back to the method picker", () => {
    const approvalChannels = [
      DeviceApprovalChannel.Email,
      DeviceApprovalChannel.KeeperPush,
      DeviceApprovalChannel.AdminApproval,
    ];

    /** Mirrors the client's loop: re-offers the picker whenever the user asks to try another. */
    const pickerLoop = (log: unknown[]) => async (ui: Ui) => {
      for (;;) {
        const method = await ui.selectApprovalMethod(approvalChannels);
        log.push(["picked", method]);
        if (method === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
        const answer = await ui.provideApprovalCode(method);
        log.push(["answered", answer]);
        if (answer === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
        if (answer !== TryAnother) {
          return;
        }
      }
    };

    const chooseMethod = async (method: DeviceApprovalChannel) => {
      loginControls().keeperApprovalMethod.setValue(method);
      await component().submit();
      await settle();
    };

    it("Back on a method's own screen returns to the picker instead of leaving", async () => {
      const log: unknown[] = [];
      await startLogin(pickerLoop(log));
      const back = jest.fn();
      component().back.subscribe(back);

      await chooseMethod(DeviceApprovalChannel.KeeperPush);
      expect(text()).toContain("keeperPushSent");

      component().onBack();
      await settle();

      expect(back).not.toHaveBeenCalled();
      expect(log).toContainEqual(["answered", TryAnother]);
      expect(byId("importer-controls_radio_keeper-approval-1")).toBeTruthy();
      expect(text()).toContain("keeperLoginApprovalMethod");
    });

    it("lets the user then pick another method", async () => {
      const log: unknown[] = [];
      await startLogin(pickerLoop(log));
      await chooseMethod(DeviceApprovalChannel.KeeperPush);

      component().onBack();
      await settle();
      await chooseMethod(DeviceApprovalChannel.Email);

      expect(log).toContainEqual(["picked", DeviceApprovalChannel.Email]);
      expect(byId("importer-controls_input_keeper-code")).toBeTruthy();
    });

    it("Back on the picker itself leaves to the previous screen and cancels the login", async () => {
      const log: unknown[] = [];
      await startLogin(pickerLoop(log));
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(back).toHaveBeenCalledTimes(1);
      expect(log).toContainEqual(["picked", Cancel]);
      expect(controls().keeperEmail.errors).toBeNull();
    });

    it("Back on the admin screen asks first, and only steps back once confirmed", async () => {
      const log: unknown[] = [];
      await startLogin(pickerLoop(log));
      await chooseMethod(DeviceApprovalChannel.AdminApproval);
      const back = jest.fn();
      component().back.subscribe(back);

      dialogService.openSimpleDialog.mockResolvedValue(false);
      component().onBack();
      await settle();
      expect(dialogService.openSimpleDialog).toHaveBeenCalled();
      expect(log).not.toContainEqual(["answered", TryAnother]);
      expect(text()).toContain("adminApprovalRequested");

      dialogService.openSimpleDialog.mockResolvedValue(true);
      component().onBack();
      await settle();

      expect(log).toContainEqual(["answered", TryAnother]);
      expect(back).not.toHaveBeenCalled();
      expect(text()).toContain("keeperLoginApprovalMethod");
    });

    it("Back leaves when Keeper picked the only approval method for the user", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin(async (ui) => {
        const method = await ui.selectApprovalMethod([DeviceApprovalChannel.Email]);
        outcome.value = await ui.provideApprovalCode(method as DeviceApprovalChannel);
        if (outcome.value === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
      });
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(back).toHaveBeenCalledTimes(1);
      expect(outcome.value).toBe(Cancel);
    });

    it("Back leaves from a code screen when the account has only one second factor", async () => {
      const outcome: { value?: unknown } = {};
      await startLogin(async (ui) => {
        const method = await ui.selectTwoFactorMethod([TwoFactorMethod.Totp]);
        outcome.value = await ui.provideTwoFactorCode(method as TwoFactorMethod);
        if (outcome.value === Cancel) {
          throw new KeeperAuthError(KeeperAuthErrorCode.Cancelled, "cancelled");
        }
      });
      const back = jest.fn();
      component().back.subscribe(back);

      component().onBack();
      await settle();
      await component().keeperLogin();

      expect(back).toHaveBeenCalledTimes(1);
      expect(outcome.value).toBe(Cancel);
    });

    it("steps back from a code screen to the 2FA picker when the account has several", async () => {
      const log: unknown[] = [];
      await startLogin(async (ui) => {
        for (;;) {
          const method = await ui.selectTwoFactorMethod([
            TwoFactorMethod.Totp,
            TwoFactorMethod.Sms,
          ]);
          const answer = await ui.provideTwoFactorCode(method as TwoFactorMethod);
          log.push(answer);
          if (answer !== TryAnother) {
            return;
          }
        }
      });
      const back = jest.fn();
      component().back.subscribe(back);

      loginControls().keeperTwoFactorMethod.setValue(TwoFactorMethod.Sms);
      await component().submit();
      await settle();
      component().onBack();
      await settle();

      expect(log).toEqual([TryAnother]);
      expect(back).not.toHaveBeenCalled();
      expect(text()).toContain("selectTwoFactorMethod");
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

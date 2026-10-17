import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  Cancel,
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  Resend,
  TwoFactorMethod,
} from "../../../../importers/keeper/access";
import {
  KEEPER_SSO_TAB_MONITOR,
  KeeperSsoTabMonitor,
} from "../../../keeper/services/keeper-sso-tab-monitor";

import { KeeperInlineAuthUi } from "./keeper-inline-auth-ui";

describe("KeeperInlineAuthUi", () => {
  let ssoTabMonitor: MockProxy<KeeperSsoTabMonitor>;
  let toastService: MockProxy<ToastService>;
  let dialogService: MockProxy<DialogService>;

  const create = (clientType: ClientType = ClientType.Desktop): KeeperInlineAuthUi => {
    TestBed.resetTestingModule();
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getClientType.mockReturnValue(clientType);
    TestBed.configureTestingModule({
      providers: [
        KeeperInlineAuthUi,
        { provide: ToastService, useValue: toastService },
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: KEEPER_SSO_TAB_MONITOR, useValue: ssoTabMonitor },
      ],
    });
    return TestBed.inject(KeeperInlineAuthUi);
  };

  beforeEach(() => {
    toastService = mock<ToastService>();
    dialogService = mock<DialogService>();
    ssoTabMonitor = mock<KeeperSsoTabMonitor>();
    ssoTabMonitor.launchAndWaitForToken.mockReturnValue(new Promise<string>(() => undefined));
  });

  describe("controller", () => {
    it("starts idle, and begin() shows the loading stage with a fresh session", () => {
      const ui = create();
      expect(ui.stage()).toEqual({ kind: "idle" });

      const session = ui.begin();

      expect(ui.stage()).toEqual({ kind: "loading" });
      expect(session.userLeft).toBe(false);
      expect(ui.session).toBe(session);
    });

    it("creates a session on first use when nothing began one", () => {
      const ui = create();

      expect(ui.session).toBe(ui.session);
      expect(ui.stage()).toEqual({ kind: "idle" });
    });

    it("leave() clears the card at once while a request is still in flight", () => {
      const ui = create();
      const session = ui.begin();
      expect(ui.stage()).toEqual({ kind: "loading" });

      ui.leave();

      expect(session.userLeft).toBe(true);
      expect(ui.stage()).toEqual({ kind: "idle" });
      expect(ui.waiting()).toBe(false);
      expect(ui.loginActive()).toBe(false);
    });

    it("a left login can't show a prompt or blank the login that follows it", async () => {
      const ui = create();
      const left = ui.begin();
      ui.leave();
      const next = ui.begin();
      void next.provideApprovalCode(DeviceApprovalChannel.Email);

      await left.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      ui.end(left);

      expect(ui.stage()).toEqual(
        expect.objectContaining({ kind: "approvalCode", variant: "email" }),
      );
    });

    it("end() returns the card to idle", () => {
      const ui = create();
      const session = ui.begin();

      ui.end(session);

      expect(ui.stage()).toEqual({ kind: "idle" });
    });

    it("beginImport() on the session shows the importing stage", () => {
      const ui = create();
      const session = ui.begin();

      session.beginImport();

      expect(ui.stage()).toEqual({ kind: "importing" });
    });

    it("delegates submit and resend to the current session", async () => {
      const ui = create();
      const session = ui.begin();

      const code = session.provideApprovalCode(DeviceApprovalChannel.Email);
      ui.submit("123456");
      await expect(code).resolves.toBe("123456");

      const resend = session.provideApprovalCode(DeviceApprovalChannel.Email);
      ui.resend();
      await expect(resend).resolves.toBe(Resend);
    });

    it("leave() cancels the current session", async () => {
      const ui = create();
      const session = ui.begin();
      const selected = session.selectApprovalMethod([1, 2]);

      ui.leave();

      await expect(selected).resolves.toBe(Cancel);
      expect(session.userLeft).toBe(true);
    });
  });

  describe("one session per login", () => {
    it("begin() cancels the previous login's open prompt and flags it as left", async () => {
      const ui = create();
      const first = ui.begin();
      const selected = first.selectApprovalMethod([1, 2]);

      const second = ui.begin();

      await expect(selected).resolves.toBe(Cancel);
      expect(first.userLeft).toBe(true);
      expect(second.userLeft).toBe(false);
    });

    it("a cancelled login's later prompts return Cancel and never reach the card", async () => {
      const ui = create();
      const first = ui.begin();
      const second = ui.begin();

      await expect(first.provideApprovalCode(DeviceApprovalChannel.Email)).resolves.toBe(Cancel);
      await expect(first.promptForPassword()).resolves.toBe(Cancel);

      expect(ui.stage()).toEqual({ kind: "loading" });
      void second.promptForPassword();
      expect(ui.stage().kind).toBe("password");
    });

    it("a superseded login can't change what the new login shows, even if it forces a stage", () => {
      const ui = create();
      const first = ui.begin();
      void ui.begin().promptForPassword();

      first.beginImport();

      expect(ui.stage().kind).toBe("password");
    });

    it("ending a superseded login doesn't blank the login that replaced it", () => {
      const ui = create();
      const first = ui.begin();
      void ui.begin().promptForPassword();

      ui.end(first);

      expect(ui.stage().kind).toBe("password");
    });

    it("a left login's SSO wait doesn't leak into the next login", async () => {
      ssoTabMonitor.launchAndWaitForToken.mockResolvedValue("token");
      const ui = create(ClientType.Browser);
      const first = ui.begin();
      first.leave();
      const second = ui.begin();

      await expect(first.ssoLogin("https://keepersecurity.com/sso")).resolves.toBe(Cancel);

      expect(ssoTabMonitor.launchAndWaitForToken).not.toHaveBeenCalled();
      expect(second.userLeft).toBe(false);
    });
  });

  describe("device approval", () => {
    it("cancels when Keeper offers no approval method", async () => {
      const session = create().begin();

      await expect(session.selectApprovalMethod([])).resolves.toBe(Cancel);
    });

    it("picks the only approval method without showing a prompt", async () => {
      const ui = create();
      const session = ui.begin();

      await expect(session.selectApprovalMethod([DeviceApprovalChannel.Email])).resolves.toBe(
        DeviceApprovalChannel.Email,
      );
      expect(ui.stage()).toEqual({ kind: "loading" });
    });

    it("shows the method picker and resolves with the submitted method, then waits", async () => {
      const ui = create();
      const session = ui.begin();
      const methods = [DeviceApprovalChannel.Email, DeviceApprovalChannel.KeeperPush];

      const selected = session.selectApprovalMethod(methods);
      expect(ui.stage()).toEqual({ kind: "selectApproval", methods });

      session.submit(DeviceApprovalChannel.KeeperPush);

      await expect(selected).resolves.toBe(DeviceApprovalChannel.KeeperPush);
      expect(ui.stage()).toEqual({ kind: "loading" });
    });

    it.each([
      [DeviceApprovalChannel.Email, "email"],
      [DeviceApprovalChannel.KeeperPush, "push"],
      [DeviceApprovalChannel.TwoFactor, "push"],
      [DeviceApprovalChannel.AdminApproval, "admin"],
    ])("shows approval channel %s as the %s variant", (method, variant) => {
      const ui = create();
      const session = ui.begin();

      void session.provideApprovalCode(method, { previousCodeRejected: true });

      expect(ui.stage()).toEqual({
        kind: "approvalCode",
        method,
        variant,
        previousCodeRejected: true,
      });
    });

    it("keeps the prompt showing after Resend so the code field stays put", () => {
      const ui = create();
      const session = ui.begin();
      void session.provideApprovalCode(DeviceApprovalChannel.Email);

      session.resend();

      expect(ui.stage().kind).toBe("approvalCode");
    });
  });

  describe("two-factor, Duo and Keeper DNA", () => {
    it("needs input for code methods and none for push-style methods", () => {
      const ui = create();
      const session = ui.begin();

      void session.provideTwoFactorCode(TwoFactorMethod.Totp, { canResend: true });
      expect(ui.stage()).toMatchObject({
        kind: "twoFactorCode",
        needsInput: true,
        canResend: true,
      });

      void session.provideTwoFactorCode(TwoFactorMethod.KeeperPush);
      expect(ui.stage()).toMatchObject({ kind: "twoFactorCode", needsInput: false });
    });

    it("auto-picks a single 2FA, Duo or DNA method and cancels on none", async () => {
      const session = create().begin();

      await expect(session.selectTwoFactorMethod([TwoFactorMethod.Totp])).resolves.toBe(
        TwoFactorMethod.Totp,
      );
      await expect(session.selectDuoMethod([DuoMethod.Push], "+1")).resolves.toBe(DuoMethod.Push);
      await expect(session.selectDnaMethod([DnaMethod.Code])).resolves.toBe(DnaMethod.Code);
      await expect(session.selectTwoFactorMethod([])).resolves.toBe(Cancel);
      await expect(session.selectDuoMethod([], "+1")).resolves.toBe(Cancel);
      await expect(session.selectDnaMethod([])).resolves.toBe(Cancel);
    });

    it("shows Duo and DNA pickers", () => {
      const ui = create();
      const session = ui.begin();

      void session.selectDuoMethod([DuoMethod.Push, DuoMethod.Sms], "+1 555");
      expect(ui.stage()).toEqual({
        kind: "selectDuo",
        methods: [DuoMethod.Push, DuoMethod.Sms],
        phoneNumber: "+1 555",
      });

      void session.selectDnaMethod([DnaMethod.Push, DnaMethod.Code]);
      expect(ui.stage()).toEqual({
        kind: "selectDna",
        methods: [DnaMethod.Push, DnaMethod.Code],
      });
    });

    it("waits on a Duo or DNA push", async () => {
      const ui = create();
      const session = ui.begin();

      const duo = session.waitForDuoPush(DuoMethod.Push);
      expect(ui.stage()).toEqual({ kind: "duoPush", method: DuoMethod.Push });
      session.submit("");
      await expect(duo).resolves.toBeUndefined();

      const dna = session.waitForDnaPush();
      expect(ui.stage()).toEqual({ kind: "dnaPush" });
      session.leave();
      await expect(dna).resolves.toBe(Cancel);
    });
  });

  describe("master password and errors", () => {
    it("prompts for the password and reports a previous rejection", async () => {
      const ui = create();
      const session = ui.begin();

      const password = session.promptForPassword({ previousPasswordRejected: true });
      expect(ui.stage()).toEqual({ kind: "password", previousPasswordRejected: true });
      session.submit("hunter2");

      await expect(password).resolves.toBe("hunter2");
    });

    it("reports an error as a toast, starts over, and doesn't wait on the user", async () => {
      const ui = create();
      const startOver = jest.fn();
      ui.registerStartOver(startOver);
      const session = ui.begin();

      await expect(session.showError("keeperUnsupported2faMethod")).resolves.toBeUndefined();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "keeperUnsupported2faMethod" }),
      );
      expect(startOver).toHaveBeenCalledTimes(1);
    });

    it("ignores an error from a login that was superseded", async () => {
      const ui = create();
      const startOver = jest.fn();
      ui.registerStartOver(startOver);
      const old = ui.begin();
      ui.begin();

      await old.showError("keeperUnsupported2faMethod");

      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(startOver).not.toHaveBeenCalled();
    });
  });

  describe("submit", () => {
    it("does nothing when no prompt is waiting", () => {
      const ui = create();
      const session = ui.begin();

      session.submit("anything");

      expect(ui.stage()).toEqual({ kind: "loading" });
    });
  });

  describe("cloud SSO", () => {
    it("asks for the token and cancels the tab monitor afterwards (desktop and web)", async () => {
      const ui = create(ClientType.Desktop);
      const session = ui.begin();

      const token = session.ssoLogin("https://keepersecurity.com/sso");
      expect(ui.stage()).toEqual({ kind: "ssoToken" });
      expect(ssoTabMonitor.launchAndWaitForToken).toHaveBeenCalledWith(
        "https://keepersecurity.com/sso",
      );
      session.submit("the-token");

      await expect(token).resolves.toBe("the-token");
      expect(ssoTabMonitor.cancel).toHaveBeenCalled();
    });

    it("shows loading and takes the token from the monitor in the extension", async () => {
      ssoTabMonitor.launchAndWaitForToken.mockResolvedValue("captured-token");
      const ui = create(ClientType.Browser);
      const session = ui.begin();

      const token = session.ssoLogin("https://keepersecurity.com/sso");
      expect(ui.stage()).toEqual({ kind: "loading" });

      await expect(token).resolves.toBe("captured-token");
      expect(ssoTabMonitor.cancel).toHaveBeenCalled();
    });

    it("ends the extension's wait when the user leaves, though the monitor never settles", async () => {
      const ui = create(ClientType.Browser);
      const session = ui.begin();

      const token = session.ssoLogin("https://keepersecurity.com/sso");
      session.leave();

      await expect(token).resolves.toBe(Cancel);
    });
  });

  describe("leave", () => {
    it("cancels the SSO tab monitor so the extension doesn't wait on a closed flow", () => {
      const session = create(ClientType.Browser).begin();

      session.leave();

      expect(ssoTabMonitor.cancel).toHaveBeenCalled();
    });

    it("cancels every later prompt instead of showing it", async () => {
      const ui = create();
      const session = ui.begin();
      session.leave();

      await expect(session.selectApprovalMethod([1, 2])).resolves.toBe(Cancel);
      await expect(session.provideApprovalCode(DeviceApprovalChannel.Email)).resolves.toBe(Cancel);
      await expect(
        session.selectTwoFactorMethod([TwoFactorMethod.Totp, TwoFactorMethod.Sms]),
      ).resolves.toBe(Cancel);
      await expect(session.provideTwoFactorCode(TwoFactorMethod.Totp)).resolves.toBe(Cancel);
      await expect(session.waitForDuoPush(DuoMethod.Push)).resolves.toBe(Cancel);
      await expect(session.waitForDnaPush()).resolves.toBe(Cancel);
      await expect(session.ssoLogin("https://keepersecurity.com/sso")).resolves.toBe(Cancel);
      await expect(session.promptForPassword()).resolves.toBe(Cancel);
      await expect(session.showError("x")).resolves.toBeUndefined();
    });
  });

  describe("state the card and its buttons read", () => {
    it("reports an active login, a busy card and an import in progress", () => {
      const ui = create();
      expect([ui.loginActive(), ui.waiting(), ui.importing()]).toEqual([false, false, false]);

      const session = ui.begin();
      expect([ui.loginActive(), ui.waiting(), ui.importing()]).toEqual([true, true, false]);

      session.beginImport();
      expect([ui.loginActive(), ui.waiting(), ui.importing()]).toEqual([true, true, true]);
    });

    it("waits on push and admin approval, but not on the email code", () => {
      const ui = create();
      const session = ui.begin();

      void session.provideApprovalCode(DeviceApprovalChannel.Email);
      expect(ui.waiting()).toBe(false);
      void session.provideApprovalCode(DeviceApprovalChannel.KeeperPush);
      expect(ui.waiting()).toBe(true);
      void session.provideApprovalCode(DeviceApprovalChannel.AdminApproval);
      expect(ui.waiting()).toBe(true);
    });

    it("answers through whatever the card registered, and stops once it is gone", () => {
      const ui = create();
      const answerer = jest.fn();

      ui.registerAnswerer(answerer);
      ui.answer();
      ui.registerAnswerer(undefined);
      ui.answer();

      expect(answerer).toHaveBeenCalledTimes(1);
    });

    it("shows a toast when the code is resent", () => {
      const ui = create();
      ui.begin();

      ui.resend();

      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "keeperLoginCodeResent" }),
      );
    });
  });

  describe("the header subtitle", () => {
    const subtitleAt = (show: (session: ReturnType<KeeperInlineAuthUi["begin"]>) => unknown) => {
      const ui = create();
      void show(ui.begin());
      return ui.subtitleKey();
    };

    it("is the default while idle, loading and waiting", () => {
      const ui = create();
      expect(ui.subtitleKey()).toBeNull();
      ui.begin();
      expect(ui.subtitleKey()).toBeNull();
      expect(subtitleAt((s) => s.provideApprovalCode(DeviceApprovalChannel.KeeperPush))).toBeNull();
      expect(
        subtitleAt((s) => s.provideApprovalCode(DeviceApprovalChannel.AdminApproval)),
      ).toBeNull();
      expect(subtitleAt((s) => s.waitForDnaPush())).toBeNull();
    });

    it("names the screen for the picker, email code, authenticator, text message and password", () => {
      expect(subtitleAt((s) => s.selectApprovalMethod([1, 2]))).toBe(
        "keeperLoginApprovalMethodDesc",
      );
      expect(subtitleAt((s) => s.provideApprovalCode(DeviceApprovalChannel.Email))).toBe(
        "keeperLoginEmailCodeDesc",
      );
      expect(subtitleAt((s) => s.provideTwoFactorCode(TwoFactorMethod.Totp))).toBe(
        "keeperLoginAuthenticatorDesc",
      );
      expect(subtitleAt((s) => s.provideTwoFactorCode(TwoFactorMethod.Sms))).toBe(
        "keeperLoginSmsDesc",
      );
      expect(subtitleAt((s) => s.promptForPassword())).toBe("keeperLoginPasswordDesc");
    });

    it("is generic when the two-factor method is hidden", () => {
      expect(
        subtitleAt((s) => s.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true })),
      ).toBe("twoFactorCodePrompt");
    });
  });

  describe("Keeper DNA at device approval", () => {
    const channels = [
      DeviceApprovalChannel.Email,
      DeviceApprovalChannel.TwoFactor,
      DeviceApprovalChannel.KeeperDna,
    ];

    it("answers the client with the two-factor channel and waits for the device", async () => {
      const ui = create();
      const session = ui.begin();

      const chosen = session.selectApprovalMethod(channels);
      session.submit(DeviceApprovalChannel.KeeperDna);
      await expect(chosen).resolves.toBe(DeviceApprovalChannel.TwoFactor);

      const code = session.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true });
      expect(ui.stage()).toEqual({ kind: "dnaPush" });
      session.leave();
      await expect(code).resolves.toBe(Cancel);
    });

    it("still asks for a code after choosing the two-factor method", async () => {
      const ui = create();
      const session = ui.begin();

      const chosen = session.selectApprovalMethod(channels);
      session.submit(DeviceApprovalChannel.TwoFactor);
      await expect(chosen).resolves.toBe(DeviceApprovalChannel.TwoFactor);

      void session.provideTwoFactorCode(TwoFactorMethod.Totp, { hidden: true });
      expect(ui.stage()).toEqual(expect.objectContaining({ kind: "twoFactorCode" }));
    });
  });

  describe("confirming before leaving", () => {
    it("is needed on a Keeper Push or Keeper DNA wait, not on the others", () => {
      const needsConfirmAt = (
        show: (session: ReturnType<KeeperInlineAuthUi["begin"]>) => unknown,
      ) => {
        const ui = create();
        void show(ui.begin());
        return ui.leaveNeedsConfirm();
      };

      expect(needsConfirmAt((s) => s.provideApprovalCode(DeviceApprovalChannel.KeeperPush))).toBe(
        true,
      );
      expect(needsConfirmAt((s) => s.waitForDnaPush())).toBe(true);
      expect(needsConfirmAt((s) => s.provideApprovalCode(DeviceApprovalChannel.Email))).toBe(false);
      expect(
        needsConfirmAt((s) => s.provideApprovalCode(DeviceApprovalChannel.AdminApproval)),
      ).toBe(false);
      expect(needsConfirmAt((s) => s.promptForPassword())).toBe(false);
    });

    it("asks in the danger dialog the design shows", async () => {
      const ui = create();
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await expect(ui.confirmLeave()).resolves.toBe(true);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "cancelRequest" },
        content: { key: "keeperLoginCancelRequestDesc" },
        acceptButtonText: { key: "cancelRequest" },
        cancelButtonText: { key: "close" },
        type: "danger",
      });
    });
  });

  describe("leaving", () => {
    it("cancels a pending admin approval request without asking", async () => {
      const ui = create();
      const prompt = ui.begin().provideApprovalCode(DeviceApprovalChannel.AdminApproval);

      ui.leave();

      await expect(prompt).resolves.toBe(Cancel);
      expect(ui.stage()).toEqual({ kind: "idle" });
    });
  });
});

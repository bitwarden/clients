import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  TwoFactorMethod,
  Ui,
} from "../../../../importers/keeper/access";
import { KeeperDirectImportUIService } from "../../../keeper/keeper-direct-import-ui.service";
import {
  KEEPER_SSO_TAB_MONITOR,
  KeeperSsoTabMonitor,
} from "../../../keeper/services/keeper-sso-tab-monitor";

import { KeeperInlineAuthUi } from "./keeper-inline-auth-ui";

/** The inline card's UI replaces the legacy dialog's for the upgraded flow, so it has to answer
 *  the Keeper client exactly as the legacy service does. Runs identical interactions through both
 *  and compares what each shows and what each resolves. The client's own login loop is the same
 *  for both; only the UI differs. */

interface Actions {
  submit(value: unknown): void;
  resend(): void;
  cancel(): void;
}

interface Harness {
  ui: Ui;
  stage(): { kind: string };
  actions: Actions;
}

interface Scenario {
  name: string;
  clientType?: ClientType;
  /** What the SSO tab monitor does, where the scenario involves SSO. */
  capturedToken?: string;
  call(ui: Ui): Promise<unknown>;
  act(actions: Actions): void;
}

const Email = DeviceApprovalChannel.Email;
const Push = DeviceApprovalChannel.KeeperPush;
const Admin = DeviceApprovalChannel.AdminApproval;
const Totp = TwoFactorMethod.Totp;
const Sms = TwoFactorMethod.Sms;

const noMonitor = (capturedToken?: string): KeeperSsoTabMonitor => {
  const monitor = mock<KeeperSsoTabMonitor>();
  monitor.launchAndWaitForToken.mockReturnValue(
    capturedToken === undefined
      ? new Promise<string>(() => undefined)
      : Promise.resolve(capturedToken),
  );
  return monitor;
};

const platform = (clientType: ClientType) => {
  const platformUtilsService = mock<PlatformUtilsService>();
  platformUtilsService.getClientType.mockReturnValue(clientType);
  return platformUtilsService;
};

function legacyHarness(scenario: Scenario): Harness {
  TestBed.resetTestingModule();
  const dialogService = mock<DialogService>();
  dialogService.open.mockReturnValue({ close: jest.fn() } as any);
  TestBed.configureTestingModule({
    providers: [
      KeeperDirectImportUIService,
      { provide: DialogService, useValue: dialogService },
      {
        provide: PlatformUtilsService,
        useValue: platform(scenario.clientType ?? ClientType.Desktop),
      },
      { provide: KEEPER_SSO_TAB_MONITOR, useValue: noMonitor(scenario.capturedToken) },
    ],
  });
  const service = TestBed.inject(KeeperDirectImportUIService);
  return {
    ui: service,
    stage: () => service.stage(),
    actions: {
      submit: (value) => service.submit(value),
      resend: () => service.resend(),
      cancel: () => service.cancel(),
    },
  };
}

function inlineHarness(scenario: Scenario): Harness {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      KeeperInlineAuthUi,
      { provide: DialogService, useValue: mock<DialogService>() },
      { provide: ToastService, useValue: mock<ToastService>() },
      { provide: I18nService, useValue: mock<I18nService>() },
      {
        provide: PlatformUtilsService,
        useValue: platform(scenario.clientType ?? ClientType.Desktop),
      },
      { provide: KEEPER_SSO_TAB_MONITOR, useValue: noMonitor(scenario.capturedToken) },
    ],
  });
  const controller = TestBed.inject(KeeperInlineAuthUi);
  const session = controller.begin();
  return {
    ui: session,
    stage: () => controller.stage(),
    actions: {
      submit: (value) => session.submit(value),
      resend: () => session.resend(),
      cancel: () => session.leave(),
    },
  };
}

/** The inline card also shows busy stages the legacy dialog has no equivalent for. */
const comparable = (stage: { kind: string }) =>
  ["idle", "loading", "importing"].includes(stage.kind) ? { kind: "idle" } : stage;

async function transcript(harness: Harness, scenario: Scenario) {
  const pending = scenario.call(harness.ui);
  const shown = comparable(harness.stage());
  scenario.act(harness.actions);
  return { shown, resolved: await pending };
}

const scenarios: Scenario[] = [
  // Device approval picker
  {
    name: "approval picker, no methods",
    call: (u) => u.selectApprovalMethod([]),
    act: () => undefined,
  },
  {
    name: "approval picker, one method",
    call: (u) => u.selectApprovalMethod([Email]),
    act: () => undefined,
  },
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `approval picker, several methods, ${action}`,
    call: (u) => u.selectApprovalMethod([Email, Push, Admin]),
    act: (a) => (action === "submit" ? a.submit(Push) : a.cancel()),
  })),

  // Approval code, wait and admin screens
  ...[Email, Push, Admin].flatMap((method) =>
    (["submit", "resend", "cancel"] as const).map((action): Scenario => ({
      name: `approval code for channel ${method}, ${action}`,
      call: (u) => u.provideApprovalCode(method, { previousCodeRejected: action === "submit" }),
      act: (a) => {
        if (action === "submit") {
          a.submit("123456");
        } else {
          a[action]();
        }
      },
    })),
  ),

  // Second factor picker and codes
  {
    name: "2FA picker, one method",
    call: (u) => u.selectTwoFactorMethod([Totp]),
    act: () => undefined,
  },
  { name: "2FA picker, none", call: (u) => u.selectTwoFactorMethod([]), act: () => undefined },
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `2FA picker, several methods, ${action}`,
    call: (u) => u.selectTwoFactorMethod([Totp, Sms, TwoFactorMethod.KeeperDna]),
    act: (a) => (action === "submit" ? a.submit(Sms) : a.cancel()),
  })),
  ...[
    { method: Totp, options: { hidden: true, canResend: true, previousCodeRejected: true } },
    { method: Sms, options: { canResend: true } },
    { method: Totp, options: {} },
    { method: TwoFactorMethod.KeeperPush, options: {} },
    { method: TwoFactorMethod.KeeperDna, options: { previousCodeRejected: true } },
  ].flatMap(({ method, options }) =>
    (["submit", "resend", "cancel"] as const).map((action): Scenario => ({
      name: `2FA code for method ${method} ${JSON.stringify(options)}, ${action}`,
      call: (u) => u.provideTwoFactorCode(method, options),
      act: (a) => {
        if (action === "submit") {
          a.submit("654321");
        } else {
          a[action]();
        }
      },
    })),
  ),

  // Duo and Keeper DNA
  {
    name: "Duo picker, one method",
    call: (u) => u.selectDuoMethod([DuoMethod.Push], "+1"),
    act: () => undefined,
  },
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `Duo picker, several methods, ${action}`,
    call: (u) => u.selectDuoMethod([DuoMethod.Push, DuoMethod.Sms], "+1 555"),
    act: (a) => (action === "submit" ? a.submit(DuoMethod.Sms) : a.cancel()),
  })),
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `Duo push wait, ${action}`,
    call: (u) => u.waitForDuoPush(DuoMethod.Push),
    act: (a) => (action === "submit" ? a.submit("") : a[action]()),
  })),
  {
    name: "DNA picker, one method",
    call: (u) => u.selectDnaMethod([DnaMethod.Code]),
    act: () => undefined,
  },
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `DNA picker, several methods, ${action}`,
    call: (u) => u.selectDnaMethod([DnaMethod.Push, DnaMethod.Code]),
    act: (a) => (action === "submit" ? a.submit(DnaMethod.Code) : a.cancel()),
  })),
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `DNA push wait, ${action}`,
    call: (u) => u.waitForDnaPush(),
    act: (a) => (action === "submit" ? a.submit("") : a[action]()),
  })),

  // Cloud SSO: Desktop and web ask for the token; the extension captures it itself
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `SSO on Desktop, ${action}`,
    call: (u) => u.ssoLogin("https://keepersecurity.com/sso"),
    act: (a) => (action === "submit" ? a.submit("pasted-token") : a.cancel()),
  })),
  ...(["submit", "cancel"] as const).map((action): Scenario => ({
    name: `SSO on Web, ${action}`,
    clientType: ClientType.Web,
    call: (u) => u.ssoLogin("https://keepersecurity.com/sso"),
    act: (a) => (action === "submit" ? a.submit("pasted-token") : a.cancel()),
  })),
  {
    name: "SSO in the extension captures the token without asking",
    clientType: ClientType.Browser,
    capturedToken: "captured-token",
    call: (u) => u.ssoLogin("https://keepersecurity.com/sso"),
    act: () => undefined,
  },

  // Password and errors
  ...[false, true].flatMap((rejected) =>
    (["submit", "cancel"] as const).map((action): Scenario => ({
      name: `password, previous rejected ${rejected}, ${action}`,
      call: (u) => u.promptForPassword({ previousPasswordRejected: rejected }),
      act: (a) => (action === "submit" ? a.submit("hunter2") : a.cancel()),
    })),
  ),
];

describe("Keeper login UI parity: inline card against the legacy dialog service", () => {
  it.each(scenarios.map((scenario) => [scenario.name, scenario] as const))(
    "%s",
    async (_name, scenario) => {
      const legacy = await transcript(legacyHarness(scenario), scenario);
      const inline = await transcript(inlineHarness(scenario), scenario);

      expect(inline).toEqual(legacy);
    },
  );

  // showError is left out on purpose: the card shows a toast where the dialog shows a stage.
  it("covers every other Ui method", () => {
    const calledMethods = new Set<string>();
    for (const scenario of scenarios) {
      const probe = new Proxy({} as Ui, {
        get: (_target, method: string) => {
          calledMethods.add(method);
          return () => new Promise<void>(() => undefined);
        },
      });
      void scenario.call(probe);
    }

    expect([...calledMethods].sort()).toEqual(
      [
        "promptForPassword",
        "provideApprovalCode",
        "provideTwoFactorCode",
        "selectApprovalMethod",
        "selectDnaMethod",
        "selectDuoMethod",
        "selectTwoFactorMethod",
        "ssoLogin",
        "waitForDnaPush",
        "waitForDuoPush",
      ].sort(),
    );
  });
});

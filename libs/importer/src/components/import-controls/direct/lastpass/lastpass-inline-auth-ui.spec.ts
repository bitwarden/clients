import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { OtpResult } from "../../../../importers/lastpass/access/models";
import {
  LASTPASS_IMPORT_PAGE_FOCUS,
  LastPassImportPageFocus,
} from "../../../lastpass/lastpass-import-page-focus";

import { LastPassInlineAuthUi } from "./lastpass-inline-auth-ui";

describe("LastPassInlineAuthUi", () => {
  let toastService: MockProxy<ToastService>;
  let pageFocus: MockProxy<LastPassImportPageFocus>;

  const create = (): LastPassInlineAuthUi => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        LastPassInlineAuthUi,
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: mock<I18nService>({ t: (key: string) => key }) },
        { provide: LASTPASS_IMPORT_PAGE_FOCUS, useValue: pageFocus },
      ],
    });
    return TestBed.inject(LastPassInlineAuthUi);
  };

  beforeEach(() => {
    toastService = mock<ToastService>();
    pageFocus = mock<LastPassImportPageFocus>();
    pageFocus.capture.mockResolvedValue();
  });

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

  describe("screen and busy", () => {
    it("keeps the last screen up while a request is in flight", async () => {
      const ui = create();
      const session = ui.begin();
      const answered = session.promptForPassword({ previousPasswordRejected: false });

      expect(ui.screen()).toEqual({ kind: "password", previousPasswordRejected: false });
      expect(ui.busy()).toBe(false);

      session.submit("hunter2");

      expect(ui.stage()).toEqual({ kind: "loading" });
      expect(ui.screen()).toEqual({ kind: "password", previousPasswordRejected: false });
      expect(ui.subtitleKey()).toBe("lastPassLoginPasswordDesc");
      expect(ui.busy()).toBe(true);
      expect(await answered).toBe("hunter2");
    });

    it("is not busy while waiting on SSO, and busy once the vault is being written", () => {
      const ui = create();
      const session = ui.begin();
      void session.waitForSsoCancel().catch((): void => undefined);

      expect(ui.screen()).toEqual({ kind: "sso" });
      expect(ui.busy()).toBe(false);

      session.beginImport();

      expect(ui.screen()).toEqual({ kind: "sso" });
      expect(ui.busy()).toBe(true);
    });

    it("clears the screen when the login ends or is left", () => {
      const ui = create();
      const ended = ui.begin();
      void ended
        .promptForPassword({ previousPasswordRejected: false })
        .catch((): void => undefined);
      ui.end(ended);

      expect(ui.screen()).toEqual({ kind: "idle" });

      const left = ui.begin();
      void left.promptForPassword({ previousPasswordRejected: false }).catch((): void => undefined);
      ui.leave();

      expect(ui.screen()).toEqual({ kind: "idle" });
      expect(ui.busy()).toBe(false);
    });

    it("starts a new login on an idle screen even if the last one left a prompt up", () => {
      const ui = create();
      const first = ui.begin();
      void first
        .promptForPassword({ previousPasswordRejected: false })
        .catch((): void => undefined);

      ui.begin();

      expect(ui.screen()).toEqual({ kind: "idle" });
      expect(ui.busy()).toBe(true);
    });
  });

  describe("derived state", () => {
    it.each([
      ["loading", false, true, false],
      ["sso", false, true, false],
      ["importing", false, true, true],
    ] as const)(
      "%s: loginActive is true, waiting is %s-input, importing is %s",
      (kind, _, waiting, importing) => {
        const ui = create();
        const session = ui.begin();
        if (kind === "sso") {
          void session.waitForSsoCancel().catch((): void => undefined);
        } else if (kind === "importing") {
          session.beginImport();
        }

        expect(ui.stage().kind).toBe(kind);
        expect(ui.loginActive()).toBe(true);
        expect(ui.waiting()).toBe(waiting);
        expect(ui.importing()).toBe(importing);
      },
    );

    it("is not waiting while a prompt needs the user", () => {
      const ui = create();
      void ui.begin().promptForPassword({ previousPasswordRejected: false });

      expect(ui.stage().kind).toBe("password");
      expect(ui.waiting()).toBe(false);
      expect(ui.importing()).toBe(false);
    });

    it("picks the subtitle for the prompt showing, and none otherwise", () => {
      const ui = create();
      expect(ui.subtitleKey()).toBeNull();

      const session = ui.begin();
      expect(ui.subtitleKey()).toBeNull();

      void session.promptForPassword({ previousPasswordRejected: false });
      expect(ui.subtitleKey()).toBe("lastPassLoginPasswordDesc");

      session.submit("hunter2");
      void session.provideGoogleAuthPasscode();
      expect(ui.subtitleKey()).toBe("lastPassLoginCodeDesc");
    });
  });

  describe("leave", () => {
    it("clears the card at once while a request is still in flight", () => {
      const ui = create();
      const session = ui.begin();

      ui.leave();

      expect(session.userLeft).toBe(true);
      expect(ui.stage()).toEqual({ kind: "idle" });
      expect(ui.waiting()).toBe(false);
      expect(ui.loginActive()).toBe(false);
    });

    it("cancels the prompt that was open", async () => {
      const ui = create();
      const code = ui.begin().provideGoogleAuthPasscode();

      ui.leave();

      await expect(code).resolves.toBe(OtpResult.cancel);
    });

    it("a left login can't show a prompt or blank the login that follows it", () => {
      const ui = create();
      const left = ui.begin();
      ui.leave();
      const next = ui.begin();
      void next.promptForPassword({ previousPasswordRejected: false });

      void left.provideGoogleAuthPasscode();
      ui.end(left);

      expect(ui.stage().kind).toBe("password");
    });
  });

  describe("end", () => {
    it("returns the card to idle", () => {
      const ui = create();
      const session = ui.begin();

      ui.end(session);

      expect(ui.stage()).toEqual({ kind: "idle" });
    });

    it("ignores a superseded session", () => {
      const ui = create();
      const first = ui.begin();
      const second = ui.begin();

      ui.end(first);

      expect(ui.stage()).toEqual({ kind: "loading" });
      expect(ui.session).toBe(second);
    });
  });

  describe("answer and submit", () => {
    it("routes Continue to the registered answerer", () => {
      const ui = create();
      const answerer = jest.fn();
      ui.registerAnswerer(answerer);

      ui.answer();

      expect(answerer).toHaveBeenCalledTimes(1);
    });

    it("does nothing when no answerer is registered", () => {
      const ui = create();

      expect(() => ui.answer()).not.toThrow();
    });

    it("hands a value to the current session's open prompt", async () => {
      const ui = create();
      const password = ui.begin().promptForPassword({ previousPasswordRejected: false });

      ui.submit("hunter2");

      await expect(password).resolves.toBe("hunter2");
    });
  });

  describe("fail", () => {
    it("shows the message as a toast and starts over", () => {
      const ui = create();
      const startOver = jest.fn();
      ui.registerStartOver(startOver);
      const session = ui.begin();

      ui.fail(session, "errorOccurred");

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: undefined,
        message: "errorOccurred",
      });
      expect(startOver).toHaveBeenCalledTimes(1);
    });

    it("ignores a failure from a login that is no longer current", () => {
      const ui = create();
      const startOver = jest.fn();
      ui.registerStartOver(startOver);
      const old = ui.begin();
      ui.begin();

      ui.fail(old, "errorOccurred");

      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(startOver).not.toHaveBeenCalled();
    });
  });
});

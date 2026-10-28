import { mock, MockProxy } from "jest-mock-extended";

import { OobResult, OtpResult } from "../../../../importers/lastpass/access/models";
import { LastPassImportPageFocus } from "../../../lastpass/lastpass-import-page-focus";

import { LastPassAuthSession, LastPassInlineStage } from "./lastpass-auth-session";

describe("LastPassAuthSession", () => {
  let pageFocus: MockProxy<LastPassImportPageFocus>;
  let stages: LastPassInlineStage[];
  let session: LastPassAuthSession;

  const lastStage = () => stages[stages.length - 1];

  beforeEach(() => {
    pageFocus = mock<LastPassImportPageFocus>();
    pageFocus.capture.mockResolvedValue();
    stages = [];
    session = new LastPassAuthSession((_, stage) => stages.push(stage), pageFocus);
  });

  describe("promptForPassword", () => {
    it("shows the password prompt and resolves with the submitted password", async () => {
      const password = session.promptForPassword({ previousPasswordRejected: false });

      expect(lastStage()).toEqual({ kind: "password", previousPasswordRejected: false });
      session.submit("hunter2");

      await expect(password).resolves.toBe("hunter2");
      expect(lastStage()).toEqual({ kind: "loading" });
    });

    it("flags a prompt that follows a rejected password", () => {
      void session.promptForPassword({ previousPasswordRejected: true });

      expect(lastStage()).toEqual({ kind: "password", previousPasswordRejected: true });
    });

    it("rejects when the user leaves", async () => {
      const password = session.promptForPassword({ previousPasswordRejected: false });

      session.leave();

      await expect(password).rejects.toThrow("Login cancelled by the user");
      expect(session.userLeft).toBe(true);
    });

    it("rejects at once when the user already left", async () => {
      session.leave();

      await expect(session.promptForPassword({ previousPasswordRejected: false })).rejects.toThrow(
        "Login cancelled by the user",
      );
      expect(stages).toEqual([]);
    });
  });

  describe("one-time passcodes", () => {
    it.each([
      ["authenticator", () => session.provideGoogleAuthPasscode()],
      ["Microsoft authenticator", () => session.provideMicrosoftAuthPasscode()],
      ["YubiKey", () => session.provideYubikeyPasscode()],
    ])("asks for the code for %s and returns it without remembering the device", async (_, ask) => {
      const result = ask();

      expect(lastStage()).toEqual({ kind: "code", previousCodeRejected: false });
      session.submit("123456");

      await expect(result).resolves.toEqual(new OtpResult("123456"));
    });

    it("returns the library's cancel result when the user leaves", async () => {
      const result = session.provideGoogleAuthPasscode();

      session.leave();

      await expect(result).resolves.toBe(OtpResult.cancel);
    });

    it("cancels at once, without prompting, when the user already left", async () => {
      session.leave();

      await expect(session.provideYubikeyPasscode()).resolves.toBe(OtpResult.cancel);
      expect(stages).toEqual([]);
    });
  });

  describe("out-of-band approval", () => {
    it.each([
      ["LastPass Authenticator", () => session.approveLastPassAuth()],
      ["Duo", () => session.approveDuo()],
      ["Salesforce", () => session.approveSalesforceAuth()],
    ])("asks for a passcode for %s", async (_, ask) => {
      const result = ask();

      expect(lastStage()).toEqual({ kind: "code", previousCodeRejected: false });
      session.submit("654321");

      await expect(result).resolves.toEqual(new OobResult(false, "654321"));
    });

    it("returns the library's cancel result when the user leaves", async () => {
      const result = session.approveDuo();

      session.leave();

      await expect(result).resolves.toBe(OobResult.cancel);
    });

    it("drops the code prompt when the library ends the login before an answer", async () => {
      const result = session.approveLastPassAuth();

      session.closeMFADialog();

      await expect(result).resolves.toBe(OobResult.cancel);
      expect(lastStage()).toEqual({ kind: "loading" });
      expect(session.userLeft).toBe(false);
    });

    it("leaves the display alone when the user already left", () => {
      session.leave();
      stages = [];

      session.closeMFADialog();

      expect(stages).toEqual([]);
    });
  });

  describe("rejected codes", () => {
    it("flags only the next code prompt after a typed code is rejected", () => {
      void session.provideGoogleAuthPasscode();
      session.submit("000000");

      expect(session.rejectSubmittedCode()).toBe(true);

      void session.provideGoogleAuthPasscode();
      expect(lastStage()).toEqual({ kind: "code", previousCodeRejected: true });
      session.submit("111111");

      void session.provideGoogleAuthPasscode();
      expect(lastStage()).toEqual({ kind: "code", previousCodeRejected: false });
    });

    it("counts a typed code once", () => {
      void session.provideGoogleAuthPasscode();
      session.submit("000000");

      expect(session.rejectSubmittedCode()).toBe(true);
      expect(session.rejectSubmittedCode()).toBe(false);
    });

    it("rejects an out-of-band passcode the user typed", () => {
      void session.approveDuo();
      session.submit("000000");

      expect(session.rejectSubmittedCode()).toBe(true);
    });

    it("is not a rejected code when none was typed, such as a declined push", () => {
      void session.approveLastPassAuth();
      session.closeMFADialog();

      expect(session.rejectSubmittedCode()).toBe(false);

      void session.approveLastPassAuth();
      expect(lastStage()).toEqual({ kind: "code", previousCodeRejected: false });
    });

    it("is not a rejected code before any prompt was answered", () => {
      expect(session.rejectSubmittedCode()).toBe(false);
    });

    it("does not count a password as a typed code", () => {
      void session.promptForPassword({ previousPasswordRejected: false });
      session.submit("hunter2");

      expect(session.rejectSubmittedCode()).toBe(false);
    });

    it("forgets an earlier typed code once a new code prompt appears", () => {
      void session.provideGoogleAuthPasscode();
      session.submit("000000");
      void session.provideGoogleAuthPasscode();

      expect(session.rejectSubmittedCode()).toBe(false);
    });
  });

  describe("submit", () => {
    it("ignores an answer when nothing is being asked", () => {
      session.submit("stray");

      expect(stages).toEqual([]);
    });
  });

  describe("SSO", () => {
    it("captures the import page before the SSO tab opens", async () => {
      await session.prepareSso();

      expect(pageFocus.capture).toHaveBeenCalledTimes(1);
    });

    it("shows the waiting card and rejects if the user leaves", async () => {
      const wait = session.waitForSsoCancel();
      expect(lastStage()).toEqual({ kind: "sso" });

      session.leave();

      await expect(wait).rejects.toThrow("SSO auth cancelled");
      expect(pageFocus.restore).not.toHaveBeenCalled();
    });

    it("rejects at once when the user already left", async () => {
      session.leave();

      await expect(session.waitForSsoCancel()).rejects.toThrow("SSO auth cancelled");
    });

    it("returns to the import page and shows loading once the callback arrives", () => {
      void session.waitForSsoCancel().catch((): void => undefined);

      session.completeSso();

      expect(pageFocus.restore).toHaveBeenCalledTimes(1);
      expect(lastStage()).toEqual({ kind: "loading" });
    });

    it("does not reject a finished wait if the user leaves afterwards", async () => {
      const wait = session.waitForSsoCancel();
      const settled = jest.fn();
      void wait.catch(settled);

      session.completeSso();
      session.leave();
      await Promise.resolve();

      expect(settled).not.toHaveBeenCalled();
    });
  });

  describe("beginImport", () => {
    it("shows the importing state", () => {
      session.beginImport();

      expect(lastStage()).toEqual({ kind: "importing" });
    });
  });
});

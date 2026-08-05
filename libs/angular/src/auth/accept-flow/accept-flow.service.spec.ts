import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { AcceptFlowConfig, AcceptFlowService } from "./accept-flow.service";

type TestInvite = { id: string; token: string };

describe("AcceptFlowService", () => {
  let sut: AcceptFlowService;
  let authService: MockProxy<AuthService>;
  let router: MockProxy<Router>;
  let i18nService: MockProxy<I18nService>;
  let toastService: MockProxy<ToastService>;

  const validParams = { id: "org-id", token: "tok" };
  const parsedInvite: TestInvite = { id: "org-id", token: "tok" };

  beforeEach(() => {
    authService = mock<AuthService>();
    router = mock<Router>();
    i18nService = mock<I18nService>();
    toastService = mock<ToastService>();

    sut = new AcceptFlowService(authService, router, i18nService, toastService);

    authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
      AuthenticationStatus.LoggedOut,
    );
    i18nService.t.mockImplementation((key: string) => key);
  });

  function buildConfig(
    overrides: Partial<AcceptFlowConfig<TestInvite>> = {},
  ): AcceptFlowConfig<TestInvite> {
    return {
      failedMessage: "inviteAcceptFailed",
      parse: (p) =>
        p != null && typeof p.id === "string" && typeof p.token === "string"
          ? { id: p.id, token: p.token }
          : null,
      authedHandler: jest.fn(),
      unauthedHandler: jest.fn(),
      ...overrides,
    };
  }

  describe("run", () => {
    it("shows the failed-message toast and redirects to / when parse returns null", async () => {
      const config = buildConfig();

      await sut.run({ id: "org-id" /* token missing */ }, config);

      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "inviteAcceptFailed",
        variant: "error",
        timeout: 10000,
      });
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(config.authedHandler).not.toHaveBeenCalled();
      expect(config.unauthedHandler).not.toHaveBeenCalled();
    });

    it("calls unauthedHandler with the parsed invite when the user is logged out", async () => {
      const config = buildConfig();

      await sut.run(validParams, config);

      expect(config.unauthedHandler).toHaveBeenCalledWith(parsedInvite);
      expect(config.authedHandler).not.toHaveBeenCalled();
    });

    it("calls authedHandler with the parsed invite when the user has any non-LoggedOut status", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      const config = buildConfig();

      await sut.run(validParams, config);

      expect(config.authedHandler).toHaveBeenCalledWith(parsedInvite);
      expect(config.unauthedHandler).not.toHaveBeenCalled();
    });

    it("calls authedHandler when the user is Locked", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Locked,
      );
      const config = buildConfig();

      await sut.run(validParams, config);

      expect(config.authedHandler).toHaveBeenCalledWith(parsedInvite);
      expect(config.unauthedHandler).not.toHaveBeenCalled();
    });

    it("handles errors thrown by authedHandler with the default short message", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      const config = buildConfig({
        authedHandler: jest.fn().mockRejectedValue(new Error("API exploded")),
      });

      await sut.run(validParams, config);

      expect(i18nService.t).toHaveBeenCalledWith("inviteAcceptFailedShort", "API exploded");
      expect(toastService.showToast).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("handles errors thrown by unauthedHandler with the default short message", async () => {
      const config = buildConfig({
        unauthedHandler: jest.fn().mockRejectedValue(new Error("boom")),
      });

      await sut.run(validParams, config);

      expect(i18nService.t).toHaveBeenCalledWith("inviteAcceptFailedShort", "boom");
      expect(toastService.showToast).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("uses config.failedShortMessage when provided", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      const config = buildConfig({
        failedShortMessage: "customShort",
        authedHandler: jest.fn().mockRejectedValue(new Error("API exploded")),
      });

      await sut.run(validParams, config);

      expect(i18nService.t).toHaveBeenCalledWith("customShort", "API exploded");
    });

    it("uses config.getErrorMessage callback when provided", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      const getErrorMessage = jest.fn().mockReturnValue("custom-message");
      const config = buildConfig({
        authedHandler: jest.fn().mockRejectedValue(new Error("Expired token.")),
        getErrorMessage,
      });

      await sut.run(validParams, config);

      expect(getErrorMessage).toHaveBeenCalledWith("Expired token.");
      expect(toastService.showToast).toHaveBeenCalledWith({
        message: "custom-message",
        variant: "error",
        timeout: 10000,
      });
    });

    it("uses config.getErrorMessage with null when parse returns null", async () => {
      const getErrorMessage = jest.fn().mockReturnValue("custom-message");
      const config = buildConfig({ getErrorMessage });

      await sut.run({ id: "org-id" /* missing token */ }, config);

      expect(getErrorMessage).toHaveBeenCalledWith(null);
    });

    it("passes ErrorResponse.message through as the apiError", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      const errorResponse = new ErrorResponse(
        { Message: "Your organization access has been revoked." },
        400,
      );
      const config = buildConfig({
        authedHandler: jest.fn().mockRejectedValue(errorResponse),
      });

      await sut.run(validParams, config);

      expect(i18nService.t).toHaveBeenCalledWith(
        "inviteAcceptFailedShort",
        "Your organization access has been revoked.",
      );
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("treats non-Error throws from authedHandler as a null apiError", async () => {
      authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
        AuthenticationStatus.Unlocked,
      );
      const config = buildConfig({
        authedHandler: jest.fn().mockRejectedValue("plain string error"),
      });

      await sut.run(validParams, config);

      expect(i18nService.t).toHaveBeenCalledWith("inviteAcceptFailed");
      expect(i18nService.t).not.toHaveBeenCalledWith("inviteAcceptFailedShort", expect.anything());
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("treats null queryParams as an invalid-link error", async () => {
      const config = buildConfig();

      await sut.run(null as any, config);

      expect(toastService.showToast).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(config.authedHandler).not.toHaveBeenCalled();
      expect(config.unauthedHandler).not.toHaveBeenCalled();
    });

    describe("onError", () => {
      it("invokes onError before the toast and redirect when the handler throws", async () => {
        authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
          AuthenticationStatus.Unlocked,
        );
        const callOrder: string[] = [];
        const onError = jest.fn().mockImplementation(async () => {
          callOrder.push("onError");
        });
        toastService.showToast.mockImplementation(() => {
          callOrder.push("toast");
        });
        router.navigate.mockImplementation(async () => {
          callOrder.push("navigate");
          return true;
        });
        const config = buildConfig({
          authedHandler: jest.fn().mockRejectedValue(new Error("boom")),
          onError,
        });

        await sut.run(validParams, config);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(callOrder).toEqual(["onError", "toast", "navigate"]);
      });

      it("invokes onError when parse returns null", async () => {
        const onError = jest.fn().mockResolvedValue(undefined);
        const config = buildConfig({ onError });

        await sut.run({ id: "org-id" /* token missing */ }, config);

        expect(onError).toHaveBeenCalledTimes(1);
      });

      it("does not invoke onError on the happy path", async () => {
        authService.activeAccountStatus$ = new BehaviorSubject<AuthenticationStatus>(
          AuthenticationStatus.Unlocked,
        );
        const onError = jest.fn().mockResolvedValue(undefined);
        const config = buildConfig({ onError });

        await sut.run(validParams, config);

        expect(onError).not.toHaveBeenCalled();
      });
    });
  });
});

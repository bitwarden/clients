import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { ImportError } from "@bitwarden/sdk-internal";

import {
  OnePasswordImportRequest,
  OnePasswordImportSummary,
  OnePasswordSsoEnrollment,
  OnePasswordSsoImportRequest,
  OnePasswordTwoFactorUi,
} from "../../sdk";
import { ImportServiceAbstraction } from "../../services/import.service.abstraction";

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsPromptData,
  OnePasswordSecretKeyAndPassword,
  OnePasswordSsoEnrollmentPromptComponent,
  OnePasswordSsoEnrollmentPromptData,
  OnePasswordTwoFactorPromptComponent,
  OnePasswordTwoFactorPromptData,
} from "./dialog";
import {
  OnePasswordAccount,
  OnePasswordDirectImportService,
} from "./onepassword-direct-import.service";
import { OnePasswordSsoBrowser } from "./onepassword-sso-browser";

// `isImportError` is a WASM call; tell SDK errors apart by name instead.
jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isImportError: (error: unknown) => error instanceof Error && error.name === "ImportError",
}));

function importError(variant: ImportError["variant"]): ImportError {
  return Object.assign(new Error(variant), { name: "ImportError" as const, variant });
}

/** Lets the pending promise chains run. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

/** Whether `promise` has settled, without waiting for it to. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(
    () => (done = true),
    () => (done = true),
  );
  await flush();
  return done;
}

/** A dialog the service opened, driven by the test in place of the user. */
interface OpenDialog<T> {
  data: T;
  closed: Subject<undefined>;
  close: jest.Mock;
}

describe("OnePasswordDirectImportService", () => {
  const account: OnePasswordAccount = {
    email: "user@example.com",
    subdomain: "my",
    domain: "Europe",
  };
  const entered: OnePasswordSecretKeyAndPassword = {
    secretKey: " A3-ABCDEF-GHIJKL-MNOPQ-RSTUV-WXYZ2-34567 ",
    password: "master password",
  };
  const summary: OnePasswordImportSummary = {
    imported: { ciphers: [], folders: 1, collections: 0 },
    skipped_vaults: [],
    skipped_items: [],
  };

  let dialogService: MockProxy<DialogService>;
  let importService: MockProxy<ImportServiceAbstraction>;
  let ssoBrowser: MockProxy<OnePasswordSsoBrowser>;
  let service: OnePasswordDirectImportService;
  let credentialPrompts: OpenDialog<OnePasswordCredentialsPromptData>[];
  let codePrompts: OpenDialog<OnePasswordTwoFactorPromptData>[];
  let enrollmentPrompts: OpenDialog<OnePasswordSsoEnrollmentPromptData>[];

  beforeEach(() => {
    dialogService = mock<DialogService>();
    importService = mock<ImportServiceAbstraction>();
    importService.importOnePassword.mockResolvedValue(summary);
    importService.importOnePasswordSso.mockResolvedValue(summary);
    ssoBrowser = mock<OnePasswordSsoBrowser>();
    credentialPrompts = [];
    codePrompts = [];
    enrollmentPrompts = [];

    // Plain stubs: the rxjs interop checks trip over a jest-mock-extended proxy.
    dialogService.open.mockImplementation((component, config) => {
      const closed = new Subject<undefined>();
      const dialog = {
        data: config?.data,
        closed,
        close: jest.fn(() => {
          closed.next(undefined);
          closed.complete();
          return Promise.resolve({ closed: true });
        }),
      };
      if (component === OnePasswordCredentialsPromptComponent) {
        credentialPrompts.push(dialog as OpenDialog<OnePasswordCredentialsPromptData>);
      } else if (component === OnePasswordTwoFactorPromptComponent) {
        codePrompts.push(dialog as OpenDialog<OnePasswordTwoFactorPromptData>);
      } else if (component === OnePasswordSsoEnrollmentPromptComponent) {
        enrollmentPrompts.push(dialog as OpenDialog<OnePasswordSsoEnrollmentPromptData>);
      }
      return dialog as unknown as DialogRef<unknown>;
    });

    TestBed.configureTestingModule({
      providers: [
        OnePasswordDirectImportService,
        { provide: DialogService, useValue: dialogService },
        {
          provide: I18nService,
          useValue: { t: (key: string) => key },
        },
        { provide: ImportServiceAbstraction, useValue: importService },
        { provide: OnePasswordSsoBrowser, useValue: ssoBrowser },
      ],
    });
    service = TestBed.inject(OnePasswordDirectImportService);
  });

  function start(
    organizationId?: OrganizationId,
    target?: CollectionView,
  ): Promise<OnePasswordImportSummary | undefined> {
    return service.handleImport(account, organizationId, target, organizationId != null);
  }

  /**
   * Makes the next import ask for a two-factor code right away. `codes` collects the SDK's requests,
   * `askAgain` is 1Password refusing the last code, and `finish` ends the import.
   */
  function twoFactorImport() {
    const codes: Promise<string | undefined>[] = [];
    let ui: OnePasswordTwoFactorUi | undefined;
    let finish: ((result: OnePasswordImportSummary | Error) => void) | undefined;
    importService.importOnePassword.mockImplementationOnce((request: OnePasswordImportRequest) => {
      ui = request.twoFactorUi;
      codes.push(ui.provideTotp(0));
      return new Promise((resolve, reject) => {
        finish = (result) => (result instanceof Error ? reject(result) : resolve(result));
      });
    });
    return {
      codes,
      askAgain: () => codes.push(ui!.provideTotp(codes.length)),
      finish: (result: OnePasswordImportSummary | Error) => finish!(result),
    };
  }

  it("signs in with the Secret Key and password from the prompt and imports into the chosen destination", async () => {
    const organizationId = Utils.newGuid() as OrganizationId;
    const collection = new CollectionView({
      id: Utils.newGuid() as CollectionId,
      name: "Shared",
      organizationId,
    });
    const result = start(organizationId, collection);

    expect(credentialPrompts[0].data.email).toBe(account.email);
    await expect(credentialPrompts[0].data.signIn(entered)).resolves.toBeUndefined();

    await expect(result).resolves.toBe(summary);
    expect(credentialPrompts[0].close).toHaveBeenCalled();
    expect(importService.importOnePassword).toHaveBeenCalledWith(
      {
        credentials: {
          username: "user@example.com",
          password: "master password",
          account_key: "A3-ABCDEF-GHIJKL-MNOPQ-RSTUV-WXYZ2-34567",
          sign_in_address: { subdomain: "my", domain: "Europe" },
        },
        twoFactorUi: expect.anything(),
      },
      organizationId,
      collection,
      true,
    );
  });

  it("does not sign in when the Secret Key and password prompt is cancelled", async () => {
    const result = start();

    credentialPrompts[0].closed.next(undefined);

    await expect(result).resolves.toBeUndefined();
    expect(importService.importOnePassword).not.toHaveBeenCalled();
  });

  it("keeps the prompt open and marks a malformed Secret Key on its field", async () => {
    importService.importOnePassword.mockRejectedValueOnce(
      importError("OnePasswordInvalidSecretKey"),
    );
    const result = start();

    await expect(credentialPrompts[0].data.signIn(entered)).resolves.toEqual({
      field: "secretKey",
      message: "enterValidSecretKey",
    });
    expect(credentialPrompts[0].close).not.toHaveBeenCalled();

    await expect(credentialPrompts[0].data.signIn(entered)).resolves.toBeUndefined();
    await expect(result).resolves.toBe(summary);
  });

  it("keeps the prompt open and marks no field when 1Password refuses the Secret Key and password", async () => {
    importService.importOnePassword.mockRejectedValueOnce(importError("OnePasswordBadCredentials"));
    const result = start();

    await expect(credentialPrompts[0].data.signIn(entered)).resolves.toEqual({
      field: undefined,
      message: "onePasswordCheckCredentials",
    });
    expect(credentialPrompts[0].close).not.toHaveBeenCalled();

    await expect(credentialPrompts[0].data.signIn(entered)).resolves.toBeUndefined();
    await expect(result).resolves.toBe(summary);
  });

  it("still cancels after a refusal", async () => {
    importService.importOnePassword.mockRejectedValueOnce(importError("OnePasswordBadCredentials"));
    const result = start();
    await credentialPrompts[0].data.signIn(entered);

    credentialPrompts[0].closed.next(undefined);

    await expect(result).resolves.toBeUndefined();
  });

  it("closes the prompt and passes any other failure on", async () => {
    importService.importOnePassword.mockRejectedValueOnce(importError("OnePasswordUnsupported"));
    const result = start();

    await expect(credentialPrompts[0].data.signIn(entered)).resolves.toBeUndefined();

    await expect(result).rejects.toMatchObject({ variant: "OnePasswordUnsupported" });
    expect(credentialPrompts[0].close).toHaveBeenCalled();
  });

  describe("with two-factor verification", () => {
    it("replaces the Secret Key and password prompt and hands over the code", async () => {
      const sdk = twoFactorImport();
      const result = start();
      const signedIn = credentialPrompts[0].data.signIn(entered);

      expect(credentialPrompts[0].close).toHaveBeenCalled();
      expect(codePrompts).toHaveLength(1);
      expect(codePrompts[0].data.email).toBe(account.email);

      const refused = codePrompts[0].data.submitCode("123456");
      await expect(sdk.codes[0]).resolves.toBe("123456");

      sdk.finish(summary);
      await expect(refused).resolves.toBe(false);
      await expect(signedIn).resolves.toBeUndefined();
      await expect(result).resolves.toBe(summary);
      expect(codePrompts[0].close).toHaveBeenCalled();
    });

    it("keeps the prompt open and reports a refused code when 1Password asks again", async () => {
      const sdk = twoFactorImport();
      const result = start();
      void credentialPrompts[0].data.signIn(entered);

      const firstRefused = codePrompts[0].data.submitCode("111111");
      sdk.askAgain();

      await expect(firstRefused).resolves.toBe(true);
      expect(codePrompts).toHaveLength(1);
      expect(codePrompts[0].close).not.toHaveBeenCalled();

      const secondRefused = codePrompts[0].data.submitCode("123456");
      await expect(sdk.codes[1]).resolves.toBe("123456");
      sdk.finish(summary);

      await expect(secondRefused).resolves.toBe(false);
      await expect(result).resolves.toBe(summary);
    });

    it("ends the import quietly when the prompt is dismissed", async () => {
      const sdk = twoFactorImport();
      const result = start();
      void credentialPrompts[0].data.signIn(entered);

      codePrompts[0].closed.next(undefined);
      await expect(sdk.codes[0]).resolves.toBeUndefined();
      sdk.finish(importError("OnePasswordTwoFactorFailed"));

      await expect(result).resolves.toBeUndefined();
    });
  });
  describe("with single sign-on", () => {
    function startSso(
      organizationId?: OrganizationId,
      target?: CollectionView,
    ): Promise<OnePasswordImportSummary | undefined> {
      return service.handleSsoImport(account, organizationId, target, organizationId != null);
    }

    /** The request of the SDK's first single sign-on import. */
    function ssoRequest(): OnePasswordSsoImportRequest {
      return importService.importOnePasswordSso.mock.calls[0][0];
    }

    /** Makes the next import begin an enrollment, which `finish` ends. */
    function enrollingImport() {
      let enrollment: OnePasswordSsoEnrollment | undefined;
      let finish: ((result: OnePasswordImportSummary | Error) => void) | undefined;
      importService.importOnePasswordSso.mockImplementationOnce(async (request) => {
        enrollment = await request.ui.beginSsoEnrollment();
        return new Promise((resolve, reject) => {
          finish = (result) => (result instanceof Error ? reject(result) : resolve(result));
        });
      });
      return {
        enrollment: () => enrollment!,
        finish: (result: OnePasswordImportSummary | Error) => finish!(result),
      };
    }

    it("imports the account into the chosen destination", async () => {
      const organizationId = Utils.newGuid() as OrganizationId;
      const collection = new CollectionView({
        id: Utils.newGuid() as CollectionId,
        name: "Shared",
        organizationId,
      });

      await expect(startSso(organizationId, collection)).resolves.toBe(summary);

      expect(importService.importOnePasswordSso).toHaveBeenCalledWith(
        {
          credentials: {
            username: "user@example.com",
            sign_in_address: { subdomain: "my", domain: "Europe" },
          },
          ui: expect.anything(),
        },
        organizationId,
        collection,
        true,
      );
      expect(credentialPrompts).toHaveLength(0);
    });

    it("signs in at the identity provider in the browser step", async () => {
      ssoBrowser.login.mockResolvedValue("https://my.1password.com/sso/oidc/redirect/#code=abc");
      await startSso();

      await expect(
        ssoRequest().ui.performSsoLogin(
          "https://idp.example.com/login",
          "https://my.1password.com/sso/oidc/redirect/",
        ),
      ).resolves.toBe("https://my.1password.com/sso/oidc/redirect/#code=abc");
      expect(ssoBrowser.login).toHaveBeenCalledWith(
        "https://idp.example.com/login",
        "https://my.1password.com/sso/oidc/redirect/",
      );
    });

    it("ends quietly when the user cancels", async () => {
      importService.importOnePasswordSso.mockRejectedValueOnce(importError("OnePasswordCanceled"));

      await expect(startSso()).resolves.toBeUndefined();
    });

    it("passes a failed browser step on, which the SDK takes for a cancel", async () => {
      const failure = new Error("the window did not open");
      ssoBrowser.login.mockRejectedValue(failure);
      importService.importOnePasswordSso.mockImplementationOnce(async (request) => {
        await expect(
          request.ui.performSsoLogin(
            "https://idp.example.com/login",
            "https://my.1password.com/sso/oidc/redirect/",
          ),
        ).resolves.toBeUndefined();
        throw importError("OnePasswordCanceled");
      });

      await expect(startSso()).rejects.toBe(failure);
    });

    it("passes any other failure on", async () => {
      importService.importOnePasswordSso.mockRejectedValueOnce(importError("OnePasswordNetwork"));

      await expect(startSso()).rejects.toMatchObject({ variant: "OnePasswordNetwork" });
    });

    describe("when the service goes away", () => {
      it("gives up on the browser step", () => {
        service.ngOnDestroy();

        expect(ssoBrowser.cancel).toHaveBeenCalled();
      });

      it("does not open the browser for a login the SDK asks for afterwards", async () => {
        await startSso();
        service.ngOnDestroy();

        await expect(
          ssoRequest().ui.performSsoLogin(
            "https://idp.example.com/login",
            "https://my.1password.com/sso/oidc/redirect/",
          ),
        ).resolves.toBeUndefined();
        expect(ssoBrowser.login).not.toHaveBeenCalled();
      });

      it("hands the SDK a canceled enrollment and opens no prompt for one it begins afterwards", async () => {
        await startSso();
        service.ngOnDestroy();

        const enrollment = await ssoRequest().ui.beginSsoEnrollment();

        await expect(enrollment.cancelled()).resolves.toBeUndefined();
        await expect(enrollment.provideVerificationCode()).resolves.toBeUndefined();
        expect(enrollmentPrompts).toHaveLength(0);
      });

      it("closes the enrollment prompt and calls the enrollment off", async () => {
        const sdk = enrollingImport();
        const result = startSso();
        await flush();
        const canceled = jest.fn();
        void sdk.enrollment().cancelled().then(canceled);
        const code = sdk.enrollment().provideVerificationCode();

        service.ngOnDestroy();

        expect(enrollmentPrompts[0].close).toHaveBeenCalled();
        await expect(code).resolves.toBeUndefined();
        await flush();
        expect(canceled).toHaveBeenCalled();

        sdk.finish(importError("OnePasswordCanceled"));
        await expect(result).resolves.toBeUndefined();
      });

      it("has no prompt to close once the import is over", async () => {
        const sdk = enrollingImport();
        const result = startSso();
        await flush();
        sdk.finish(summary);
        await result;
        enrollmentPrompts[0].close.mockClear();

        service.ngOnDestroy();

        expect(enrollmentPrompts[0].close).not.toHaveBeenCalled();
      });
    });

    describe("enrolling the device", () => {
      it("opens the prompt when the SDK begins the enrollment", async () => {
        const sdk = enrollingImport();
        const result = startSso();
        await flush();

        expect(enrollmentPrompts).toHaveLength(1);
        expect(enrollmentPrompts[0].data.email).toBe(account.email);

        sdk.finish(summary);
        await expect(result).resolves.toBe(summary);
      });

      it("shows the stage of the enrollment and hands over the verification code", async () => {
        const sdk = enrollingImport();
        const result = startSso();
        await flush();

        expect(enrollmentPrompts).toHaveLength(1);
        expect(enrollmentPrompts[0].data.email).toBe(account.email);
        expect(enrollmentPrompts[0].data.status()).toBe("WaitingForApproval");
        expect(enrollmentPrompts[0].data.codeRequested()).toBe(false);

        const code = sdk.enrollment().provideVerificationCode();
        expect(enrollmentPrompts[0].data.codeRequested()).toBe(true);
        const submitted = enrollmentPrompts[0].data.submitCode("123456");
        await expect(code).resolves.toBe("123456");

        await sdk.enrollment().updateStatus("ExchangingCredentials", "Exchanging");
        expect(enrollmentPrompts[0].data.status()).toBe("ExchangingCredentials");

        await sdk.enrollment().updateStatus("Completing", "Completing");
        await sdk.enrollment().endEnrollment("Success");
        expect(await settled(submitted)).toBe(false);
        expect(enrollmentPrompts[0].close).not.toHaveBeenCalled();

        sdk.finish(summary);
        await expect(result).resolves.toBe(summary);
        await expect(submitted).resolves.toBeUndefined();
        expect(enrollmentPrompts[0].close).toHaveBeenCalled();
      });

      it("calls the enrollment off when the prompt is dismissed", async () => {
        const sdk = enrollingImport();
        const result = startSso();
        await flush();
        const canceled = jest.fn();
        void sdk.enrollment().cancelled().then(canceled);
        const code = sdk.enrollment().provideVerificationCode();

        enrollmentPrompts[0].closed.next(undefined);

        await expect(code).resolves.toBeUndefined();
        await flush();
        expect(canceled).toHaveBeenCalled();

        await sdk.enrollment().endEnrollment("Canceled");
        sdk.finish(importError("OnePasswordCanceled"));
        await expect(result).resolves.toBeUndefined();
      });

      it("closes the prompt when the import fails before the SDK ends the enrollment", async () => {
        const sdk = enrollingImport();
        const result = startSso();
        await flush();

        sdk.finish(importError("OnePasswordNetwork"));

        await expect(result).rejects.toMatchObject({ variant: "OnePasswordNetwork" });
        expect(enrollmentPrompts[0].close).toHaveBeenCalled();
      });
    });
  });

  describe("signInMethod", () => {
    function offer(password: boolean, sso: boolean, ssoSupported: boolean) {
      importService.onePasswordSignInMethods.mockResolvedValue({ password, sso });
      Object.assign(ssoBrowser, { supported: ssoSupported });
    }

    it("asks 1Password about the account", async () => {
      offer(true, false, true);

      await service.signInMethod(account);

      expect(importService.onePasswordSignInMethods).toHaveBeenCalledWith("user@example.com", {
        subdomain: "my",
        domain: "Europe",
      });
    });

    it.each([
      [true, false, true, "password"],
      [true, false, false, "password"],
      [false, true, true, "sso"],
      [false, true, false, undefined],
      [true, true, true, "password"],
      [true, true, false, "password"],
      [false, false, true, undefined],
    ] as const)(
      "with password %s, SSO %s and SSO support %s picks %s",
      async (password, sso, ssoSupported, expected) => {
        offer(password, sso, ssoSupported);

        await expect(service.signInMethod(account)).resolves.toBe(expected);
      },
    );
  });

  describe("describeError", () => {
    it("describes any other failure as a toast", () => {
      expect(service.describeError(importError("OnePasswordNetwork"))).toEqual({
        field: undefined,
        message: "onePasswordImportError",
      });
    });

    it("describes nothing for a cancellation", () => {
      expect(service.describeError(importError("OnePasswordCanceled"))).toBeUndefined();
    });
  });
});

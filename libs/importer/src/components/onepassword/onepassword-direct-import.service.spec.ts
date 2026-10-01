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
  OnePasswordTwoFactorUi,
} from "../../sdk";
import { ImportServiceAbstraction } from "../../services/import.service.abstraction";

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsPromptData,
  OnePasswordSecretKeyAndPassword,
  OnePasswordTwoFactorPromptComponent,
  OnePasswordTwoFactorPromptData,
} from "./dialog";
import {
  OnePasswordAccount,
  OnePasswordDirectImportService,
} from "./onepassword-direct-import.service";

// `isImportError` is a WASM call; tell SDK errors apart by name instead.
jest.mock("@bitwarden/sdk-internal", () => ({
  ...jest.requireActual("@bitwarden/sdk-internal"),
  isImportError: (error: unknown) => error instanceof Error && error.name === "ImportError",
}));

function importError(variant: ImportError["variant"]): ImportError {
  return Object.assign(new Error(variant), { name: "ImportError" as const, variant });
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
  let service: OnePasswordDirectImportService;
  let credentialPrompts: OpenDialog<OnePasswordCredentialsPromptData>[];
  let codePrompts: OpenDialog<OnePasswordTwoFactorPromptData>[];

  beforeEach(() => {
    dialogService = mock<DialogService>();
    importService = mock<ImportServiceAbstraction>();
    importService.importOnePassword.mockResolvedValue(summary);
    credentialPrompts = [];
    codePrompts = [];

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
      }
      return dialog as unknown as DialogRef<unknown>;
    });

    TestBed.configureTestingModule({
      providers: [
        OnePasswordDirectImportService,
        { provide: DialogService, useValue: dialogService },
        {
          provide: I18nService,
          useValue: { t: (key: string, domain: string) => `${key}(${domain})` },
        },
        { provide: ImportServiceAbstraction, useValue: importService },
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

  it.each<[ImportError["variant"], string, string]>([
    [
      "OnePasswordBadCredentials",
      "password",
      "onePasswordIncorrectUsernameOrPassword(1password.eu)",
    ],
    ["OnePasswordInvalidSecretKey", "secretKey", "enterValidSecretKey(1password.eu)"],
  ])(
    "keeps the prompt open and marks the field 1Password refused after %s",
    async (variant, field, message) => {
      importService.importOnePassword.mockRejectedValueOnce(importError(variant));
      const result = start();

      await expect(credentialPrompts[0].data.signIn(entered)).resolves.toEqual({
        field,
        message,
      });
      expect(credentialPrompts[0].close).not.toHaveBeenCalled();

      await expect(credentialPrompts[0].data.signIn(entered)).resolves.toBeUndefined();
      await expect(result).resolves.toBe(summary);
    },
  );

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

    it("closes the prompt and passes on running out of attempts", async () => {
      const sdk = twoFactorImport();
      const result = start();
      void credentialPrompts[0].data.signIn(entered);

      void codePrompts[0].data.submitCode("111111");
      sdk.finish(importError("OnePasswordTwoFactorFailed"));

      await expect(result).rejects.toMatchObject({ variant: "OnePasswordTwoFactorFailed" });
      expect(codePrompts[0].close).toHaveBeenCalled();
    });
  });

  describe("describeError", () => {
    it("names the domain the account signs in on", () => {
      expect(service.describeError(importError("OnePasswordBadCredentials"), "Canada")).toEqual({
        field: "password",
        message: "onePasswordIncorrectUsernameOrPassword(1password.ca)",
      });
    });

    it("leaves a failure outside the user's hands to a toast", () => {
      expect(service.describeError(importError("OnePasswordNetwork"), "Global")).toEqual({
        field: undefined,
        message: "onePasswordImportError(1password.com)",
      });
    });
  });
});

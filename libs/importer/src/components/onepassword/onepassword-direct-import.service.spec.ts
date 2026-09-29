import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";
import { ImportError } from "@bitwarden/sdk-internal";

import { OnePasswordImportSummary, OnePasswordTwoFactorUi } from "../../sdk";
import { ImportServiceAbstraction } from "../../services/import.service.abstraction";

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsPromptResult,
  OnePasswordTwoFactorPromptComponent,
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

describe("OnePasswordDirectImportService", () => {
  const account: OnePasswordAccount = {
    email: "user@example.com",
    subdomain: "my",
    domain: "Global",
  };
  const entered: OnePasswordCredentialsPromptResult = {
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
  let credentialAnswers: (OnePasswordCredentialsPromptResult | undefined)[];
  let codeAnswers: (string | undefined)[];

  beforeEach(() => {
    dialogService = mock<DialogService>();
    importService = mock<ImportServiceAbstraction>();
    importService.importOnePassword.mockResolvedValue(summary);
    credentialAnswers = [entered];
    codeAnswers = [];

    // Plain stubs: the rxjs interop checks trip over a jest-mock-extended proxy.
    dialogService.open.mockImplementation((component) => {
      const answer =
        component === OnePasswordCredentialsPromptComponent
          ? credentialAnswers.shift()
          : codeAnswers.shift();
      return { closed: of(answer) } as DialogRef<unknown>;
    });

    TestBed.configureTestingModule({
      providers: [
        OnePasswordDirectImportService,
        { provide: DialogService, useValue: dialogService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: ImportServiceAbstraction, useValue: importService },
      ],
    });
    service = TestBed.inject(OnePasswordDirectImportService);
  });

  function credentialPrompts() {
    return dialogService.open.mock.calls.filter(
      ([component]) => component === OnePasswordCredentialsPromptComponent,
    );
  }

  it("signs in with the Secret Key and password from the prompt and imports into the chosen destination", async () => {
    const organizationId = Utils.newGuid() as OrganizationId;
    const collection = new CollectionView({
      id: Utils.newGuid() as CollectionId,
      name: "Shared",
      organizationId,
    });

    await expect(service.handleImport(account, organizationId, collection, true)).resolves.toBe(
      summary,
    );

    expect(credentialPrompts()[0][1]).toEqual({ data: { email: account.email, error: undefined } });
    expect(importService.importOnePassword).toHaveBeenCalledWith(
      {
        credentials: {
          username: "user@example.com",
          password: "master password",
          account_key: "A3-ABCDEF-GHIJKL-MNOPQ-RSTUV-WXYZ2-34567",
          sign_in_address: { subdomain: "my", domain: "Global" },
        },
        twoFactorUi: expect.anything(),
      },
      organizationId,
      collection,
      true,
    );
  });

  it("does not sign in when the Secret Key and password prompt is cancelled", async () => {
    credentialAnswers = [undefined];

    await expect(
      service.handleImport(account, undefined, undefined, false),
    ).resolves.toBeUndefined();

    expect(importService.importOnePassword).not.toHaveBeenCalled();
  });

  it.each<[ImportError["variant"], string]>([
    ["OnePasswordBadCredentials", "incorrectSignInAddressEmailPasswordOrSecretKey"],
    ["OnePasswordInvalidSecretKey", "invalidSecretKey"],
  ])(
    "asks for the Secret Key and password again, saying why, after %s",
    async (variant, reason) => {
      credentialAnswers = [entered, entered];
      importService.importOnePassword.mockRejectedValueOnce(importError(variant));

      await expect(service.handleImport(account, undefined, undefined, false)).resolves.toBe(
        summary,
      );

      const prompts = credentialPrompts();
      expect(prompts).toHaveLength(2);
      expect(prompts[1][1]).toEqual({
        data: { email: account.email, error: reason },
      });
    },
  );

  it("passes any other failure on without asking again", async () => {
    importService.importOnePassword.mockRejectedValueOnce(importError("OnePasswordNetwork"));

    await expect(service.handleImport(account, undefined, undefined, false)).rejects.toMatchObject({
      variant: "OnePasswordNetwork",
    });
    expect(credentialPrompts()).toHaveLength(1);
  });

  describe("the two-factor prompt handed to the SDK", () => {
    async function twoFactorUi(): Promise<OnePasswordTwoFactorUi> {
      await service.handleImport(account, undefined, undefined, false);
      return importService.importOnePassword.mock.calls[0][0].twoFactorUi;
    }

    function codePrompts() {
      return dialogService.open.mock.calls.filter(
        ([component]) => component === OnePasswordTwoFactorPromptComponent,
      );
    }

    it("answers with the code entered in the prompt", async () => {
      codeAnswers = ["123456"];
      const ui = await twoFactorUi();

      await expect(ui.provideTotp(0)).resolves.toBe("123456");
      expect(codePrompts()[0][1]).toEqual({
        data: { email: account.email, previousCodeRejected: false },
      });
    });

    it("opens a fresh prompt for every attempt, saying the previous code was refused", async () => {
      codeAnswers = ["111111", "123456"];
      const ui = await twoFactorUi();

      await ui.provideTotp(0);
      await ui.provideTotp(1);

      expect(codePrompts().map(([, config]) => config?.data)).toEqual([
        { email: account.email, previousCodeRejected: false },
        { email: account.email, previousCodeRejected: true },
      ]);
    });

    it("answers with nothing when the prompt is dismissed, which cancels the import", async () => {
      codeAnswers = [undefined];
      const ui = await twoFactorUi();

      await expect(ui.provideTotp(0)).resolves.toBeUndefined();
    });

    it("ends the import quietly when the SDK gives up after the prompt was dismissed", async () => {
      importService.importOnePassword.mockImplementationOnce(async (request) => {
        await request.twoFactorUi.provideTotp(0);
        throw importError("OnePasswordTwoFactorRequired");
      });

      await expect(
        service.handleImport(account, undefined, undefined, false),
      ).resolves.toBeUndefined();
    });
  });
});

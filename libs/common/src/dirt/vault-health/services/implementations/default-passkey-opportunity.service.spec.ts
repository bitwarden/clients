import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { LogService } from "../../../../platform/abstractions/log.service";
import { MockSdkService } from "../../../../platform/spec/mock-sdk.service";
import { UserId } from "../../../../types/guid";
import { CipherType } from "../../../../vault/enums/cipher-type";
import { CipherView } from "../../../../vault/models/view/cipher.view";
import { Fido2CredentialView } from "../../../../vault/models/view/fido2-credential.view";
import { LoginUriView } from "../../../../vault/models/view/login-uri.view";
import { PasskeyDirectoryEntryResponse } from "../../../models/response/passkey-directory-entry.response";
import { PasskeyDirectoryApiService } from "../../../services/abstractions/passkey-directory-api.service";
import { PasskeyOpportunity } from "../../models/passkey-opportunity";
import { VaultHealthReportStatus } from "../../models/vault-health-report-status";

import { DefaultPasskeyOpportunityService } from "./default-passkey-opportunity.service";

describe("DefaultPasskeyOpportunityService", () => {
  const userId = "user-1" as UserId;
  const otherUserId = "user-2" as UserId;

  let sdkService: MockSdkService;
  let directoryApi: MockProxy<PasskeyDirectoryApiService>;
  let logService: MockProxy<LogService>;
  let findOpportunities: jest.Mock;
  let service: DefaultPasskeyOpportunityService;

  function directoryResponse(): PasskeyDirectoryEntryResponse[] {
    return [
      new PasskeyDirectoryEntryResponse({
        DomainName: "example.com",
        Instructions: "https://example.com/passkeys",
        Passwordless: true,
        Mfa: false,
      }),
    ];
  }

  function login(id: string, args: { uris?: (string | null)[]; organizationId?: string } = {}) {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.type = CipherType.Login;
    cipher.organizationId = args.organizationId as CipherView["organizationId"];
    cipher.login.uris = (args.uris ?? ["https://example.com"]).map((uri) => {
      const view = new LoginUriView();
      view.uri = uri as string;
      return view;
    });
    return cipher;
  }

  function opportunity(id: string, instructions?: string): PasskeyOpportunity {
    return { id, supportsPasskeyLogin: true, supportsPasskeyMfa: false, instructions };
  }

  function stateOf(user: UserId = userId) {
    return firstValueFrom(service.getPasskeyOpportunities$(user));
  }

  /** Wires a `find_passkey_opportunities` onto the SDK mock, as the pending SDK will expose it. */
  function simulateSdk(user: UserId = userId) {
    const client = sdkService.simulate.userLogin(user);
    const cipherRisk = client.vault.mockDeep().cipher_risk.mockDeep();
    findOpportunities = jest.fn();
    (cipherRisk as unknown as Record<string, unknown>).find_passkey_opportunities =
      findOpportunities;
    return client;
  }

  beforeEach(() => {
    sdkService = new MockSdkService();
    directoryApi = mock<PasskeyDirectoryApiService>();
    logService = mock<LogService>();
    directoryApi.getPasskeyDirectory.mockResolvedValue(directoryResponse());
    simulateSdk();
    service = new DefaultPasskeyOpportunityService(directoryApi, sdkService, logService);
  });

  it("starts idle with no result", async () => {
    expect(await stateOf()).toEqual({ status: VaultHealthReportStatus.Idle, opportunities: null });
  });

  it("passes personal-vault ciphers to the SDK unfiltered, mapped to candidates", async () => {
    findOpportunities.mockReturnValue([]);
    const withPasskey = login("with-passkey");
    withPasskey.login.fido2Credentials = [new Fido2CredentialView()];
    const deleted = login("deleted");
    deleted.deletedDate = new Date();
    const note = new CipherView();
    note.id = "note";
    note.type = CipherType.SecureNote;

    await service.findPasskeyOpportunities(
      [
        login("plain", { uris: ["https://example.com", null, ""] }),
        withPasskey,
        deleted,
        note,
        login("org", { organizationId: "org-1" }),
      ],
      userId,
    );

    const [candidates, directory] = findOpportunities.mock.calls[0];
    expect(candidates).toEqual([
      {
        id: "plain",
        type: CipherType.Login,
        uris: ["https://example.com", ""],
        hasFido2Credentials: false,
        isDeleted: false,
        viewPassword: true,
      },
      expect.objectContaining({ id: "with-passkey", hasFido2Credentials: true }),
      expect.objectContaining({ id: "deleted", isDeleted: true }),
      expect.objectContaining({ id: "note", type: CipherType.SecureNote, uris: [] }),
    ]);
    expect(directory).toEqual([
      {
        domainName: "example.com",
        instructions: "https://example.com/passkeys",
        supportsPasskeyLogin: true,
        supportsPasskeyMfa: false,
      },
    ]);
  });

  it("publishes the SDK's opportunities as success", async () => {
    findOpportunities.mockResolvedValue([opportunity("a", "https://example.com/passkeys")]);

    await service.findPasskeyOpportunities([login("a")], userId);

    expect(await stateOf()).toEqual({
      status: VaultHealthReportStatus.Success,
      opportunities: [opportunity("a", "https://example.com/passkeys")],
    });
  });

  it.each(["javascript:alert(1)", "not a url", "ftp://example.com/x"])(
    "drops an instructions link it should not launch (%s) but keeps the opportunity",
    async (instructions) => {
      findOpportunities.mockReturnValue([opportunity("a", instructions)]);

      await service.findPasskeyOpportunities([login("a")], userId);

      expect((await stateOf()).opportunities).toEqual([opportunity("a", undefined)]);
    },
  );

  it("skips the SDK and publishes none when the directory is empty", async () => {
    directoryApi.getPasskeyDirectory.mockResolvedValue([]);

    await service.findPasskeyOpportunities([login("a")], userId);

    expect(findOpportunities).not.toHaveBeenCalled();
    expect(await stateOf()).toEqual({ status: VaultHealthReportStatus.Success, opportunities: [] });
  });

  it("skips the SDK and publishes none when there are no personal-vault ciphers", async () => {
    await service.findPasskeyOpportunities([login("org", { organizationId: "org-1" })], userId);

    expect(findOpportunities).not.toHaveBeenCalled();
    expect((await stateOf()).opportunities).toEqual([]);
  });

  it("emits loading while the first check runs", async () => {
    let resolve!: (value: PasskeyOpportunity[]) => void;
    findOpportunities.mockReturnValue(new Promise((r) => (resolve = r)));

    const pending = service.findPasskeyOpportunities([login("a")], userId);
    await Promise.resolve();

    expect((await stateOf()).status).toBe(VaultHealthReportStatus.Loading);
    resolve([]);
    await pending;
    expect((await stateOf()).status).toBe(VaultHealthReportStatus.Success);
  });

  it("keeps earlier results on screen, without loading, during a refresh", async () => {
    findOpportunities.mockReturnValue([opportunity("a")]);
    await service.findPasskeyOpportunities([login("a")], userId);
    const statuses: VaultHealthReportStatus[] = [];
    const sub = service.getPasskeyOpportunities$(userId).subscribe((s) => statuses.push(s.status));

    findOpportunities.mockReturnValue([]);
    await service.findPasskeyOpportunities([], userId);
    await service.findPasskeyOpportunities([login("b")], userId);
    sub.unsubscribe();

    expect(statuses).not.toContain(VaultHealthReportStatus.Loading);
  });

  it("fetches the directory once and reuses it", async () => {
    findOpportunities.mockReturnValue([]);

    await service.findPasskeyOpportunities([login("a")], userId);
    await service.findPasskeyOpportunities([login("b")], userId);

    expect(directoryApi.getPasskeyDirectory).toHaveBeenCalledTimes(1);
  });

  it("fetches the directory again when asked to reload it", async () => {
    findOpportunities.mockReturnValue([]);

    await service.findPasskeyOpportunities([login("a")], userId);
    await service.findPasskeyOpportunities([login("a")], userId, { reloadDirectory: true });

    expect(directoryApi.getPasskeyDirectory).toHaveBeenCalledTimes(2);
  });

  describe("when the directory fetch fails", () => {
    beforeEach(() => {
      directoryApi.getPasskeyDirectory.mockRejectedValueOnce(new Error("network"));
    });

    it("publishes error without throwing, and logs it", async () => {
      await expect(service.findPasskeyOpportunities([login("a")], userId)).resolves.toBeUndefined();

      expect(await stateOf()).toEqual({
        status: VaultHealthReportStatus.Error,
        opportunities: null,
      });
      expect(logService.error).toHaveBeenCalledWith(
        "Passkey opportunity check failed",
        expect.any(Error),
      );
    });

    it("does not cache the failure, so the next check fetches again", async () => {
      findOpportunities.mockReturnValue([opportunity("a")]);

      await service.findPasskeyOpportunities([login("a")], userId);
      await service.findPasskeyOpportunities([login("a")], userId);

      expect(directoryApi.getPasskeyDirectory).toHaveBeenCalledTimes(2);
      expect((await stateOf()).status).toBe(VaultHealthReportStatus.Success);
    });
  });

  it("keeps earlier results alongside an error status when a later check fails", async () => {
    findOpportunities.mockReturnValue([opportunity("a")]);
    await service.findPasskeyOpportunities([login("a")], userId);

    findOpportunities.mockRejectedValue(new Error("sdk"));
    await service.findPasskeyOpportunities([login("a")], userId);

    expect(await stateOf()).toEqual({
      status: VaultHealthReportStatus.Error,
      opportunities: [opportunity("a")],
    });
  });

  it("publishes error when the SDK build does not expose the method yet", async () => {
    const client = sdkService.simulate.userLogin(userId);
    client.vault.mockDeep().cipher_risk.mockReturnValue({} as never);

    await service.findPasskeyOpportunities([login("a")], userId);

    expect((await stateOf()).status).toBe(VaultHealthReportStatus.Error);
  });

  it("lets a newer check win over an older one that resolves later", async () => {
    let resolveOld!: (value: PasskeyOpportunity[]) => void;
    findOpportunities.mockReturnValueOnce(new Promise((r) => (resolveOld = r)));
    findOpportunities.mockReturnValueOnce([opportunity("new")]);

    const older = service.findPasskeyOpportunities([login("old")], userId);
    await service.findPasskeyOpportunities([login("new")], userId);
    resolveOld([opportunity("old")]);
    await older;

    expect((await stateOf()).opportunities).toEqual([opportunity("new")]);
  });

  it("publishes into the user the check belongs to", async () => {
    findOpportunities.mockReturnValue([opportunity("a")]);

    await service.findPasskeyOpportunities([login("a")], userId);

    expect((await stateOf(otherUserId)).status).toBe(VaultHealthReportStatus.Idle);
  });
});

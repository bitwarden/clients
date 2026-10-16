import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountInfo, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  CsprngArray,
  EncryptService,
  EncString,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { SecretVersionService } from "./secret-version.service";

const SomeOrganization = "da0eea55-8604-4307-8a24-b187015e3071" as OrganizationId;
const SomeOrgKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as OrgKey;
const OrgRecords: Record<OrganizationId, OrgKey> = { [SomeOrganization]: SomeOrgKey };

/** Builds a raw version payload as the API returns it. */
function versionPayload(overrides: Record<string, unknown>) {
  return {
    id: "version-id",
    secretId: "secret-id",
    value: "2.value|iv|mac",
    versionDate: "2026-03-01T09:02:00.000Z",
    editorOrganizationUserId: null as string | null,
    editorOrganizationUserName: null as string | null,
    editorServiceAccountId: null as string | null,
    editorServiceAccountName: null as string | null,
    object: "secretVersion",
    ...overrides,
  };
}

describe("SecretVersionService", () => {
  let sut: SecretVersionService;

  const keyService = mock<KeyService>();
  const apiService = mock<ApiService>();
  const encryptService = mock<EncryptService>();
  let accountService: MockProxy<AccountService> = mock<AccountService>();

  const activeAccountSubject = new BehaviorSubject<{ id: UserId } & AccountInfo>({
    id: "testId" as UserId,
    ...mockAccountInfoWith({
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
    }),
  });

  beforeEach(() => {
    jest.resetAllMocks();

    keyService.orgKeys$.mockReturnValue(new BehaviorSubject(OrgRecords));

    accountService = mock<AccountService>();
    accountService.activeAccount$ = activeAccountSubject;

    sut = new SecretVersionService(keyService, apiService, encryptService, accountService);

    // Echo back a recognisable plaintext so assertions can tell decrypted fields apart.
    encryptService.decryptString.mockImplementation(
      async (encString: EncString) => `decrypted(${encString.encryptedString})`,
    );
  });

  it("attributes each value to the editor recorded on its own version", async () => {
    // Deliberately out of order to confirm the service sorts before picking the current value.
    apiService.send.mockResolvedValue({
      object: "list",
      data: [
        versionPayload({
          id: "oldest",
          versionDate: "2026-02-27T16:40:00.000Z",
          editorOrganizationUserName: "Alice Ada",
        }),
        versionPayload({
          id: "newest",
          versionDate: "2026-03-03T14:14:00.000Z",
          editorOrganizationUserName: "Carol Chen",
        }),
        versionPayload({
          id: "middle",
          versionDate: "2026-03-01T09:02:00.000Z",
          editorOrganizationUserName: "Bob Ortiz",
        }),
      ],
    });

    const history = await sut.getSecretVersions(SomeOrganization, "secret-id");

    // The newest version mirrors the current value, so it names the current author and is not
    // itself listed as a previous value.
    expect(history.currentValueAuthorName).toBe("Carol Chen");
    expect(history.versions.map((v) => v.id)).toEqual(["middle", "oldest"]);
    expect(history.versions.map((v) => v.authorName)).toEqual(["Bob Ortiz", "Alice Ada"]);
  });

  it("names the creator of a secret that has never been edited", async () => {
    // A freshly created secret has exactly one version: the value it was created with.
    apiService.send.mockResolvedValue({
      object: "list",
      data: [
        versionPayload({
          id: "only",
          versionDate: "2026-03-03T14:14:00.000Z",
          editorOrganizationUserName: "Carol Chen",
        }),
      ],
    });

    const history = await sut.getSecretVersions(SomeOrganization, "secret-id");

    expect(history.currentValueAuthorName).toBe("Carol Chen");
    expect(history.versions).toEqual([]);
  });

  it("decrypts service account editor names with the organization key", async () => {
    apiService.send.mockResolvedValue({
      object: "list",
      data: [
        versionPayload({ id: "newest", versionDate: "2026-03-03T14:14:00.000Z" }),
        versionPayload({
          id: "older",
          versionDate: "2026-03-01T09:02:00.000Z",
          editorServiceAccountId: "sa-id",
          editorServiceAccountName: "2.saname|iv|mac",
        }),
      ],
    });

    const history = await sut.getSecretVersions(SomeOrganization, "secret-id");

    expect(history.versions[0].authorName).toBe("decrypted(2.saname|iv|mac)");
    expect(encryptService.decryptString).toHaveBeenCalledWith(
      expect.objectContaining({ encryptedString: "2.saname|iv|mac" }),
      SomeOrgKey,
    );
  });

  it("prefers the plaintext member name over decrypting a service account name", async () => {
    apiService.send.mockResolvedValue({
      object: "list",
      data: [
        versionPayload({ id: "newest", versionDate: "2026-03-03T14:14:00.000Z" }),
        versionPayload({
          id: "older",
          versionDate: "2026-03-01T09:02:00.000Z",
          editorOrganizationUserName: "Bob Ortiz",
          editorServiceAccountName: "2.saname|iv|mac",
        }),
      ],
    });

    const history = await sut.getSecretVersions(SomeOrganization, "secret-id");

    expect(history.versions[0].authorName).toBe("Bob Ortiz");
  });

  it("leaves the author undefined when no editor was recorded", async () => {
    apiService.send.mockResolvedValue({
      object: "list",
      data: [
        versionPayload({ id: "newest", versionDate: "2026-03-03T14:14:00.000Z" }),
        versionPayload({ id: "older", versionDate: "2026-03-01T09:02:00.000Z" }),
      ],
    });

    const history = await sut.getSecretVersions(SomeOrganization, "secret-id");

    expect(history.currentValueAuthorName).toBeUndefined();
    expect(history.versions[0].authorName).toBeUndefined();
  });

  it("returns an empty history when the secret has no versions", async () => {
    apiService.send.mockResolvedValue({ object: "list", data: [] });

    const history = await sut.getSecretVersions(SomeOrganization, "secret-id");

    expect(history.versions).toEqual([]);
    expect(history.currentValueAuthorName).toBeUndefined();
  });
});

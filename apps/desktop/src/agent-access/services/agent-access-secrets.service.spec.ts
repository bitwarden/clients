import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { CredentialQueryType } from "../models/credential-query-type";

import { AgentAccessSecretsService } from "./agent-access-secrets.service";

const UserOne = "user-1" as UserId;
const OrgReadable = "org-readable" as OrganizationId;
const OrgNoAccess = "org-no-access" as OrganizationId;
const OrgSecond = "org-second" as OrganizationId;

const SomeKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as OrgKey;
const SecondKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as OrgKey;

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: OrgReadable,
    name: "Acme Inc",
    enabled: true,
    canAccessSecretsManager: true,
    ...overrides,
  } as unknown as Organization;
}

/** Maps the raw (still-"encrypted") ciphertext string used in a test fixture to its decrypted
 *  plaintext, so `encryptService.decryptString` can be mocked deterministically without a real
 *  crypto round trip. */
function decryptByCiphertext(map: Record<string, string>) {
  return async (encString: EncString) => {
    const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
    if (!(ciphertext in map)) {
      throw new Error(`no decrypt fixture for ciphertext ${ciphertext}`);
    }
    return map[ciphertext];
  };
}

describe("AgentAccessSecretsService", () => {
  let service: AgentAccessSecretsService;

  let apiService: MockProxy<ApiService>;
  let encryptService: MockProxy<EncryptService>;
  let keyService: MockProxy<KeyService>;
  let accountService: MockProxy<AccountService>;
  let organizationService: MockProxy<OrganizationService>;
  let logService: MockProxy<LogService>;

  function buildService(): AgentAccessSecretsService {
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();
    keyService = mock<KeyService>();
    accountService = mock<AccountService>();
    organizationService = mock<OrganizationService>();
    logService = mock<LogService>();

    accountService.activeAccount$ = new BehaviorSubject({ id: UserOne }) as any;
    keyService.orgKeys$.mockReturnValue(
      of({
        [OrgReadable]: SomeKey,
        [OrgSecond]: SecondKey,
      }),
    );

    TestBed.configureTestingModule({
      providers: [
        AgentAccessSecretsService,
        { provide: ApiService, useValue: apiService },
        { provide: EncryptService, useValue: encryptService },
        { provide: KeyService, useValue: keyService },
        { provide: AccountService, useValue: accountService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: LogService, useValue: logService },
      ],
    });

    return TestBed.inject(AgentAccessSecretsService);
  }

  beforeEach(() => {
    service = buildService();
  });

  describe("smOrganizations", () => {
    it("returns only enabled orgs with Secrets Manager access", async () => {
      const readable = makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true });
      const disabled = makeOrg({
        id: "org-disabled" as OrganizationId,
        enabled: false,
        canAccessSecretsManager: true,
      });
      const noAccess = makeOrg({
        id: OrgNoAccess,
        enabled: true,
        canAccessSecretsManager: false,
      });
      organizationService.organizations$.mockReturnValue(of([readable, disabled, noAccess]));

      const result = await service.smOrganizations(UserOne);

      expect(result).toEqual([readable]);
    });

    it("returns an empty array, without throwing, when the org list call fails", async () => {
      organizationService.organizations$.mockImplementation(() => {
        throw new Error("boom");
      });

      const result = await service.smOrganizations(UserOne);

      expect(result).toEqual([]);
    });
  });

  describe("findSecrets", () => {
    function stubOrgSecretsList() {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
      );
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === `/organizations/${OrgReadable}/secrets`) {
          return {
            secrets: [
              { Id: "s-db", OrganizationId: OrgReadable, Key: "enc-db", Read: true },
              { Id: "s-api", OrganizationId: OrgReadable, Key: "enc-api", Read: true },
              // Not readable: filtered out before matching ever sees it.
              { Id: "s-hidden", OrganizationId: OrgReadable, Key: "enc-hidden", Read: false },
              // Undecryptable: skips this one secret, never fails the whole lookup.
              { Id: "s-bad", OrganizationId: OrgReadable, Key: "enc-corrupt", Read: true },
            ],
          };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
      // s-bad's name fails to decrypt — its own promise rejects, distinct from the other fixtures,
      // and must not fail the rest of the lookup.
      encryptService.decryptString.mockImplementation((async (encString: EncString) => {
        const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
        if (ciphertext === "enc-corrupt") {
          throw new Error("decrypt failed");
        }
        return ({ "enc-db": "DB_PASSWORD", "enc-api": "API_KEY" } as Record<string, string>)[
          ciphertext
        ];
      }) as any);
    }

    it("filters out secrets the user can't read", async () => {
      stubOrgSecretsList();

      const result = await service.findSecrets(CredentialQueryType.Search, "", UserOne);

      expect(result.map((r) => r.secretId)).not.toContain("s-hidden");
    });

    it("skips a secret whose name fails to decrypt, without failing the whole lookup", async () => {
      stubOrgSecretsList();

      const result = await service.findSecrets(CredentialQueryType.Search, "", UserOne);

      expect(result.map((r) => r.secretId)).not.toContain("s-bad");
      expect(result.map((r) => r.secretId).sort()).toEqual(["s-api", "s-db"]);
    });

    it("Name query: exact match wins outright", async () => {
      stubOrgSecretsList();

      const result = await service.findSecrets(CredentialQueryType.Name, "DB_PASSWORD", UserOne);

      expect(result).toEqual([expect.objectContaining({ secretId: "s-db", name: "DB_PASSWORD" })]);
    });

    it("Name query: falls back to a unique case-insensitive match", async () => {
      stubOrgSecretsList();

      const result = await service.findSecrets(CredentialQueryType.Name, "db_password", UserOne);

      expect(result).toEqual([expect.objectContaining({ secretId: "s-db", name: "DB_PASSWORD" })]);
    });

    it("Name query: returns nothing when the case-insensitive match is ambiguous", async () => {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
      );
      apiService.send.mockResolvedValue({
        secrets: [
          { Id: "s-1", OrganizationId: OrgReadable, Key: "enc-1", Read: true },
          { Id: "s-2", OrganizationId: OrgReadable, Key: "enc-2", Read: true },
        ],
      });
      // Neither is an exact match for the query below, but both match it case-insensitively —
      // there is no single unique winner, so the query must resolve to no match at all.
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-1": "db_password", "enc-2": "Db_Password" }),
      );

      const result = await service.findSecrets(CredentialQueryType.Name, "DB_PASSWORD", UserOne);

      expect(result).toEqual([]);
    });

    it("Id query: matches by secret UUID", async () => {
      stubOrgSecretsList();

      const result = await service.findSecrets(CredentialQueryType.Id, "s-api", UserOne);

      expect(result).toEqual([expect.objectContaining({ secretId: "s-api", name: "API_KEY" })]);
    });

    it("Search query: ranks an exact name match before a substring match", async () => {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
      );
      apiService.send.mockResolvedValue({
        secrets: [
          { Id: "s-partial", OrganizationId: OrgReadable, Key: "enc-partial", Read: true },
          { Id: "s-exact", OrganizationId: OrgReadable, Key: "enc-exact", Read: true },
        ],
      });
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-partial": "PROD_TOKEN_EXTRA", "enc-exact": "TOKEN" }),
      );

      const result = await service.findSecrets(CredentialQueryType.Search, "token", UserOne);

      expect(result.map((r) => r.secretId)).toEqual(["s-exact", "s-partial"]);
    });

    it("returns an empty array, without throwing, when listing an org's secrets fails", async () => {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
      );
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      const result = await service.findSecrets(CredentialQueryType.Search, "anything", UserOne);

      expect(result).toEqual([]);
    });

    it("populates the session-scoped name cache as it decrypts, resolvable via resolveSecretName", async () => {
      stubOrgSecretsList();

      await service.findSecrets(CredentialQueryType.Search, "", UserOne);

      expect(service.resolveSecretName("s-db")).toBe("DB_PASSWORD");
      expect(service.resolveSecretName("s-api")).toBe("API_KEY");
      expect(service.resolveSecretName("unknown-id")).toBeUndefined();
    });

    it("does not mark the list call as agent-mediated (list endpoints write no events)", async () => {
      stubOrgSecretsList();

      await service.findSecrets(CredentialQueryType.Search, "", UserOne);

      const [, , , , , apiUrl, alterHeaders] = apiService.send.mock.calls[0];
      expect(apiUrl).toBeUndefined();
      expect(alterHeaders).toBeUndefined();
    });
  });

  // M4c (agent-access-architecture.md, "M4c — server-side event logs"): a single, post-approval
  // fetch by id — the server writes a `Secret_Retrieved` audit event for every `GET /secrets/{id}`
  // call made with the user's token, so this must be the only way a value is ever fetched, and
  // only for the one secret the user approved.
  describe("getSecretValue", () => {
    it("fetches exactly one secret via GET /secrets/{id} and decrypts its value with the org key", async () => {
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === "/secrets/s-a") {
          return { Id: "s-a", OrganizationId: OrgReadable, Key: "enc-db", Value: "enc-val-a" };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-db": "DB_PASSWORD", "enc-val-a": "hunter2" }),
      );

      const result = await service.getSecretValue("s-a", OrgReadable, UserOne);

      expect(apiService.send).toHaveBeenCalledTimes(1);
      const [method, path, body, authed, hasResponse, apiUrl, alterHeaders] =
        apiService.send.mock.calls[0];
      expect(method).toBe("GET");
      expect(path).toBe("/secrets/s-a");
      expect(body).toBeNull();
      expect(authed).toBe(true);
      expect(hasResponse).toBe(true);
      expect(apiUrl).toBeNull();
      expect(result).toEqual({
        secretId: "s-a",
        name: "DB_PASSWORD",
        value: "hunter2",
        organizationId: OrgReadable,
      });

      // M4c (agent-access-architecture.md): the post-approval single-secret fetch is marked
      // agent-mediated so the server logs Secret_RetrievedByAgent instead of Secret_Retrieved.
      expect(typeof alterHeaders).toBe("function");
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("reuses the name cache populated by findSecrets instead of re-decrypting the name", async () => {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
      );
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === `/organizations/${OrgReadable}/secrets`) {
          return {
            secrets: [{ Id: "s-a", OrganizationId: OrgReadable, Key: "enc-db", Read: true }],
          };
        }
        if (method === "GET" && path === "/secrets/s-a") {
          return { Id: "s-a", OrganizationId: OrgReadable, Key: "enc-db", Value: "enc-val-a" };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-db": "DB_PASSWORD", "enc-val-a": "hunter2" }),
      );

      // Populate the cache the same way a real request would: findSecrets before approval.
      await service.findSecrets(CredentialQueryType.Id, "s-a", UserOne);
      encryptService.decryptString.mockClear();

      const result = await service.getSecretValue("s-a", OrgReadable, UserOne);

      expect(result.name).toBe("DB_PASSWORD");
      // Only the value ciphertext was decrypted here — the name came from the cache.
      expect(encryptService.decryptString).toHaveBeenCalledTimes(1);
      expect(encryptService.decryptString).toHaveBeenCalledWith(
        expect.objectContaining({ encryptedString: "enc-val-a" }),
        expect.anything(),
      );
    });

    it("never surfaces a note: the returned value has no note field even when the API sends one", async () => {
      apiService.send.mockResolvedValue({
        Id: "s-a",
        OrganizationId: OrgReadable,
        Key: "enc-db",
        Value: "enc-val-a",
        Note: "enc-note-a",
      });
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-db": "DB_PASSWORD", "enc-val-a": "hunter2" }),
      );

      const result = await service.getSecretValue("s-a", OrgReadable, UserOne);

      expect(result).not.toHaveProperty("note");
      // The note ciphertext was never even handed to decryptString.
      expect(encryptService.decryptString).not.toHaveBeenCalledWith(
        expect.objectContaining({ encryptedString: "enc-note-a" }),
        expect.anything(),
      );
    });

    it("throws (does not swallow) when the account has no key for the organization", async () => {
      await expect(service.getSecretValue("s-a", OrgNoAccess, UserOne)).rejects.toThrow(
        /no organization key/,
      );
      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("throws (does not swallow) when the API call fails", async () => {
      // ErrorResponse doesn't extend Error, so this asserts the rejection itself rather than
      // using `.rejects.toThrow()` (which requires an Error instance).
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      await expect(service.getSecretValue("s-a", OrgReadable, UserOne)).rejects.toBeInstanceOf(
        ErrorResponse,
      );
    });

    it("throws (does not swallow) when the value fails to decrypt", async () => {
      apiService.send.mockResolvedValue({
        Id: "s-a",
        OrganizationId: OrgReadable,
        Key: "enc-db",
        Value: "enc-val-a",
      });
      encryptService.decryptString.mockRejectedValue(new Error("decrypt failed"));

      await expect(service.getSecretValue("s-a", OrgReadable, UserOne)).rejects.toThrow(
        "decrypt failed",
      );
    });
  });

  // M4b (agent-access-architecture.md, "M4b — secret creation"): the project picker in the
  // secret-creation dialog.
  describe("listProjects", () => {
    it("returns decrypted names and write flags for every visible project", async () => {
      apiService.send.mockResolvedValue({
        data: [
          { Id: "p-1", OrganizationId: OrgReadable, Name: "enc-proj-a", Write: true },
          { Id: "p-2", OrganizationId: OrgReadable, Name: "enc-proj-b", Write: false },
        ],
      });
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-proj-a": "my-app", "enc-proj-b": "other-app" }),
      );

      const result = await service.listProjects(OrgReadable, UserOne);

      expect(result).toEqual([
        { id: "p-1", name: "my-app", write: true },
        { id: "p-2", name: "other-app", write: false },
      ]);
    });

    it("skips a project whose name fails to decrypt, without failing the whole call", async () => {
      apiService.send.mockResolvedValue({
        data: [
          { Id: "p-1", OrganizationId: OrgReadable, Name: "enc-proj-a", Write: true },
          { Id: "p-bad", OrganizationId: OrgReadable, Name: "enc-corrupt", Write: true },
        ],
      });
      encryptService.decryptString.mockImplementation(async (encString: EncString) => {
        const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
        if (ciphertext === "enc-corrupt") {
          throw new Error("decrypt failed");
        }
        return "my-app";
      });

      const result = await service.listProjects(OrgReadable, UserOne);

      expect(result.map((p) => p.id)).toEqual(["p-1"]);
    });

    it("returns an empty array, without throwing, when the API call fails", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      const result = await service.listProjects(OrgReadable, UserOne);

      expect(result).toEqual([]);
    });

    it("returns an empty array when the account has no key for the organization", async () => {
      const result = await service.listProjects(OrgNoAccess, UserOne);

      expect(result).toEqual([]);
      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("does not mark the list call as agent-mediated (list endpoints write no events)", async () => {
      apiService.send.mockResolvedValue({ data: [] });

      await service.listProjects(OrgReadable, UserOne);

      const [, , , , , apiUrl, alterHeaders] = apiService.send.mock.calls[0];
      expect(apiUrl).toBeUndefined();
      expect(alterHeaders).toBeUndefined();
    });
  });

  describe("createProject", () => {
    it("encrypts the name with the organization key and posts to /organizations/{orgId}/projects", async () => {
      encryptService.encryptString.mockResolvedValue({
        encryptedString: "enc-new-project",
      } as EncString);
      apiService.send.mockResolvedValue({ Id: "new-project-1", Name: "enc-new-project" });

      const result = await service.createProject(OrgReadable, UserOne, "my-app");

      expect(encryptService.encryptString).toHaveBeenCalledWith("my-app", SomeKey);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/organizations/${OrgReadable}/projects`,
        { name: "enc-new-project" },
        true,
        true,
      );
      expect(result).toEqual({ id: "new-project-1", name: "my-app" });
    });

    it("throws (does not swallow) when the API call fails", async () => {
      encryptService.encryptString.mockResolvedValue({ encryptedString: "enc" } as EncString);
      apiService.send.mockRejectedValue(new Error("plan project limit reached"));

      await expect(service.createProject(OrgReadable, UserOne, "my-app")).rejects.toThrow(
        "plan project limit reached",
      );
    });

    it("does not mark the create call as agent-mediated (only secret reads/creates are, not projects)", async () => {
      encryptService.encryptString.mockResolvedValue({
        encryptedString: "enc-new-project",
      } as EncString);
      apiService.send.mockResolvedValue({ Id: "new-project-1", Name: "enc-new-project" });

      await service.createProject(OrgReadable, UserOne, "my-app");

      const [, , , , , apiUrl, alterHeaders] = apiService.send.mock.calls[0];
      expect(apiUrl).toBeUndefined();
      expect(alterHeaders).toBeUndefined();
    });
  });

  describe("createSecret", () => {
    beforeEach(() => {
      encryptService.encryptString.mockImplementation(
        (async (plaintext: string) =>
          ({ encryptedString: `enc-${plaintext}` }) as EncString) as any,
      );
    });

    it("encrypts name/value/note with the organization key and posts the SecretRequest wire shape", async () => {
      apiService.send.mockResolvedValue({ Id: "new-secret-1" });

      const secretId = await service.createSecret(OrgReadable, UserOne, "proj-1", {
        name: "DB_PASSWORD",
        value: "hunter2",
        note: "prod db",
      });

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/organizations/${OrgReadable}/secrets`,
        {
          key: "enc-DB_PASSWORD",
          value: "enc-hunter2",
          note: "enc-prod db",
          projectIds: ["proj-1"],
        },
        true,
        true,
        null,
        expect.any(Function),
      );
      expect(secretId).toBe("new-secret-1");

      // M4c (agent-access-architecture.md): secret creation is marked agent-mediated so the
      // server logs Secret_CreatedByAgent instead of Secret_Created.
      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("encrypts an empty string for a missing note, mirroring the web client (never omits the field)", async () => {
      apiService.send.mockResolvedValue({ Id: "new-secret-1" });

      await service.createSecret(OrgReadable, UserOne, "proj-1", {
        name: "DB_PASSWORD",
        value: "hunter2",
      });

      expect(encryptService.encryptString).toHaveBeenCalledWith("", SomeKey);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        expect.any(String),
        expect.objectContaining({ note: "enc-" }),
        true,
        true,
        null,
        expect.any(Function),
      );
    });

    it("sends projectIds: undefined (never an empty array) for a project-less admin create", async () => {
      apiService.send.mockResolvedValue({ Id: "new-secret-1" });

      await service.createSecret(OrgReadable, UserOne, null, {
        name: "DB_PASSWORD",
        value: "hunter2",
      });

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        expect.any(String),
        expect.objectContaining({ projectIds: undefined }),
        true,
        true,
        null,
        expect.any(Function),
      );
    });

    it("never includes accessPoliciesRequests in the request body", async () => {
      apiService.send.mockResolvedValue({ Id: "new-secret-1" });

      await service.createSecret(OrgReadable, UserOne, "proj-1", {
        name: "DB_PASSWORD",
        value: "hunter2",
      });

      const [, , body] = apiService.send.mock.calls[0];
      expect(body).not.toHaveProperty("accessPoliciesRequests");
    });

    it("seeds the session-scoped name cache with the created secret's name, resolvable via resolveSecretName", async () => {
      apiService.send.mockResolvedValue({ Id: "new-secret-1" });

      await service.createSecret(OrgReadable, UserOne, "proj-1", {
        name: "DB_PASSWORD",
        value: "hunter2",
      });

      expect(service.resolveSecretName("new-secret-1")).toBe("DB_PASSWORD");
    });

    it("throws (does not swallow) when the API call fails", async () => {
      apiService.send.mockRejectedValue(new Error("server error"));

      await expect(
        service.createSecret(OrgReadable, UserOne, "proj-1", {
          name: "DB_PASSWORD",
          value: "hunter2",
        }),
      ).rejects.toThrow("server error");
    });
  });
});

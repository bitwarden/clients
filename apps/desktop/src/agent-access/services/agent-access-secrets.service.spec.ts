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
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
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
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;

  function buildService(): AgentAccessSecretsService {
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();
    keyService = mock<KeyService>();
    accountService = mock<AccountService>();
    organizationService = mock<OrganizationService>();
    logService = mock<LogService>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();

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
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
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

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Search,
        "",
        UserOne,
      );

      expect(result.map((r) => r.secretId)).not.toContain("s-hidden");
    });

    it("skips a secret whose name fails to decrypt, without failing the whole lookup", async () => {
      stubOrgSecretsList();

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Search,
        "",
        UserOne,
      );

      expect(result.map((r) => r.secretId)).not.toContain("s-bad");
      expect(result.map((r) => r.secretId).sort()).toEqual(["s-api", "s-db"]);
    });

    it("Name query: exact match wins outright", async () => {
      stubOrgSecretsList();

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Name,
        "DB_PASSWORD",
        UserOne,
      );

      expect(result).toEqual([expect.objectContaining({ secretId: "s-db", name: "DB_PASSWORD" })]);
    });

    it("Name query: falls back to a unique case-insensitive match", async () => {
      stubOrgSecretsList();

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Name,
        "db_password",
        UserOne,
      );

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

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Name,
        "DB_PASSWORD",
        UserOne,
      );

      expect(result).toEqual([]);
    });

    it("Id query: matches by secret UUID", async () => {
      stubOrgSecretsList();

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Id,
        "s-api",
        UserOne,
      );

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

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Search,
        "token",
        UserOne,
      );

      expect(result.map((r) => r.secretId)).toEqual(["s-exact", "s-partial"]);
    });

    it("returns an empty array, without throwing, when listing an org's secrets fails", async () => {
      organizationService.organizations$.mockReturnValue(
        of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
      );
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Search,
        "anything",
        UserOne,
      );

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

    // BUG 1 fix: SM enforces secret-name uniqueness per project, not per org, so `findSecrets`'s
    // org-wide listing can legitimately surface two secrets sharing both `name` and
    // `organizationName`. Without a project identifier the approval picker cannot tell them apart
    // (identical label AND identical hint) — these tests confirm `projectId`/`projectName` are
    // decrypted and carried through so it can.
    describe("project disambiguation", () => {
      it("carries a secret's project id and decrypted project name, for disambiguation", async () => {
        organizationService.organizations$.mockReturnValue(
          of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
        );
        apiService.send.mockResolvedValue({
          secrets: [
            {
              Id: "s-1",
              OrganizationId: OrgReadable,
              Key: "enc-name",
              Read: true,
              Projects: [{ Id: "proj-1", Name: "enc-proj-web" }],
            },
          ],
        });
        encryptService.decryptString.mockImplementation(
          decryptByCiphertext({ "enc-name": "API_KEY", "enc-proj-web": "web-app" }),
        );

        const { matches: result } = await service.findSecrets(
          CredentialQueryType.Search,
          "",
          UserOne,
        );

        expect(result).toEqual([
          expect.objectContaining({
            secretId: "s-1",
            name: "API_KEY",
            projectId: "proj-1",
            projectName: "web-app",
          }),
        ]);
      });

      it("leaves projectId/projectName absent for a secret with no associated project", async () => {
        stubOrgSecretsList();

        const { matches: result } = await service.findSecrets(
          CredentialQueryType.Search,
          "",
          UserOne,
        );

        for (const match of result) {
          expect(match.projectId).toBeUndefined();
          expect(match.projectName).toBeUndefined();
        }
      });

      it("two secrets, same name, same org, different projects: both surface with distinct project names", async () => {
        organizationService.organizations$.mockReturnValue(
          of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
        );
        apiService.send.mockResolvedValue({
          secrets: [
            {
              Id: "s-web",
              OrganizationId: OrgReadable,
              Key: "enc-api-key",
              Read: true,
              Projects: [{ Id: "proj-web", Name: "enc-proj-web" }],
            },
            {
              Id: "s-mobile",
              OrganizationId: OrgReadable,
              Key: "enc-api-key",
              Read: true,
              Projects: [{ Id: "proj-mobile", Name: "enc-proj-mobile" }],
            },
          ],
        });
        encryptService.decryptString.mockImplementation(
          decryptByCiphertext({
            "enc-api-key": "API_KEY",
            "enc-proj-web": "web-app",
            "enc-proj-mobile": "mobile-app",
          }),
        );

        const { matches: result } = await service.findSecrets(
          CredentialQueryType.Search,
          "api",
          UserOne,
        );

        expect(result).toHaveLength(2);
        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              secretId: "s-web",
              name: "API_KEY",
              organizationName: "Acme Inc",
              projectName: "web-app",
            }),
            expect.objectContaining({
              secretId: "s-mobile",
              name: "API_KEY",
              organizationName: "Acme Inc",
              projectName: "mobile-app",
            }),
          ]),
        );
        // The two matches must be distinguishable from each other purely on their own fields.
        expect(result[0].projectName).not.toEqual(result[1].projectName);
      });

      it("skips (but does not fail the whole secret) a project name that fails to decrypt", async () => {
        organizationService.organizations$.mockReturnValue(
          of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
        );
        apiService.send.mockResolvedValue({
          secrets: [
            {
              Id: "s-1",
              OrganizationId: OrgReadable,
              Key: "enc-name",
              Read: true,
              Projects: [{ Id: "proj-1", Name: "enc-proj-corrupt" }],
            },
          ],
        });
        encryptService.decryptString.mockImplementation((async (encString: EncString) => {
          const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
          if (ciphertext === "enc-proj-corrupt") {
            throw new Error("decrypt failed");
          }
          return ({ "enc-name": "API_KEY" } as Record<string, string>)[ciphertext];
        }) as any);

        const { matches: result } = await service.findSecrets(
          CredentialQueryType.Search,
          "",
          UserOne,
        );

        expect(result).toEqual([
          expect.objectContaining({ secretId: "s-1", name: "API_KEY", projectId: "proj-1" }),
        ]);
        expect(result[0].projectName).toBeUndefined();
      });
    });

    // BUG 2 fix: the exact-match branch used to `.find()` and silently drop every match but the
    // first when two secrets shared the exact queried name — the dropped secret was never shown
    // to the user at all, not even in a picker. It must now behave like the Search path and
    // surface every exact match.
    it("Name query: returns every exact match, not just the first, when the name collides", async () => {
      organizationService.organizations$.mockReturnValue(
        of([
          makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true }),
          makeOrg({
            id: OrgSecond,
            name: "Other Org",
            enabled: true,
            canAccessSecretsManager: true,
          }),
        ]),
      );
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === `/organizations/${OrgReadable}/secrets`) {
          return {
            secrets: [{ Id: "s-1", OrganizationId: OrgReadable, Key: "enc-1", Read: true }],
          };
        }
        if (method === "GET" && path === `/organizations/${OrgSecond}/secrets`) {
          return { secrets: [{ Id: "s-2", OrganizationId: OrgSecond, Key: "enc-2", Read: true }] };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-1": "API_KEY", "enc-2": "API_KEY" }),
      );

      const { matches: result } = await service.findSecrets(
        CredentialQueryType.Name,
        "API_KEY",
        UserOne,
      );

      expect(result.map((r) => r.secretId).sort()).toEqual(["s-1", "s-2"]);
    });

    // `truncated` (agent-access-design-spec.md §3.3): `matchSecrets` sees the full, uncapped
    // candidate list before applying `MAX_SM_MATCHES` (not exported — mirrored here as a literal,
    // same discipline the service itself already uses for this value), so it can report exactly
    // whether the cap actually cut anything off, rather than a caller guessing from
    // `matches.length` landing on the cap. These mirror the exactly-at-cap vs. genuinely-over-cap
    // pairs already covering `findCiphers`'s Domain/Search paths in
    // `desktop-agent-access.service.spec.ts`.
    describe("truncated — reports whether the cap actually cut off matches", () => {
      function stubManySecrets(count: number, name: string) {
        organizationService.organizations$.mockReturnValue(
          of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
        );
        apiService.send.mockResolvedValue({
          secrets: Array.from({ length: count }, (_, i) => ({
            Id: `s-${i}`,
            OrganizationId: OrgReadable,
            Key: `enc-${i}`,
            Read: true,
          })),
        });
        // Every secret in the fixture shares the same encrypted name, decrypting to `name`
        // regardless of which ciphertext it is — the point of this helper is a uniform batch of
        // same-named secrets to exercise the cap, not distinct names.
        encryptService.decryptString.mockResolvedValue(name);
      }

      it("Name query: reports truncated: false when exact matches land exactly on the cap", async () => {
        stubManySecrets(20, "SHARED_NAME");

        const { matches, truncated } = await service.findSecrets(
          CredentialQueryType.Name,
          "SHARED_NAME",
          UserOne,
        );

        expect(matches).toHaveLength(20);
        expect(truncated).toBe(false);
      });

      it("Name query: reports truncated: true when more exact matches exist beyond the cap", async () => {
        stubManySecrets(21, "SHARED_NAME");

        const { matches, truncated } = await service.findSecrets(
          CredentialQueryType.Name,
          "SHARED_NAME",
          UserOne,
        );

        expect(matches).toHaveLength(20);
        expect(truncated).toBe(true);
      });

      it("Search query: reports truncated: false when the match count lands exactly on the cap", async () => {
        stubManySecrets(20, "shared_name");

        const { matches, truncated } = await service.findSecrets(
          CredentialQueryType.Search,
          "shared_name",
          UserOne,
        );

        expect(matches).toHaveLength(20);
        expect(truncated).toBe(false);
      });

      it("Search query: reports truncated: true when a substring match exists beyond the cap", async () => {
        // 20 exact matches fill the cap on the first pass; one further secret only matches the
        // substring pass and would previously never have been considered at all once the cap was
        // hit — it must still be able to flip `truncated` even though it never lands in `matches`.
        organizationService.organizations$.mockReturnValue(
          of([makeOrg({ id: OrgReadable, enabled: true, canAccessSecretsManager: true })]),
        );
        apiService.send.mockResolvedValue({
          secrets: [
            ...Array.from({ length: 20 }, (_, i) => ({
              Id: `s-${i}`,
              OrganizationId: OrgReadable,
              Key: `enc-${i}`,
              Read: true,
            })),
            { Id: "s-overflow", OrganizationId: OrgReadable, Key: "enc-overflow", Read: true },
          ],
        });
        encryptService.decryptString.mockImplementation((async (encString: EncString) => {
          const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
          return ciphertext === "enc-overflow" ? "shared_name_extra" : "shared_name";
        }) as any);

        const { matches, truncated } = await service.findSecrets(
          CredentialQueryType.Search,
          "shared_name",
          UserOne,
        );

        expect(matches).toHaveLength(20);
        expect(matches.some((m) => m.secretId === "s-overflow")).toBe(false);
        expect(truncated).toBe(true);
      });
    });
  });

  // M7 (agent-access-architecture.md, "M7 — `bws run` parity"): the enumeration step of a
  // `projectSecretsRequest` — names only, before any dialog, unlogged server-side (no header).
  describe("listSecretsInProject", () => {
    function stubProjectSecretsList() {
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === "/projects/proj-1/secrets") {
          return {
            Secrets: [
              { Id: "s-db", OrganizationId: OrgReadable, Key: "enc-db", Read: true },
              { Id: "s-api", OrganizationId: OrgReadable, Key: "enc-api", Read: true },
              // Not readable: filtered out before decryption.
              { Id: "s-hidden", OrganizationId: OrgReadable, Key: "enc-hidden", Read: false },
              // Undecryptable: skips this one secret, never fails the whole call.
              { Id: "s-bad", OrganizationId: OrgReadable, Key: "enc-corrupt", Read: true },
            ],
          };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
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

    it("returns every readable secret's decrypted name, scoped to the project", async () => {
      stubProjectSecretsList();

      const result = await service.listSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(result.map((r) => r.secretId).sort()).toEqual(["s-api", "s-db"]);
      expect(result).toEqual(
        expect.arrayContaining([
          { secretId: "s-db", name: "DB_PASSWORD", organizationId: OrgReadable },
          { secretId: "s-api", name: "API_KEY", organizationId: OrgReadable },
        ]),
      );
    });

    it("filters out secrets the user can't read", async () => {
      stubProjectSecretsList();

      const result = await service.listSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(result.map((r) => r.secretId)).not.toContain("s-hidden");
    });

    it("skips a secret whose name fails to decrypt, without failing the whole call", async () => {
      stubProjectSecretsList();

      const result = await service.listSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(result.map((r) => r.secretId)).not.toContain("s-bad");
    });

    it("populates the session-scoped name cache as it decrypts", async () => {
      stubProjectSecretsList();

      await service.listSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(service.resolveSecretName("s-db")).toBe("DB_PASSWORD");
    });

    it("does not mark the call as agent-mediated (list endpoints are unlogged)", async () => {
      stubProjectSecretsList();

      await service.listSecretsInProject("proj-1", OrgReadable, UserOne);

      const [, , , , , apiUrl, alterHeaders] = apiService.send.mock.calls[0];
      expect(apiUrl).toBeUndefined();
      expect(alterHeaders).toBeUndefined();
    });

    it("returns an empty array, without throwing, when the API call fails", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      const result = await service.listSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(result).toEqual([]);
    });

    it("returns an empty array when the account has no key for the organization", async () => {
      const result = await service.listSecretsInProject("proj-1", OrgNoAccess, UserOne);

      expect(result).toEqual([]);
      expect(apiService.send).not.toHaveBeenCalled();
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

  // M7 (agent-access-architecture.md, "M7 — `bws run` parity"): the post-approval bulk value
  // fetch behind `projectSecretsRequest` — the multi-secret analogue of `getSecretValue`.
  describe("getSecretValuesByIds", () => {
    it("posts the id array to /secrets/get-by-ids with the agent-mediated header and decrypts names+values", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          { Id: "s-db", Key: "enc-db", Value: "enc-val-db" },
          { Id: "s-api", Key: "enc-api", Value: "enc-val-api" },
        ],
      });
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({
          "enc-db": "DB_PASSWORD",
          "enc-val-db": "hunter2",
          "enc-api": "API_KEY",
          "enc-val-api": "sk-live-123",
        }),
      );

      const result = await service.getSecretValuesByIds(["s-db", "s-api"], OrgReadable, UserOne);

      expect(apiService.send).toHaveBeenCalledTimes(1);
      const [method, path, body, authed, hasResponse, apiUrl, alterHeaders] =
        apiService.send.mock.calls[0];
      expect(method).toBe("POST");
      expect(path).toBe("/secrets/get-by-ids");
      expect(body).toEqual({ ids: ["s-db", "s-api"] });
      expect(authed).toBe(true);
      expect(hasResponse).toBe(true);
      expect(apiUrl).toBeNull();
      expect(result).toEqual(
        expect.arrayContaining([
          { id: "s-db", name: "DB_PASSWORD", value: "hunter2" },
          { id: "s-api", name: "API_KEY", value: "sk-live-123" },
        ]),
      );

      // M7-E: marked agent-mediated so the server logs Secret_RetrievedByAgent per secret.
      expect(typeof alterHeaders).toBe("function");
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("filters the response to only the requested id set — never releases an id that wasn't asked for", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          { Id: "s-db", Key: "enc-db", Value: "enc-val-db" },
          // The server included this one even though it wasn't requested — it must be dropped.
          { Id: "s-unrequested", Key: "enc-other", Value: "enc-val-other" },
        ],
      });
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({
          "enc-db": "DB_PASSWORD",
          "enc-val-db": "hunter2",
          "enc-other": "OTHER",
          "enc-val-other": "should-not-be-released",
        }),
      );

      const result = await service.getSecretValuesByIds(["s-db"], OrgReadable, UserOne);

      expect(result).toEqual([{ id: "s-db", name: "DB_PASSWORD", value: "hunter2" }]);
      expect(result.map((r) => r.id)).not.toContain("s-unrequested");
    });

    it("skips (does not fail the whole call for) an entry whose value fails to decrypt", async () => {
      apiService.send.mockResolvedValue({
        Data: [
          { Id: "s-db", Key: "enc-db", Value: "enc-val-db" },
          { Id: "s-bad", Key: "enc-bad", Value: "enc-corrupt" },
        ],
      });
      encryptService.decryptString.mockImplementation((async (encString: EncString) => {
        const ciphertext = (encString as unknown as { encryptedString: string }).encryptedString;
        if (ciphertext === "enc-corrupt") {
          throw new Error("decrypt failed");
        }
        return (
          { "enc-db": "DB_PASSWORD", "enc-val-db": "hunter2", "enc-bad": "BAD" } as Record<
            string,
            string
          >
        )[ciphertext];
      }) as any);

      const result = await service.getSecretValuesByIds(["s-db", "s-bad"], OrgReadable, UserOne);

      expect(result).toEqual([{ id: "s-db", name: "DB_PASSWORD", value: "hunter2" }]);
    });

    it("throws (does not swallow) when the account has no key for the organization", async () => {
      await expect(service.getSecretValuesByIds(["s-db"], OrgNoAccess, UserOne)).rejects.toThrow(
        /no organization key/,
      );
      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("throws (does not swallow) when the API call fails", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      await expect(
        service.getSecretValuesByIds(["s-db"], OrgReadable, UserOne),
      ).rejects.toBeInstanceOf(ErrorResponse);
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

  // M7 (agent-access-architecture.md, "M7 — `bws run` parity"): resolves a `projectSecretsRequest`
  // wire message's `project.id`/`project.name` selector against every SM org, BEFORE the release
  // dialog opens.
  describe("resolveProjectSelector", () => {
    function stubTwoOrgProjects() {
      organizationService.organizations$.mockReturnValue(
        of([
          makeOrg({
            id: OrgReadable,
            name: "Acme Inc",
            enabled: true,
            canAccessSecretsManager: true,
          }),
          makeOrg({
            id: OrgSecond,
            name: "Other Co",
            enabled: true,
            canAccessSecretsManager: true,
          }),
        ]),
      );
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === `/organizations/${OrgReadable}/projects`) {
          return {
            data: [{ Id: "p-1", OrganizationId: OrgReadable, Name: "enc-my-app", Write: true }],
          };
        }
        if (method === "GET" && path === `/organizations/${OrgSecond}/projects`) {
          return {
            data: [{ Id: "p-2", OrganizationId: OrgSecond, Name: "enc-other-app", Write: false }],
          };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-my-app": "my-app", "enc-other-app": "other-app" }),
      );
    }

    it("id form: resolves the matching project across every SM org", async () => {
      stubTwoOrgProjects();

      const result = await service.resolveProjectSelector({ id: "p-2" }, UserOne);

      expect(result).toEqual({
        projectId: "p-2",
        projectName: "other-app",
        organizationId: OrgSecond,
        organizationName: "Other Co",
      });
    });

    it("id form: returns null when no project matches the id", async () => {
      stubTwoOrgProjects();

      const result = await service.resolveProjectSelector({ id: "p-missing" }, UserOne);

      expect(result).toBeNull();
    });

    it("name form: exact match wins outright", async () => {
      stubTwoOrgProjects();

      const result = await service.resolveProjectSelector({ name: "my-app" }, UserOne);

      expect(result).toEqual(expect.objectContaining({ projectId: "p-1", projectName: "my-app" }));
    });

    it("name form: falls back to a unique case-insensitive match", async () => {
      stubTwoOrgProjects();

      const result = await service.resolveProjectSelector({ name: "MY-APP" }, UserOne);

      expect(result).toEqual(expect.objectContaining({ projectId: "p-1", projectName: "my-app" }));
    });

    it("name form: returns null when the case-insensitive match is ambiguous", async () => {
      organizationService.organizations$.mockReturnValue(
        of([
          makeOrg({
            id: OrgReadable,
            name: "Acme Inc",
            enabled: true,
            canAccessSecretsManager: true,
          }),
          makeOrg({
            id: OrgSecond,
            name: "Other Co",
            enabled: true,
            canAccessSecretsManager: true,
          }),
        ]),
      );
      apiService.send.mockImplementation((async (method: string, path: string) => {
        if (method === "GET" && path === `/organizations/${OrgReadable}/projects`) {
          return { data: [{ Id: "p-1", OrganizationId: OrgReadable, Name: "enc-1", Write: true }] };
        }
        if (method === "GET" && path === `/organizations/${OrgSecond}/projects`) {
          return { data: [{ Id: "p-2", OrganizationId: OrgSecond, Name: "enc-2", Write: true }] };
        }
        throw new Error(`unexpected request: ${method} ${path}`);
      }) as any);
      // Neither is an exact match for the query below, but both match it case-insensitively.
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-1": "my-app", "enc-2": "My-App" }),
      );

      const result = await service.resolveProjectSelector({ name: "MY-APP" }, UserOne);

      expect(result).toBeNull();
    });

    it("returns null when the user has no SM organizations", async () => {
      organizationService.organizations$.mockReturnValue(of([]));

      const result = await service.resolveProjectSelector({ id: "p-1" }, UserOne);

      expect(result).toBeNull();
      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("returns null when neither id nor name is given", async () => {
      stubTwoOrgProjects();

      const result = await service.resolveProjectSelector({}, UserOne);

      expect(result).toBeNull();
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
        null,
        expect.any(Function),
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

    // M6-D fix: createProject predated the agent-mediated header convention (an oversight) — it
    // now sends the header like every other SM mutation (invariant 19).
    it("marks the create call as agent-mediated (M6-D fix: createProject previously omitted this)", async () => {
      encryptService.encryptString.mockResolvedValue({
        encryptedString: "enc-new-project",
      } as EncString);
      apiService.send.mockResolvedValue({ Id: "new-project-1", Name: "enc-new-project" });

      await service.createProject(OrgReadable, UserOne, "my-app");

      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("seeds the project name cache with the created project's name, resolvable via resolveProjectName", async () => {
      encryptService.encryptString.mockResolvedValue({ encryptedString: "enc" } as EncString);
      apiService.send.mockResolvedValue({ Id: "new-project-1", Name: "enc" });

      await service.createProject(OrgReadable, UserOne, "my-app");

      expect(service.resolveProjectName("new-project-1")).toBe("my-app");
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

  // M6-D: fetches the ciphertexts an update needs, decrypting only the name.
  describe("getSecretForUpdate", () => {
    it("decrypts only the name, and passes back Value/Note as opaque ciphertext strings", async () => {
      apiService.send.mockResolvedValue({
        Id: "s-a",
        OrganizationId: OrgReadable,
        Key: "enc-db",
        Value: "enc-val-a",
        Note: "enc-note-a",
        Projects: [{ Id: "proj-1" }],
      });
      encryptService.decryptString.mockImplementation(
        decryptByCiphertext({ "enc-db": "DB_PASSWORD" }),
      );

      const result = await service.getSecretForUpdate("s-a", OrgReadable, UserOne);

      expect(result).toEqual({
        secretId: "s-a",
        organizationId: OrgReadable,
        nameDecrypted: "DB_PASSWORD",
        keyEncString: "enc-db",
        valueEncString: "enc-val-a",
        noteEncString: "enc-note-a",
        currentProjectId: "proj-1",
      });
      // The value/note ciphertexts were never handed to decryptString — only the name was.
      expect(encryptService.decryptString).toHaveBeenCalledTimes(1);
      expect(encryptService.decryptString).toHaveBeenCalledWith(
        expect.objectContaining({ encryptedString: "enc-db" }),
        expect.anything(),
      );
    });

    it("sends the agent-mediated header", async () => {
      apiService.send.mockResolvedValue({
        Id: "s-a",
        OrganizationId: OrgReadable,
        Key: "enc-db",
        Value: "enc-val-a",
      });
      encryptService.decryptString.mockResolvedValue("DB_PASSWORD");

      await service.getSecretForUpdate("s-a", OrgReadable, UserOne);

      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("has no currentProjectId when the secret has no projects", async () => {
      apiService.send.mockResolvedValue({
        Id: "s-a",
        OrganizationId: OrgReadable,
        Key: "enc-db",
        Value: "enc-val-a",
        Projects: [],
      });
      encryptService.decryptString.mockResolvedValue("DB_PASSWORD");

      const result = await service.getSecretForUpdate("s-a", OrgReadable, UserOne);

      expect(result.currentProjectId).toBeUndefined();
    });

    it("throws (does not swallow) when the account has no key for the organization", async () => {
      await expect(service.getSecretForUpdate("s-a", OrgNoAccess, UserOne)).rejects.toThrow(
        /no organization key/,
      );
      expect(apiService.send).not.toHaveBeenCalled();
    });

    it("throws (does not swallow) when the API call fails", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      await expect(service.getSecretForUpdate("s-a", OrgReadable, UserOne)).rejects.toBeInstanceOf(
        ErrorResponse,
      );
    });
  });

  // M6-D: ciphertext passthrough — an update that doesn't change a field never decrypts it, and
  // the PUT body always carries key/value/note (changed = fresh ciphertext, unchanged = the
  // original ciphertext string, verbatim).
  describe("updateSecret", () => {
    beforeEach(() => {
      encryptService.encryptString.mockImplementation(
        (async (plaintext: string) =>
          ({ encryptedString: `enc-${plaintext}` }) as EncString) as any,
      );
    });

    it("passes through the original ciphertexts verbatim when nothing changed but the caller still sends key/value/note", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "orig-key-ct",
        valueEncString: "orig-value-ct",
        noteEncString: "orig-note-ct",
      });

      // The value/note ciphertexts were never decrypted, and never re-encrypted — passed through
      // verbatim to the PUT body (the ciphertext passthrough invariant).
      expect(encryptService.decryptString).not.toHaveBeenCalled();
      expect(encryptService.encryptString).not.toHaveBeenCalled();
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/secrets/s-a",
        {
          key: "orig-key-ct",
          value: "orig-value-ct",
          note: "orig-note-ct",
          projectIds: undefined,
        },
        true,
        true,
        null,
        expect.any(Function),
      );
    });

    it("freshly encrypts only the fields that changed, passing the rest through as ciphertext", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "orig-key-ct",
        name: "NEW_NAME",
        valueEncString: "orig-value-ct",
        noteEncString: "orig-note-ct",
      });

      expect(encryptService.encryptString).toHaveBeenCalledTimes(1);
      expect(encryptService.encryptString).toHaveBeenCalledWith("NEW_NAME", SomeKey);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/secrets/s-a",
        {
          key: "enc-NEW_NAME",
          value: "orig-value-ct",
          note: "orig-note-ct",
          projectIds: undefined,
        },
        true,
        true,
        null,
        expect.any(Function),
      );
    });

    it("clears the note by encrypting an empty string when note is an explicit empty string", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "orig-key-ct",
        valueEncString: "orig-value-ct",
        noteEncString: "orig-note-ct",
        note: "",
      });

      expect(encryptService.encryptString).toHaveBeenCalledWith("", SomeKey);
      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/secrets/s-a",
        expect.objectContaining({ note: "enc-" }),
        true,
        true,
        null,
        expect.any(Function),
      );
    });

    it("omits projectIds when the secret has no project and no move was confirmed", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "k",
        valueEncString: "v",
        noteEncString: "n",
      });

      const [, , body] = apiService.send.mock.calls[0];
      expect((body as any).projectIds).toBeUndefined();
    });

    // Regression: the server's `SecretUpdateRequestModel.ToSecret` only treats the association as
    // unchanged when the incoming first project id EQUALS the stored one — a null `ProjectIds`
    // against a project-assigned secret falls through to `Projects = []` and unassigns it. A plain
    // value rotation proposes no move, so without carrying `currentProjectId` forward every
    // agent-mediated rotation silently stripped the secret out of its project.
    it("re-sends the current projectId when no move was confirmed, so the server does not unassign", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "k",
        valueEncString: "v",
        value: "rotated",
        noteEncString: "n",
        currentProjectId: "proj-current",
      });

      const [, , body] = apiService.send.mock.calls[0];
      expect((body as any).projectIds).toEqual(["proj-current"]);
    });

    it("sends projectIds: [newProjectId] when a move was confirmed — never an empty array", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "k",
        valueEncString: "v",
        noteEncString: "n",
        projectId: "proj-new",
      });

      const [, , body] = apiService.send.mock.calls[0];
      expect((body as any).projectIds).toEqual(["proj-new"]);
    });

    it("prefers a confirmed move over the current project", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "k",
        valueEncString: "v",
        noteEncString: "n",
        projectId: "proj-new",
        currentProjectId: "proj-current",
      });

      const [, , body] = apiService.send.mock.calls[0];
      expect((body as any).projectIds).toEqual(["proj-new"]);
    });

    it("sends the agent-mediated header", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "k",
        valueEncString: "v",
        noteEncString: "n",
      });

      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("updates the name cache when the name changed", async () => {
      apiService.send.mockResolvedValue({});

      await service.updateSecret(OrgReadable, UserOne, "s-a", {
        keyEncString: "k",
        name: "RENAMED",
        valueEncString: "v",
        noteEncString: "n",
      });

      expect(service.resolveSecretName("s-a")).toBe("RENAMED");
    });

    it("throws (does not swallow) when the API call fails", async () => {
      apiService.send.mockRejectedValue(new Error("server error"));

      await expect(
        service.updateSecret(OrgReadable, UserOne, "s-a", {
          keyEncString: "k",
          valueEncString: "v",
          noteEncString: "n",
        }),
      ).rejects.toThrow("server error");
    });

    it("throws (does not swallow) when the account has no key for the organization", async () => {
      await expect(
        service.updateSecret(OrgNoAccess, UserOne, "s-a", {
          keyEncString: "k",
          valueEncString: "v",
          noteEncString: "n",
        }),
      ).rejects.toThrow(/no organization key/);
      expect(apiService.send).not.toHaveBeenCalled();
    });
  });

  describe("deleteSecret", () => {
    it("sends the bare id array to POST /secrets/delete with the agent-mediated header", async () => {
      apiService.send.mockResolvedValue({ data: [{ id: "s-a", error: null }] });

      await service.deleteSecret("s-a", OrgReadable, UserOne);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/secrets/delete",
        ["s-a"],
        true,
        true,
        null,
        expect.any(Function),
      );
      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("throws a generic error (never the server's own text) on a non-null per-id error", async () => {
      apiService.send.mockResolvedValue({
        data: [{ id: "s-a", error: "internal policy detail the user should never see" }],
      });

      await expect(service.deleteSecret("s-a", OrgReadable, UserOne)).rejects.toThrow(
        /failed to delete/,
      );
      await expect(service.deleteSecret("s-a", OrgReadable, UserOne)).rejects.not.toThrow(
        /internal policy detail/,
      );
    });

    it("succeeds when the per-id error is null", async () => {
      apiService.send.mockResolvedValue({ data: [{ id: "s-a", error: null }] });

      await expect(service.deleteSecret("s-a", OrgReadable, UserOne)).resolves.toBeUndefined();
    });

    it("propagates a transport-level failure", async () => {
      apiService.send.mockRejectedValue(new Error("network error"));

      await expect(service.deleteSecret("s-a", OrgReadable, UserOne)).rejects.toThrow(
        "network error",
      );
    });
  });

  describe("updateProject", () => {
    it("encrypts the new name and PUTs to /projects/{id} with the agent-mediated header", async () => {
      encryptService.encryptString.mockResolvedValue({
        encryptedString: "enc-renamed",
      } as EncString);
      apiService.send.mockResolvedValue({});

      await service.updateProject("proj-1", OrgReadable, UserOne, "renamed-app");

      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        "/projects/proj-1",
        { name: "enc-renamed" },
        true,
        true,
        null,
        expect.any(Function),
      );
      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("updates the project name cache, resolvable via resolveProjectName", async () => {
      encryptService.encryptString.mockResolvedValue({ encryptedString: "enc" } as EncString);
      apiService.send.mockResolvedValue({});

      await service.updateProject("proj-1", OrgReadable, UserOne, "renamed-app");

      expect(service.resolveProjectName("proj-1")).toBe("renamed-app");
    });

    it("throws (does not swallow) when the API call fails", async () => {
      encryptService.encryptString.mockResolvedValue({ encryptedString: "enc" } as EncString);
      apiService.send.mockRejectedValue(new Error("server error"));

      await expect(
        service.updateProject("proj-1", OrgReadable, UserOne, "renamed-app"),
      ).rejects.toThrow("server error");
    });
  });

  describe("deleteProject", () => {
    it("sends the bare id array to POST /projects/delete with the agent-mediated header", async () => {
      apiService.send.mockResolvedValue({ data: [{ id: "proj-1", error: null }] });

      await service.deleteProject("proj-1", OrgReadable, UserOne);

      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/projects/delete",
        ["proj-1"],
        true,
        true,
        null,
        expect.any(Function),
      );
      const [, , , , , , alterHeaders] = apiService.send.mock.calls[0];
      const headers = new Headers();
      (alterHeaders as (headers: Headers) => void)(headers);
      expect(headers.get("Bitwarden-Agent-Mediated")).toBe("1");
    });

    it("throws a generic error on a non-null per-id error", async () => {
      apiService.send.mockResolvedValue({
        data: [{ id: "proj-1", error: "internal detail" }],
      });

      await expect(service.deleteProject("proj-1", OrgReadable, UserOne)).rejects.toThrow(
        /failed to delete/,
      );
    });
  });

  describe("countSecretsInProject", () => {
    it("returns the secret count from the wrapped Secrets array", async () => {
      apiService.send.mockResolvedValue({ Secrets: [{ Id: "s-1" }, { Id: "s-2" }] });

      const result = await service.countSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(result).toBe(2);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        "/projects/proj-1/secrets",
        null,
        true,
        true,
      );
    });

    it("does not mark the call as agent-mediated (list endpoints are unlogged)", async () => {
      apiService.send.mockResolvedValue({ Secrets: [] });

      await service.countSecretsInProject("proj-1", OrgReadable, UserOne);

      const [, , , , , apiUrl, alterHeaders] = apiService.send.mock.calls[0];
      expect(apiUrl).toBeUndefined();
      expect(alterHeaders).toBeUndefined();
    });

    it("degrades to undefined, without throwing, on failure", async () => {
      apiService.send.mockRejectedValue(new ErrorResponse({}, 404));

      const result = await service.countSecretsInProject("proj-1", OrgReadable, UserOne);

      expect(result).toBeUndefined();
    });
  });

  describe("generateSecretValue", () => {
    it("generates with the default length (40) and symbols enabled", async () => {
      passwordGenerationService.generatePassword.mockResolvedValue("generated-value");

      const result = await service.generateSecretValue();

      expect(result).toBe("generated-value");
      expect(passwordGenerationService.generatePassword).toHaveBeenCalledWith({
        length: 40,
        uppercase: true,
        lowercase: true,
        number: true,
        minNumber: 1,
        special: true,
        minSpecial: 1,
        ambiguous: true,
      });
    });

    it("honors an explicit length and symbols: false", async () => {
      passwordGenerationService.generatePassword.mockResolvedValue("generated-value");

      await service.generateSecretValue({ length: 64, symbols: false });

      expect(passwordGenerationService.generatePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          length: 64,
          special: false,
          minSpecial: 0,
        }),
      );
    });

    it("propagates a generator failure rather than swallowing it", async () => {
      passwordGenerationService.generatePassword.mockRejectedValue(new Error("generator error"));

      await expect(service.generateSecretValue()).rejects.toThrow("generator error");
    });
  });
});

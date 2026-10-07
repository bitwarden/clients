import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AgentAccessActivityEntry,
  CredentialRequestActivity,
} from "../models/agent-access-activity";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import { AgentAccessSecretsService } from "../services/agent-access-secrets.service";

import { AgentAccessActivityComponent } from "./agent-access-activity.component";

describe("AgentAccessActivityComponent", () => {
  let originalIpc: any;
  let mockGetActivity: jest.Mock;
  let activitySubject: Subject<{ entry: AgentAccessActivityEntry }>;
  let activityResetSubject: Subject<Record<string, never>>;
  let accountSubject: BehaviorSubject<{ id: UserId } | null>;
  let cipherViewsSubject: BehaviorSubject<CipherView[]>;

  const pendingRequest: CredentialRequestActivity = {
    type: "credential_request",
    id: "request-1",
    timestampMs: "1700000000000",
    agentName: "Cursor",
    origin: "local",
    queryType: "domain",
    queryValue: "github.com",
    status: "pending",
  };

  const sharedRequest: CredentialRequestActivity = {
    ...pendingRequest,
    status: "shared",
    cipherId: "cipher-1",
    fieldsShared: ["username", "password"],
    resolvedAtMs: "1700000005000",
  };

  const sharedSecretRequest: CredentialRequestActivity = {
    ...pendingRequest,
    resourceType: "secret",
    queryType: "name",
    queryValue: "DB_PASSWORD",
    status: "shared",
    secretId: "secret-1",
    fieldsShared: ["value"],
    resolvedAtMs: "1700000005000",
  };

  const connectionEvent: AgentAccessActivityEntry = {
    type: "lifecycle",
    id: "lifecycle-1",
    timestampMs: "1700000010000",
    agentName: "Work Laptop",
    kind: "connection_established",
    detail: "rendezvous",
  };

  let mockResolveSecretName: jest.Mock;
  let mockResolveProjectName: jest.Mock;

  function createComponent(): AgentAccessActivityComponent {
    const messageListener = {
      messages$: jest.fn().mockImplementation((def: { command: string }) => {
        if (def.command === AGENT_ACCESS_IPC_CHANNELS.ACTIVITY) {
          return activitySubject.asObservable();
        }
        if (def.command === AGENT_ACCESS_IPC_CHANNELS.ACTIVITY_RESET) {
          return activityResetSubject.asObservable();
        }
        return new Subject().asObservable();
      }),
    };
    // Every label goes through i18n; echo the key back so assertions can name it.
    const i18nService = { t: jest.fn().mockImplementation((key: string) => key) };

    const accountService = { activeAccount$: accountSubject.asObservable() };
    // The live vault the component names released items against. Kept as a subject so a test can
    // empty it — standing in for a lock or an account switch, after which ids stop resolving.
    const cipherService = {
      cipherViews$: jest.fn().mockReturnValue(cipherViewsSubject.asObservable()),
    };
    // The renderer-memory SM name cache — mirrors `cipherService` for secrets. Defaults to "not
    // seen this session" (undefined) so a test can opt in to a resolved name explicitly.
    mockResolveSecretName = jest.fn().mockReturnValue(undefined);
    // M6 project analogue of `resolveSecretName` — same "not seen this session" default.
    mockResolveProjectName = jest.fn().mockReturnValue(undefined);
    const agentAccessSecretsService = {
      resolveSecretName: mockResolveSecretName,
      resolveProjectName: mockResolveProjectName,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: MessageListener, useValue: messageListener },
        { provide: I18nService, useValue: i18nService },
        { provide: AccountService, useValue: accountService },
        { provide: CipherService, useValue: cipherService },
        { provide: AgentAccessSecretsService, useValue: agentAccessSecretsService },
      ],
    });
    return TestBed.runInInjectionContext(() => new AgentAccessActivityComponent());
  }

  /** Rows as the template sees them, newest first. */
  const rows = (component: AgentAccessActivityComponent) =>
    (component as any).rows() as AgentAccessActivityEntry[];

  beforeEach(() => {
    originalIpc = (global as any).ipc;
    activitySubject = new Subject();
    activityResetSubject = new Subject();
    accountSubject = new BehaviorSubject<{ id: UserId } | null>({ id: "user-1" as UserId });
    cipherViewsSubject = new BehaviorSubject<CipherView[]>([
      { id: "cipher-1", name: "GitHub" } as CipherView,
    ]);
    mockGetActivity = jest.fn().mockResolvedValue([]);
    (global as any).ipc = { agentAccess: { getActivity: mockGetActivity } };
  });

  afterEach(() => {
    (global as any).ipc = originalIpc;
    jest.clearAllMocks();
  });

  it("loads the main process's buffer on init, newest first", async () => {
    mockGetActivity.mockResolvedValue([pendingRequest, connectionEvent]);
    const component = createComponent();

    await component.ngOnInit();

    expect(rows(component).map((entry) => entry.id)).toEqual(["lifecycle-1", "request-1"]);
  });

  it("appends an entry it has not seen before", async () => {
    const component = createComponent();
    await component.ngOnInit();

    activitySubject.next({ entry: pendingRequest });

    expect(rows(component)).toEqual([pendingRequest]);
  });

  // The whole point of the one-row-per-request model: resolving a request must not add a row.
  it("replaces a request in place when its outcome arrives", async () => {
    mockGetActivity.mockResolvedValue([pendingRequest, connectionEvent]);
    const component = createComponent();
    await component.ngOnInit();

    activitySubject.next({ entry: sharedRequest });

    const current = rows(component);
    expect(current).toHaveLength(2);
    expect(current.find((entry) => entry.id === "request-1")).toEqual(sharedRequest);
  });

  // A resolved request keeps its slot rather than jumping to the top the moment the user answers.
  it("keeps a resolved request in its original chronological position", async () => {
    mockGetActivity.mockResolvedValue([pendingRequest, connectionEvent]);
    const component = createComponent();
    await component.ngOnInit();

    activitySubject.next({ entry: sharedRequest });

    expect(rows(component).map((entry) => entry.id)).toEqual(["lifecycle-1", "request-1"]);
  });

  it("re-fetches the buffer when the main process signals a reset", async () => {
    mockGetActivity.mockResolvedValue([pendingRequest]);
    const component = createComponent();
    await component.ngOnInit();

    mockGetActivity.mockResolvedValue([]);
    activityResetSubject.next({});
    await Promise.resolve();

    expect(rows(component)).toEqual([]);
  });

  describe("result labels", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("resolves the released item's name from the live vault, by id", () => {
      expect(resultLabel(sharedRequest)).toBe("agentAccessSharedItemFields");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessSharedItemFields",
        "GitHub",
        "username, password",
      );
    });

    // A locked vault, a switched account, or a deleted item all land here. The fields released are
    // still accurate, so report those rather than dropping the row's detail entirely.
    it("falls back to the fields alone when the id no longer resolves", () => {
      cipherViewsSubject.next([]);

      expect(resultLabel(sharedRequest)).toBe("agentAccessSharedFields");
    });

    it("falls back to the fields alone when no item was recorded at all", () => {
      expect(resultLabel({ ...sharedRequest, cipherId: undefined })).toBe(
        "agentAccessSharedFields",
      );
    });

    it("distinguishes a no-match from a user denial", () => {
      expect(resultLabel({ ...pendingRequest, status: "not_found" })).toBe(
        "agentAccessResultNoMatch",
      );
      expect(resultLabel({ ...pendingRequest, status: "denied" })).toBe("agentAccessResultDenied");
    });

    // The status badge already reads "Waiting for you"; a second line would just repeat it.
    it("says nothing extra while a request is still pending", () => {
      expect(resultLabel(pendingRequest)).toBeUndefined();
    });
  });

  // M4 (agent-access-architecture.md): resourceType: "secret" rows resolve their name from the
  // renderer-memory SM cache (never from the activity entry itself, which stores only ids).
  describe("secret result labels", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;
    const isSecretRequest = (entry: CredentialRequestActivity) =>
      (component as any).isSecretRequest(entry) as boolean;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("identifies a resourceType: 'secret' row as a secret request", () => {
      expect(isSecretRequest(sharedSecretRequest)).toBe(true);
      expect(isSecretRequest(sharedRequest)).toBe(false);
    });

    it("resolves the released secret's name from the SM name cache, by secretId", () => {
      // Deliberately different from `sharedSecretRequest.queryValue` ("DB_PASSWORD") so this
      // assertion can't pass by accident via the raw-query-value fallback below.
      mockResolveSecretName.mockReturnValue("PROD_DB_PASSWORD");

      expect(resultLabel(sharedSecretRequest)).toBe("agentAccessSharedItemFields");
      expect(mockResolveSecretName).toHaveBeenCalledWith("secret-1");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessSharedItemFields",
        "PROD_DB_PASSWORD",
        "value",
      );
    });

    // The name cache is session-scoped (populated only by a prior lookup) — a secret released in
    // an earlier session (or otherwise never looked up) has nothing to resolve. The raw query
    // value is the best available fallback, never a crash or a blank row.
    it("falls back to the raw query value when the secret name was never cached", () => {
      mockResolveSecretName.mockReturnValue(undefined);

      expect(resultLabel(sharedSecretRequest)).toBe("agentAccessSharedItemFields");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessSharedItemFields",
        "DB_PASSWORD",
        "value",
      );
    });
  });

  // M4b (agent-access-architecture.md, "M4b — secret creation"): a `Created` row has no
  // `queryType`/`queryValue` at all (the main process never stores them for a create — see
  // `queryType`'s doc on `CredentialRequestActivity`), so its name resolves from the SM name
  // cache exactly like a `Shared` secret row, but falls back to a generic label instead of a raw
  // query value that doesn't exist.
  describe("created result labels", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;
    const isCreateRequest = (entry: CredentialRequestActivity) =>
      (component as any).isCreateRequest(entry) as boolean;

    const createdRequest: CredentialRequestActivity = {
      type: "credential_request",
      id: "request-2",
      timestampMs: "1700000000000",
      agentName: "Cursor",
      origin: "local",
      status: "created",
      resourceType: "secret",
      operation: "create",
      secretId: "secret-new-1",
      resolvedAtMs: "1700000005000",
      // Deliberately no queryType/queryValue — a create row never has one.
    };

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("identifies an operation: 'create' row as a create request", () => {
      expect(isCreateRequest(createdRequest)).toBe(true);
      expect(isCreateRequest(sharedSecretRequest)).toBe(false);
    });

    it("resolves the created secret's name from the SM name cache, by secretId", () => {
      mockResolveSecretName.mockReturnValue("DB_PASSWORD");

      expect(resultLabel(createdRequest)).toBe("agentAccessCreatedItem");
      expect(mockResolveSecretName).toHaveBeenCalledWith("secret-new-1");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessCreatedItem",
        "DB_PASSWORD",
      );
    });

    // No query value exists to fall back to on a create row — unlike the Shared-secret fallback,
    // this must resolve to a generic label instead.
    it("falls back to a generic label, never a raw query value, when the name was never cached", () => {
      mockResolveSecretName.mockReturnValue(undefined);

      expect(resultLabel(createdRequest)).toBe("agentAccessCreatedItem");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessCreatedItem",
        "agentAccessCreateFallbackName",
      );
    });
  });

  // M6 (agent-access-architecture.md, "M6 — Full Secrets Manager surface"): `updated`/`deleted`
  // rows never carry a `queryValue` either (same reason as `created`) and resolve their target
  // name from the appropriate session-scoped cache — secret via `resolveSecretName`, project via
  // the new `resolveProjectName` — falling back to a generic label, never a raw query value.
  describe("updated/deleted result labels", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;

    const updatedSecretRequest: CredentialRequestActivity = {
      type: "credential_request",
      id: "request-3",
      timestampMs: "1700000000000",
      agentName: "Cursor",
      origin: "local",
      status: "updated",
      resourceType: "secret",
      operation: "update",
      secretId: "secret-1",
      resolvedAtMs: "1700000005000",
    };

    const deletedProjectRequest: CredentialRequestActivity = {
      type: "credential_request",
      id: "request-4",
      timestampMs: "1700000000000",
      agentName: "Cursor",
      origin: "local",
      status: "deleted",
      resourceType: "project",
      operation: "delete",
      projectId: "proj-1",
      resolvedAtMs: "1700000005000",
    };

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("resolves an updated secret's name from the secret name cache, by secretId", () => {
      mockResolveSecretName.mockReturnValue("PROD_DB_PASSWORD");

      expect(resultLabel(updatedSecretRequest)).toBe("agentAccessUpdatedItem");
      expect(mockResolveSecretName).toHaveBeenCalledWith("secret-1");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessUpdatedItem",
        "PROD_DB_PASSWORD",
      );
    });

    it("falls back to a generic label, never a raw query value, when an updated secret's name was never cached", () => {
      mockResolveSecretName.mockReturnValue(undefined);

      expect(resultLabel(updatedSecretRequest)).toBe("agentAccessUpdatedItem");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessUpdatedItem",
        "agentAccessUpdateFallbackName",
      );
    });

    it("resolves a deleted project's name from the project name cache, by projectId", () => {
      mockResolveProjectName.mockReturnValue("my-app");

      expect(resultLabel(deletedProjectRequest)).toBe("agentAccessDeletedItem");
      expect(mockResolveProjectName).toHaveBeenCalledWith("proj-1");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessDeletedItem",
        "my-app",
      );
    });

    it("falls back to a generic label, never a raw query value, when a deleted project's name was never cached", () => {
      mockResolveProjectName.mockReturnValue(undefined);

      expect(resultLabel(deletedProjectRequest)).toBe("agentAccessDeletedItem");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessDeletedItem",
        "agentAccessDeleteFallbackName",
      );
    });

    it("never falls back to a project's name for a secret row, or vice versa", () => {
      mockResolveProjectName.mockReturnValue("wrong-cache");
      mockResolveSecretName.mockReturnValue(undefined);

      resultLabel(updatedSecretRequest);

      expect(mockResolveProjectName).not.toHaveBeenCalled();
    });
  });

  describe("listed result label", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;

    const listedRequest: CredentialRequestActivity = {
      type: "credential_request",
      id: "request-5",
      timestampMs: "1700000000000",
      agentName: "Cursor",
      origin: "local",
      status: "listed",
      resourceType: "project",
      operation: "list",
      resolvedAtMs: "1700000005000",
    };

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("shows a static released-the-list label", () => {
      expect(resultLabel(listedRequest)).toBe("agentAccessResultListed");
    });
  });

  describe("OpenShell result labels (§M8.8)", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;

    const openShellRow = (
      status: CredentialRequestActivity["status"],
    ): CredentialRequestActivity => ({
      type: "credential_request",
      id: "request-9",
      timestampMs: "1700000000000",
      agentName: "openshell-gateway",
      origin: "openshell",
      operation: "providerResolve",
      sandboxId: "sbx-01J9Z6",
      providerId: "prov-7f3a",
      policyDigest: "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
      targetIds: ["3f1c2b9e-8a4d-4c7e-9b21-5d6f7a8b9c0d"],
      status,
    });

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("adds no field/item label to a released OpenShell row (it stores ids only)", () => {
      expect(resultLabel(openShellRow("shared"))).toBeUndefined();
    });

    it("still explains a denial", () => {
      expect(resultLabel(openShellRow("denied"))).toBe("agentAccessResultDenied");
    });
  });

  describe("status badge metadata", () => {
    let component: AgentAccessActivityComponent;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("labels and colors updated/deleted/listed distinctly from created/denied", () => {
      const statusLabel = (status: string) => (component as any).statusLabel(status) as string;
      const statusVariant = (status: string) => (component as any).statusVariant(status) as string;

      expect(statusLabel("updated")).toBe("agentAccessStatusUpdated");
      expect(statusLabel("deleted")).toBe("agentAccessStatusDeleted");
      expect(statusLabel("listed")).toBe("agentAccessStatusListed");
      expect(statusVariant("updated")).toBe("success");
      expect(statusVariant("deleted")).toBe("danger");
      expect(statusVariant("listed")).toBe("subtle");
    });
  });

  describe("agent label", () => {
    let component: AgentAccessActivityComponent;
    const agentLabel = (entry: AgentAccessActivityEntry) =>
      (component as any).agentLabel(entry) as string;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("prefers the resolved agent name", () => {
      expect(agentLabel(pendingRequest)).toBe("Cursor");
    });

    it("falls back to a shortened fingerprint when there is no name", () => {
      const entry = {
        ...pendingRequest,
        agentName: undefined,
        agentFingerprint: "a".repeat(64),
      };
      expect(agentLabel(entry)).not.toBe("—");
      expect(agentLabel(entry).length).toBeLessThan(64);
    });

    it("falls back to a dash when the agent is unidentified", () => {
      expect(agentLabel({ ...pendingRequest, agentName: undefined })).toBe("—");
    });
  });

  describe("query type label", () => {
    let component: AgentAccessActivityComponent;
    const queryTypeLabel = (queryType: CredentialRequestActivity["queryType"]) =>
      (component as any).queryTypeLabel(queryType) as string;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    // The exhaustive Record<CredentialQueryType, string> map forces this entry to exist whenever
    // napi's CredentialQueryType gains a member — "name" (M4, Secrets Manager secret lookups) is
    // the newest one.
    it("labels a 'name' query as a Secrets Manager secret name lookup", () => {
      expect(queryTypeLabel("name")).toBe("agentAccessQueryTypeName");
    });
  });
});

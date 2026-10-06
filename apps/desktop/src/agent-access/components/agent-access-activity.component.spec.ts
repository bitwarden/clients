import { ComponentFixture, TestBed } from "@angular/core/testing";
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

  // M7 (agent-access-architecture.md, "M7 — `bws run` parity"): a `bulkRequest` + `shared` row
  // is distinguished from an ordinary single-secret `shared` row by `operation`, not
  // `resourceType` (both are `resourceType: "secret"`). The count comes from `secretIds.length`,
  // never `fieldsShared` — a bulk row has no per-field summary the way a single release does.
  describe("bulkRequest result label", () => {
    let component: AgentAccessActivityComponent;
    const resultLabel = (entry: CredentialRequestActivity) =>
      (component as any).requestResultLabel(entry) as string | undefined;

    const bulkSharedRequest: CredentialRequestActivity = {
      type: "credential_request",
      id: "request-6",
      timestampMs: "1700000000000",
      agentName: "Cursor",
      origin: "local",
      status: "shared",
      resourceType: "secret",
      operation: "bulkRequest",
      projectId: "proj-1",
      secretIds: ["s-db", "s-api", "s-smtp"],
      resolvedAtMs: "1700000005000",
    };

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("resolves the project's name from the project name cache, by projectId, and counts secretIds", () => {
      mockResolveProjectName.mockReturnValue("my-app");

      expect(resultLabel(bulkSharedRequest)).toBe("agentAccessSharedProjectSecrets");
      expect(mockResolveProjectName).toHaveBeenCalledWith("proj-1");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessSharedProjectSecrets",
        3,
        "my-app",
      );
    });

    it("falls back to a generic project label, never a raw id, when the project name was never cached", () => {
      mockResolveProjectName.mockReturnValue(undefined);

      expect(resultLabel(bulkSharedRequest)).toBe("agentAccessSharedProjectSecrets");
      expect(TestBed.inject(I18nService).t).toHaveBeenCalledWith(
        "agentAccessSharedProjectSecrets",
        3,
        "agentAccessBulkProjectFallbackName",
      );
    });

    it("never resolves a secret name for a bulk row — only the project name", () => {
      mockResolveProjectName.mockReturnValue("my-app");

      resultLabel(bulkSharedRequest);

      expect(mockResolveSecretName).not.toHaveBeenCalled();
    });

    it("takes an ordinary single-secret shared row down the non-bulk branch instead", () => {
      mockResolveSecretName.mockReturnValue("DB_PASSWORD");

      expect(resultLabel(sharedSecretRequest)).toBe("agentAccessSharedItemFields");
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

  describe("status badge metadata", () => {
    let component: AgentAccessActivityComponent;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("labels updated/deleted/listed distinctly from created/denied", () => {
      const statusLabel = (status: string) => (component as any).statusLabel(status) as string;

      expect(statusLabel("updated")).toBe("agentAccessStatusUpdated");
      expect(statusLabel("deleted")).toBe("agentAccessStatusDeleted");
      expect(statusLabel("listed")).toBe("agentAccessStatusListed");
    });

    // Colour used to come from a status-keyed table chosen independently of the lifecycle badge's
    // own table — two ad hoc colour systems (agent-access-design-spec.md §3.5, "reconcile with it
    // rather than bolting a second colour system alongside it"). Both now derive from the shared
    // consequence grade instead, so this asserts the grade-derived variant rather than a
    // status-keyed lookup: `updated` is a `change` (vault modified, nothing disclosed — no longer
    // the old "success" green), `deleted` is a `destroy`, `listed` is `metadata`.
    it("colors updated/deleted/listed by their consequence grade, not by a per-status table", () => {
      const statusVariant = (entry: CredentialRequestActivity) =>
        (component as any).statusVariant(entry) as string;

      const updated: CredentialRequestActivity = {
        ...pendingRequest,
        status: "updated",
        resourceType: "secret",
        operation: "update",
        secretId: "secret-1",
      };
      const deleted: CredentialRequestActivity = {
        ...pendingRequest,
        status: "deleted",
        resourceType: "project",
        operation: "delete",
        projectId: "proj-1",
      };
      const listed: CredentialRequestActivity = {
        ...pendingRequest,
        status: "listed",
        resourceType: "project",
        operation: "list",
      };

      expect(statusVariant(updated)).toBe("primary"); // change
      expect(statusVariant(deleted)).toBe("danger"); // destroy
      expect(statusVariant(listed)).toBe("subtle"); // metadata
    });
  });

  // agent-access-design-spec.md §2.1/§3.5: the log adopts the same four consequence grades the
  // approval dialogs are organized around, derived from what a row's data actually says happened
  // (resource type, operation, status) — never inferred from a field a given path may leave unset
  // (spec §3.3 BUG 2's `isReferenceMode` trap).
  describe("consequence grade", () => {
    let component: AgentAccessActivityComponent;
    const requestGrade = (entry: CredentialRequestActivity) =>
      (component as any).requestGrade(entry) as string;
    const lifecycleGrade = () => (component as any).lifecycleGrade() as string;
    const isLifecycleFault = (kind: string) => (component as any).isLifecycleFault(kind) as boolean;
    const lifecycleVariant = (kind: string) => (component as any).lifecycleVariant(kind) as string;
    const lifecycleIcon = (kind: string) => (component as any).lifecycleIcon(kind) as string;
    const gradeVariant = (grade: string) => (component as any).gradeVariant(grade) as string;
    const gradeIcon = (grade: string) => (component as any).gradeIcon(grade) as string;

    beforeEach(async () => {
      component = createComponent();
      await component.ngOnInit();
    });

    it("grades a released secret, a bulk project-secrets release, and a filled credential as disclose", () => {
      expect(requestGrade(sharedSecretRequest)).toBe("disclose");
      expect(
        requestGrade({
          ...pendingRequest,
          status: "shared",
          resourceType: "secret",
          operation: "bulkRequest",
          projectId: "proj-1",
          secretIds: ["s-1", "s-2"],
        }),
      ).toBe("disclose");
      expect(
        requestGrade({ ...pendingRequest, status: "filled", fieldsShared: ["password"] }),
      ).toBe("disclose");
    });

    // The credential path has no `deliveryMode` field to read (that's exactly the field the
    // dialog-side bug inferred a grade from and got wrong — spec §3.3 BUG 2). Grading off
    // `fieldsShared` instead means this reads what was actually released, not a flag a path may
    // never set.
    it("grades a credential release as disclose only when the password field itself was shared", () => {
      expect(sharedRequest.fieldsShared).toContain("password");
      expect(requestGrade(sharedRequest)).toBe("disclose");

      expect(requestGrade({ ...sharedRequest, fieldsShared: ["username", "uri"] })).toBe(
        "metadata",
      ); // reference delivery — the password never left the device
    });

    it("grades a create/update as change and a delete as destroy", () => {
      expect(requestGrade({ ...pendingRequest, status: "created", resourceType: "secret" })).toBe(
        "change",
      );
      expect(requestGrade({ ...pendingRequest, status: "updated", resourceType: "secret" })).toBe(
        "change",
      );
      expect(requestGrade({ ...pendingRequest, status: "deleted", resourceType: "project" })).toBe(
        "destroy",
      );
    });

    it("grades a pending, denied, no-match, failed fill, and project list as metadata — nothing left the device", () => {
      for (const status of ["pending", "denied", "not_found", "fill_failed", "listed"] as const) {
        expect(requestGrade({ ...pendingRequest, status })).toBe("metadata");
      }
    });

    // Connection/transport events never disclose a secret or change vault contents, so every
    // `kind` is `metadata` on the *consequence* axis — including `error`, whose distinct colour
    // (below) comes from the separate *fault* axis layered on top, not from the grade.
    it("grades every lifecycle kind as metadata on the consequence axis, even a rejected connection or an error", () => {
      expect(lifecycleGrade()).toBe("metadata");
    });

    // The fault axis is orthogonal to consequence grade (per the coordinator's ruling: grade
    // colors what happened to the vault; a fault is a separate "does this need a second look"
    // concern). `connection_rejected` is the system working as designed — the user's own correct
    // "no" — so it stays plain `metadata`, not a fault. `error` is the one lifecycle kind that
    // genuinely represents something going wrong, so it alone earns the danger treatment.
    describe("lifecycle fault axis", () => {
      it("flags 'error' as a fault and nothing else", () => {
        expect(isLifecycleFault("error")).toBe(true);
        expect(isLifecycleFault("connection_rejected")).toBe(false);
        expect(isLifecycleFault("connection_established")).toBe(false);
        expect(isLifecycleFault("reconnecting")).toBe(false);
        // An unrecognized future kind defaults to "not a fault", same as it defaults to a plain
        // label in `lifecycleLabel` — no kind is treated as alarming by default.
        expect(isLifecycleFault("some_future_kind")).toBe(false);
      });

      it("colors a fault with the danger treatment, distinct from the metadata treatment every other kind gets", () => {
        expect(lifecycleVariant("error")).toBe("danger");
        expect(lifecycleIcon("error")).toBe("bwi-error");
      });

      it("colors a rejected connection as plain metadata, not as a fault", () => {
        expect(lifecycleVariant("connection_rejected")).toBe("subtle");
        expect(lifecycleIcon("connection_rejected")).toBe("bwi-list");
      });
    });

    it("maps each grade to the exact §2.2 badge treatment", () => {
      expect(gradeVariant("metadata")).toBe("subtle");
      expect(gradeIcon("metadata")).toBe("bwi-list");
      expect(gradeVariant("change")).toBe("primary");
      expect(gradeIcon("change")).toBe("bwi-pencil");
      expect(gradeVariant("disclose")).toBe("warning");
      expect(gradeIcon("disclose")).toBe("bwi-key");
      expect(gradeVariant("destroy")).toBe("danger");
      expect(gradeIcon("destroy")).toBe("bwi-trash");
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

  // Full-template rendering, unlike the white-box tests above — these actually mount the
  // component (TestBed.createComponent) rather than constructing it directly, so they catch
  // template-level regressions (a missing class, a dropped column) the method-level tests can't.
  describe("template rendering", () => {
    function createFixture(): ComponentFixture<AgentAccessActivityComponent> {
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
      const i18nService = { t: jest.fn().mockImplementation((key: string) => key) };
      const accountService = { activeAccount$: accountSubject.asObservable() };
      const cipherService = {
        cipherViews$: jest.fn().mockReturnValue(cipherViewsSubject.asObservable()),
      };
      mockResolveSecretName = jest.fn().mockReturnValue(undefined);
      mockResolveProjectName = jest.fn().mockReturnValue(undefined);
      const agentAccessSecretsService = {
        resolveSecretName: mockResolveSecretName,
        resolveProjectName: mockResolveProjectName,
      };

      TestBed.configureTestingModule({
        imports: [AgentAccessActivityComponent],
        providers: [
          { provide: MessageListener, useValue: messageListener },
          { provide: I18nService, useValue: i18nService },
          { provide: AccountService, useValue: accountService },
          { provide: CipherService, useValue: cipherService },
          { provide: AgentAccessSecretsService, useValue: agentAccessSecretsService },
        ],
      });

      return TestBed.createComponent(AgentAccessActivityComponent);
    }

    /** Mounts the component against a fixed buffer and flushes the async `ngOnInit` fetch. */
    async function renderWith(
      entries: AgentAccessActivityEntry[],
    ): Promise<ComponentFixture<AgentAccessActivityComponent>> {
      mockGetActivity.mockResolvedValue(entries);
      const fixture = createFixture();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture;
    }

    it("renders the empty state with copy that explains what will appear here and why it matters", async () => {
      const fixture = await renderWith([]);
      const compiled: HTMLElement = fixture.nativeElement;

      expect(compiled.querySelector("bit-no-items")).toBeTruthy();
      expect(compiled.querySelector("bit-table")).toBeFalsy();
      // The fake I18nService echoes the key, so the rendered text names exactly which copy shows.
      expect(compiled.textContent).toContain("agentAccessActivityEmpty");
      expect(compiled.textContent).toContain("agentAccessActivityEmptyDescription");
    });

    it("visually distinguishes a disclose row from a metadata row in the same table", async () => {
      const listedRow: CredentialRequestActivity = {
        ...pendingRequest,
        id: "request-listed",
        status: "listed",
        resourceType: "project",
        operation: "list",
      };
      const fixture = await renderWith([sharedSecretRequest, listedRow]);
      const compiled: HTMLElement = fixture.nativeElement;
      const rows = Array.from(compiled.querySelectorAll("tbody tr"));
      expect(rows).toHaveLength(2);

      const discloseRow = rows.find((row) =>
        row.textContent?.includes("agentAccessStatusShared"),
      ) as HTMLElement;
      const metadataRow = rows.find((row) =>
        row.textContent?.includes("agentAccessStatusListed"),
      ) as HTMLElement;
      expect(discloseRow).toBeTruthy();
      expect(metadataRow).toBeTruthy();

      const discloseResultCell = discloseRow.querySelectorAll("td")[3];
      const metadataResultCell = metadataRow.querySelectorAll("td")[3];
      const discloseBadge = discloseResultCell.querySelector("[bitBadge]") as HTMLElement;
      const metadataBadge = metadataResultCell.querySelector("[bitBadge]") as HTMLElement;

      // §2.2's disclose token treatment vs. its metadata treatment — genuinely different classes,
      // not just different text.
      expect(discloseBadge.className).toContain("tw-bg-bg-warning-soft");
      expect(metadataBadge.className).toContain("tw-bg-bg-secondary");
      expect(discloseBadge.className).not.toBe(metadataBadge.className);

      expect(discloseResultCell.querySelector("bit-icon.bwi-key")).toBeTruthy();
      expect(metadataResultCell.querySelector("bit-icon.bwi-list")).toBeTruthy();
    });

    it("renders every datum of a credential-request row: caption, no secret badge, plain query value, status, and result detail", async () => {
      const fixture = await renderWith([sharedRequest]);
      const compiled: HTMLElement = fixture.nativeElement;
      const row = compiled.querySelector("tbody tr") as HTMLElement;
      const requestCell = row.querySelectorAll("td")[2];

      expect(requestCell.textContent).toContain("agentAccessQueryTypeDomain");
      expect(requestCell.querySelector("[bitBadge]")).toBeFalsy(); // not a secret request
      const queryValueEl = Array.from(requestCell.querySelectorAll("span")).find((el) =>
        el.textContent?.includes("github.com"),
      ) as HTMLElement;
      expect(queryValueEl).toBeTruthy();
      expect(queryValueEl.className).toContain("tw-font-mono");
      // A domain query isn't a secret/credential name (agent-access-design-spec.md §2.3) — only a
      // `name`-query value is.
      expect(queryValueEl.className).not.toContain("tw-text-fg-sensitive");

      const resultCell = row.querySelectorAll("td")[3];
      expect(resultCell.textContent).toContain("agentAccessStatusShared");
      expect(resultCell.textContent).toContain("agentAccessSharedItemFields");
    });

    it("renders every datum of a secret-request row, including the sensitive mono-styled secret name", async () => {
      const fixture = await renderWith([sharedSecretRequest]);
      const compiled: HTMLElement = fixture.nativeElement;
      const row = compiled.querySelector("tbody tr") as HTMLElement;
      const requestCell = row.querySelectorAll("td")[2];

      expect(requestCell.textContent).toContain("agentAccessQueryTypeName");
      expect(requestCell.textContent).toContain("agentAccessSecretResourceLabel"); // secret badge
      const queryValueEl = Array.from(requestCell.querySelectorAll("span")).find((el) =>
        el.textContent?.includes("DB_PASSWORD"),
      ) as HTMLElement;
      expect(queryValueEl).toBeTruthy();
      expect(queryValueEl.className).toContain("tw-font-mono");
      expect(queryValueEl.className).toContain("tw-text-fg-sensitive");

      const resultCell = row.querySelectorAll("td")[3];
      expect(resultCell.textContent).toContain("agentAccessStatusShared");
      expect(resultCell.textContent).toContain("agentAccessSharedItemFields");
    });

    it("renders every datum of a lifecycle row: label and detail, for a routine, a rejected, and a faulted kind", async () => {
      const rejected: AgentAccessActivityEntry = {
        type: "lifecycle",
        id: "lifecycle-rejected",
        timestampMs: "1700000020000",
        agentName: "Untrusted Agent",
        kind: "connection_rejected",
        detail: "signature mismatch",
      };
      const errored: AgentAccessActivityEntry = {
        type: "lifecycle",
        id: "lifecycle-error",
        timestampMs: "1700000030000",
        agentName: "Cursor",
        kind: "error",
        detail: "transport closed unexpectedly",
      };
      const fixture = await renderWith([connectionEvent, rejected, errored]);
      const compiled: HTMLElement = fixture.nativeElement;
      const rows = Array.from(compiled.querySelectorAll("tbody tr"));
      expect(rows).toHaveLength(3);

      const establishedRow = rows.find((row) =>
        row.textContent?.includes("agentAccessEventConnectionEstablished"),
      ) as HTMLElement;
      const rejectedRow = rows.find((row) =>
        row.textContent?.includes("agentAccessEventConnectionRejected"),
      ) as HTMLElement;
      const erroredRow = rows.find((row) =>
        row.textContent?.includes("agentAccessEventError"),
      ) as HTMLElement;
      expect(establishedRow).toBeTruthy();
      expect(rejectedRow).toBeTruthy();
      expect(erroredRow).toBeTruthy();
      expect(establishedRow.textContent).toContain("rendezvous");
      expect(rejectedRow.textContent).toContain("signature mismatch");
      expect(erroredRow.textContent).toContain("transport closed unexpectedly");

      // Every lifecycle kind grades as metadata on the consequence axis (see "consequence grade"
      // above) — a rejected connection is the system working as designed, so it reads exactly
      // like the routine "established" row, not as an alarm.
      const establishedBadge = establishedRow.querySelector("[bitBadge]") as HTMLElement;
      const rejectedBadge = rejectedRow.querySelector("[bitBadge]") as HTMLElement;
      const erroredBadge = erroredRow.querySelector("[bitBadge]") as HTMLElement;
      expect(establishedBadge.className).toContain("tw-bg-bg-secondary");
      expect(rejectedBadge.className).toContain("tw-bg-bg-secondary");
      expect(establishedRow.querySelector("bit-icon.bwi-list")).toBeTruthy();
      expect(rejectedRow.querySelector("bit-icon.bwi-list")).toBeTruthy();

      // `error` is the one lifecycle kind that's also a *fault* — a separate axis from
      // consequence grade — so it alone renders with the danger treatment, visually distinct
      // from every metadata row in the same table.
      expect(erroredBadge.className).toContain("tw-bg-bg-danger-soft");
      expect(erroredRow.querySelector("bit-icon.bwi-error")).toBeTruthy();
      expect(erroredBadge.className).not.toBe(establishedBadge.className);
      expect(erroredBadge.className).not.toBe(rejectedBadge.className);
    });
  });
});

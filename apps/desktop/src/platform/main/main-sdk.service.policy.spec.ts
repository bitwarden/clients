import { ipcMain, IpcMainInvokeEvent } from "electron";
import { mock } from "jest-mock-extended";
import {
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  timeout,
} from "rxjs";

import {
  OrganizationUserStatusType,
  OrganizationUserType,
  PolicyType,
} from "@bitwarden/common/admin-console/enums";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { DefaultOrganizationService } from "@bitwarden/common/admin-console/services/organization/default-organization.service";
import { DefaultNewPolicyService } from "@bitwarden/common/admin-console/services/policy/default-new-policy.service";
import { DefaultPolicyService } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountServiceImplementation } from "@bitwarden/common/auth/services/account.service";
import { DefaultActiveUserAccessor } from "@bitwarden/common/auth/services/default-active-user.accessor";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DefaultEnvironmentService } from "@bitwarden/common/platform/services/default-environment.service";
import { DefaultSdkClientFactory } from "@bitwarden/common/platform/services/sdk/default-sdk-client-factory";
import { PolicyId, UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";
import { DefaultManagedSettingsService } from "@bitwarden/managed-settings";
import {
  DefaultActiveUserStateProvider,
  DefaultDerivedStateProvider,
  DefaultGlobalStateProvider,
  DefaultSingleUserStateProvider,
  DefaultStateEventRegistrarService,
  DefaultStateProvider,
} from "@bitwarden/state-internal";
import { SerializedMemoryStorageService, StorageServiceProvider } from "@bitwarden/storage-core";

import { ElectronRendererStorageService } from "../services/electron-renderer-storage.service";

import { ElectronStorageService } from "./electron-storage.service";
import { MainSdkService } from "./main-sdk.service";
import { StorageBackend } from "./storage/storage-backend";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

/**
 * End-to-end check that the main process can tell whether a policy applies to a user, using the
 * real SDK and the same service graph `main.ts` builds. The renderer side is simulated the way it
 * really runs: its disk writes go through main's `storageService` IPC handler.
 */

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    return Promise.resolve();
  }
}

class InMemoryBackend implements StorageBackend {
  private store: Record<string, unknown> = {};

  read(): Record<string, unknown> {
    return this.store;
  }

  update(updater: (store: Record<string, unknown>) => Record<string, unknown>): void {
    this.store = updater(this.store);
  }

  flush(): void {}
}

/** Electron copies values across the process boundary; nothing is shared by reference. */
function copyAcrossProcesses<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

/** Builds the main process services exactly as `main.ts` wires them. */
function createMainProcess() {
  const logService = mock<LogService>();
  const storageService = new ElectronStorageService(new InMemoryBackend());
  const storageServiceProvider = new StorageServiceProvider(
    storageService,
    new SerializedMemoryStorageService(),
  );
  const globalStateProvider = new DefaultGlobalStateProvider(storageServiceProvider, logService);
  const singleUserStateProvider = new DefaultSingleUserStateProvider(
    storageServiceProvider,
    new DefaultStateEventRegistrarService(globalStateProvider, storageServiceProvider),
    logService,
  );
  const accountService = new AccountServiceImplementation(
    MessageSender.EMPTY,
    logService,
    globalStateProvider,
    singleUserStateProvider,
  );
  const stateProvider = new DefaultStateProvider(
    new DefaultActiveUserStateProvider(
      new DefaultActiveUserAccessor(accountService),
      singleUserStateProvider,
    ),
    singleUserStateProvider,
    globalStateProvider,
    new DefaultDerivedStateProvider(),
  );
  const environmentService = new DefaultEnvironmentService(stateProvider, accountService);

  const sdkService = new MainSdkService(
    new DefaultSdkClientFactory(),
    environmentService,
    new DefaultManagedSettingsService(SdkLoadService.Ready),
  );
  const policyService = new DefaultPolicyService(
    stateProvider,
    new DefaultOrganizationService(stateProvider),
    accountService,
    new DefaultNewPolicyService(stateProvider),
    () => sdkService,
  );

  return { accountService, policyService };
}

/**
 * Builds the renderer services that sync and login use to write state. Its disk storage is the
 * real `ElectronRendererStorageService`, bridged to main's `storageService` IPC handler.
 */
function createRenderer() {
  const [, handleStorageRequest] =
    [...jest.mocked(ipcMain.handle).mock.calls]
      .reverse()
      .find(([channel]) => channel === "storageService") ?? [];
  if (handleStorageRequest == null) {
    throw new Error("Main did not register the storageService IPC handler");
  }

  const invoke = async (request: Record<string, unknown>) =>
    copyAcrossProcesses(
      await handleStorageRequest(mock<IpcMainInvokeEvent>(), copyAcrossProcesses(request)),
    );
  Object.assign(globalThis, {
    ipc: {
      platform: {
        storage: {
          get: (key: string) => invoke({ action: "get", key }),
          has: (key: string) => invoke({ action: "has", key }),
          save: (key: string, obj: unknown) => invoke({ action: "save", key, obj }),
          remove: (key: string) => invoke({ action: "remove", key }),
        },
      },
    },
  });

  const logService = mock<LogService>();
  const storageServiceProvider = new StorageServiceProvider(
    new ElectronRendererStorageService(),
    new SerializedMemoryStorageService(),
  );
  const globalStateProvider = new DefaultGlobalStateProvider(storageServiceProvider, logService);
  const singleUserStateProvider = new DefaultSingleUserStateProvider(
    storageServiceProvider,
    new DefaultStateEventRegistrarService(globalStateProvider, storageServiceProvider),
    logService,
  );
  const accountService = new AccountServiceImplementation(
    MessageSender.EMPTY,
    logService,
    globalStateProvider,
    singleUserStateProvider,
  );
  const stateProvider = new DefaultStateProvider(
    new DefaultActiveUserStateProvider(
      new DefaultActiveUserAccessor(accountService),
      singleUserStateProvider,
    ),
    singleUserStateProvider,
    globalStateProvider,
    new DefaultDerivedStateProvider(),
  );

  return {
    async login(userId: UserId) {
      await accountService.addAccount(userId, {
        email: `${userId}@example.com`,
        emailVerified: true,
        name: undefined,
        creationDate: undefined,
      });
      await accountService.switchAccount(userId);
    },
    async switchAccount(userId: UserId) {
      await accountService.switchAccount(userId);
    },
    async sync(userId: UserId, organizations: OrganizationData[], policies: PolicyData[]) {
      await new DefaultOrganizationService(stateProvider).replace(
        Object.fromEntries(organizations.map((o) => [o.id, o])),
        userId,
      );
      await new DefaultNewPolicyService(stateProvider).replace(
        Object.fromEntries(policies.map((p) => [p.id, p])),
        userId,
      );
    },
  };
}

function organization(
  id: string,
  {
    type = OrganizationUserType.User,
    status = OrganizationUserStatusType.Confirmed,
    enabled = true,
    usePolicies = true,
    isProviderUser = false,
  }: Partial<
    Pick<OrganizationData, "type" | "status" | "enabled" | "usePolicies" | "isProviderUser">
  > = {},
): OrganizationData {
  const data = new OrganizationData({} as ProfileOrganizationResponse, {
    isMember: true,
    isProviderUser,
  });
  data.id = id;
  data.name = "Test organization";
  data.type = type;
  data.status = status;
  data.enabled = enabled;
  data.usePolicies = usePolicies;
  return data;
}

function autotypePolicy(organizationId: string, enabled: boolean): PolicyData {
  const data = new PolicyData({} as PolicyResponse);
  data.id = Utils.newGuid() as PolicyId;
  data.organizationId = organizationId;
  data.type = PolicyType.AutotypeDefaultSetting;
  data.enabled = enabled;
  data.revisionDate = new Date().toISOString();
  return data;
}

/** What a main process consumer would write: does the policy apply to the active user? */
function autotypePolicyAppliesToActiveUser$(
  main: ReturnType<typeof createMainProcess>,
): Observable<boolean> {
  return main.accountService.activeAccount$.pipe(
    map((account) => account?.id ?? null),
    distinctUntilChanged(),
    switchMap((userId) =>
      userId == null
        ? of(false)
        : main.policyService.policyAppliesToUser$(PolicyType.AutotypeDefaultSetting, userId),
    ),
    distinctUntilChanged(),
  );
}

function nextMatching<T>(value$: Observable<T>, expected: T): Promise<T> {
  return firstValueFrom(
    value$.pipe(
      filter((value) => value === expected),
      timeout(5000),
    ),
  );
}

describe("PolicyService in the desktop main process", () => {
  let main: ReturnType<typeof createMainProcess>;
  let renderer: ReturnType<typeof createRenderer>;
  let userId: UserId;
  let organizationId: string;

  beforeAll(async () => {
    await new TestSdkLoadService().loadAndInit();
  });

  beforeEach(() => {
    jest.mocked(ipcMain.handle).mockClear();
    main = createMainProcess();
    renderer = createRenderer();
    userId = Utils.newGuid() as UserId;
    organizationId = Utils.newGuid();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "ipc");
  });

  async function appliesInMain() {
    return firstValueFrom(
      main.policyService.policyAppliesToUser$(PolicyType.AutotypeDefaultSetting, userId),
    );
  }

  async function enabledInMain() {
    const policies = await firstValueFrom(main.policyService.policies$(userId));
    return policies.find((p) => p.type === PolicyType.AutotypeDefaultSetting)?.enabled;
  }

  it("reports nothing before the renderer has synced", async () => {
    expect(await appliesInMain()).toBe(false);
    expect(await enabledInMain()).toBeUndefined();
  });

  it("applies an enabled policy to a confirmed member", async () => {
    await renderer.sync(
      userId,
      [organization(organizationId)],
      [autotypePolicy(organizationId, true)],
    );

    expect(await enabledInMain()).toBe(true);
    expect(await appliesInMain()).toBe(true);
  });

  it("applies an enabled policy to an accepted member", async () => {
    await renderer.sync(
      userId,
      [organization(organizationId, { status: OrganizationUserStatusType.Accepted })],
      [autotypePolicy(organizationId, true)],
    );

    expect(await appliesInMain()).toBe(true);
  });

  it.each([
    ["an owner", OrganizationUserType.Owner],
    ["an admin", OrganizationUserType.Admin],
  ])("reports an enabled policy that does not apply to %s", async (_, type) => {
    await renderer.sync(
      userId,
      [organization(organizationId, { type })],
      [autotypePolicy(organizationId, true)],
    );

    expect(await enabledInMain()).toBe(true);
    expect(await appliesInMain()).toBe(false);
  });

  it("does not apply the policy to a provider user", async () => {
    await renderer.sync(
      userId,
      [organization(organizationId, { isProviderUser: true })],
      [autotypePolicy(organizationId, true)],
    );

    expect(await appliesInMain()).toBe(false);
  });

  it("does not apply a disabled policy", async () => {
    await renderer.sync(
      userId,
      [organization(organizationId)],
      [autotypePolicy(organizationId, false)],
    );

    expect(await enabledInMain()).toBe(false);
    expect(await appliesInMain()).toBe(false);
  });

  it("does not apply the policy when the organization does not use policies", async () => {
    await renderer.sync(
      userId,
      [organization(organizationId, { usePolicies: false })],
      [autotypePolicy(organizationId, true)],
    );

    expect(await appliesInMain()).toBe(false);
  });

  it("follows the renderer's active account and syncs without resubscribing", async () => {
    const otherUserId = Utils.newGuid() as UserId;
    const applies$ = autotypePolicyAppliesToActiveUser$(main).pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    await nextMatching(applies$, false);

    await renderer.sync(
      userId,
      [organization(organizationId)],
      [autotypePolicy(organizationId, true)],
    );
    await renderer.login(userId);
    expect(await nextMatching(applies$, true)).toBe(true);

    await renderer.login(otherUserId);
    expect(await nextMatching(applies$, false)).toBe(false);

    await renderer.switchAccount(userId);
    expect(await nextMatching(applies$, true)).toBe(true);

    await renderer.sync(
      userId,
      [organization(organizationId)],
      [autotypePolicy(organizationId, false)],
    );
    expect(await nextMatching(applies$, false)).toBe(false);
  });
});

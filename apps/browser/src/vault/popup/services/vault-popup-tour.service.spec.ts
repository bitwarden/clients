import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { StateProvider } from "@bitwarden/state";
import {
  ALL_ITEMS_SCOPE,
  CoachmarkService,
  VaultNavService,
  type VaultScope,
  VaultScopeType,
} from "@bitwarden/vault";

import { VaultPopupItemsService } from "./vault-popup-items.service";
import { VaultPopupListTableFiltersService } from "./vault-popup-list-table-filters.service";
import { VaultPopupListTableService } from "./vault-popup-list-table.service";
import { VaultPopupTourService } from "./vault-popup-tour.service";

describe("VaultPopupTourService", () => {
  const userId = "user-1" as UserId;

  let service: VaultPopupTourService;
  const coachmark = mock<CoachmarkService>();
  const vaultNav$ = new BehaviorSubject<any>({ vaults: [] });
  const collections$ = new BehaviorSubject<any[]>([]);
  const folders$ = new BehaviorSubject<any[]>([]);
  const activeCiphers$ = new BehaviorSubject<any[]>([]);
  const vaultScope = signal<VaultScope>(ALL_ITEMS_SCOPE);

  const collection = { value: { id: "collection-1", organizationId: "org-1" }, label: "Shared" };
  const folder = { value: { id: "folder-1" }, label: "Personal" };

  /** The ids of the steps the started tour runs, in order. */
  const startedSteps = () => coachmark.startTour.mock.calls[0][0].steps.map((step) => step.id);

  beforeEach(() => {
    jest.clearAllMocks();
    vaultNav$.next({ vaults: [{ id: "user-1" }, { id: "org-1" }] });
    collections$.next([collection]);
    folders$.next([]);
    activeCiphers$.next([]);
    vaultScope.set(ALL_ITEMS_SCOPE);

    TestBed.configureTestingModule({
      providers: [
        { provide: CoachmarkService, useValue: coachmark },
        { provide: StateProvider, useValue: mock<StateProvider>() },
        { provide: VaultNavService, useValue: { viewModel$: () => vaultNav$ } },
        { provide: VaultPopupListTableService, useValue: { vaultScope } },
        { provide: VaultPopupListTableFiltersService, useValue: { collections$, folders$ } },
        { provide: VaultPopupItemsService, useValue: { activeCiphers$ } },
      ],
    });

    service = TestBed.inject(VaultPopupTourService);
  });

  it("starts every step and anchors Shared folders when the vault lists collections", async () => {
    await service.start(userId);

    expect(startedSteps()).toEqual(["switchVaults", "filters", "sharedFolders"]);
    expect(service.sharedFoldersRow()).toBe("collection");
  });

  it("skips the vault switcher step when the account has a single vault", async () => {
    vaultNav$.next({ vaults: [{ id: "user-1" }] });

    await service.start(userId);

    expect(startedSteps()).toEqual(["filters", "sharedFolders"]);
  });

  it("anchors My folders when the scoped vault lists folders but no collections", async () => {
    vaultScope.set({ type: VaultScopeType.MyVault });
    folders$.next([folder]);
    activeCiphers$.next([{ id: "cipher-1", organizationId: null, folderId: "folder-1" }]);

    await service.start(userId);

    expect(startedSteps()).toEqual(["switchVaults", "filters", "sharedFolders"]);
    expect(service.sharedFoldersRow()).toBe("folder");
  });

  it("skips the shared folders step when the scoped vault lists neither", async () => {
    vaultScope.set({ type: VaultScopeType.MyVault });

    await service.start(userId);

    expect(startedSteps()).toEqual(["switchVaults", "filters"]);
    expect(service.sharedFoldersRow()).toBeNull();
  });

  it("skips the shared folders step when the account has no collections or folders", async () => {
    collections$.next([]);

    await service.start(userId);

    expect(startedSteps()).toEqual(["switchVaults", "filters"]);
    expect(service.sharedFoldersRow()).toBeNull();
  });
});

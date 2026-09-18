import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { VaultFilterServiceAbstraction } from "@bitwarden/vault";

import { PersistedVaultFilterExpansionService } from "./persisted-vault-filter-expansion.service";

describe("PersistedVaultFilterExpansionService", () => {
  let vaultFilterService: MockProxy<VaultFilterServiceAbstraction>;

  const userId = "user-1" as UserId;

  const setup = (
    collapsedNodeIds: string[],
    activeAccount: { id: UserId } | null = { id: userId },
  ) => {
    vaultFilterService = mock<VaultFilterServiceAbstraction>();
    // jest-mock-extended does not preserve Observable properties passed via the constructor
    // partial, so this must be assigned directly on the mock instead.
    vaultFilterService.persistedCollapsedVaultFilterNodes$ = of(new Set(collapsedNodeIds));
    vaultFilterService.setPersistedVaultFilterNodeOpen.mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        { provide: VaultFilterServiceAbstraction, useValue: vaultFilterService },
        { provide: AccountService, useValue: { activeAccount$: of(activeAccount) } },
        { provide: LogService, useValue: mock<LogService>() },
      ],
    });

    return TestBed.inject(PersistedVaultFilterExpansionService);
  };

  afterEach(() => TestBed.resetTestingModule());

  it("treats a node with no id as always open", () => {
    const service = setup([]);

    expect(service.isOpen(undefined)).toBe(true);
  });

  it("defaults to open when nothing is persisted as collapsed", () => {
    const service = setup([]);

    expect(service.isOpen("AllVaults")).toBe(true);
  });

  it("reports collapsed for a persisted node id", () => {
    const service = setup(["AllVaults"]);

    expect(service.isOpen("AllVaults")).toBe(false);
    expect(service.isOpen("AllItems")).toBe(true);
  });

  it("persists a node as collapsed", async () => {
    const service = setup([]);

    await service.setOpen("AllVaults", false);

    expect(vaultFilterService.setPersistedVaultFilterNodeOpen).toHaveBeenCalledWith(
      "AllVaults",
      false,
      userId,
    );
  });

  it("persists a node as expanded", async () => {
    const service = setup(["AllVaults"]);

    await service.setOpen("AllVaults", true);

    expect(vaultFilterService.setPersistedVaultFilterNodeOpen).toHaveBeenCalledWith(
      "AllVaults",
      true,
      userId,
    );
  });

  it("does nothing for a node with no id", async () => {
    const service = setup([]);

    await service.setOpen(undefined, false);

    expect(vaultFilterService.setPersistedVaultFilterNodeOpen).not.toHaveBeenCalled();
  });

  it("does not write and does not throw when there is no active account", async () => {
    const service = setup([], null);

    await expect(service.setOpen("AllVaults", false)).resolves.toBeUndefined();
    expect(vaultFilterService.setPersistedVaultFilterNodeOpen).not.toHaveBeenCalled();
  });

  it("logs and does not throw when the write fails", async () => {
    const logService = mock<LogService>();
    vaultFilterService = mock<VaultFilterServiceAbstraction>();
    vaultFilterService.persistedCollapsedVaultFilterNodes$ = of(new Set<string>());
    vaultFilterService.setPersistedVaultFilterNodeOpen.mockRejectedValue(new Error("write failed"));

    TestBed.configureTestingModule({
      providers: [
        { provide: VaultFilterServiceAbstraction, useValue: vaultFilterService },
        { provide: AccountService, useValue: { activeAccount$: of({ id: userId }) } },
        { provide: LogService, useValue: logService },
      ],
    });
    const service = TestBed.inject(PersistedVaultFilterExpansionService);

    await expect(service.setOpen("AllVaults", false)).resolves.toBeUndefined();
    expect(logService.error).toHaveBeenCalled();
  });
});

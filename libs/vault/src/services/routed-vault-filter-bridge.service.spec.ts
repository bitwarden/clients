import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { VaultFilterService } from "../abstractions/vault-filter.service";
import { RoutedVaultFilterModel } from "../models/routed-vault-filter.model";
import { VaultFilter } from "../models/vault-filter.model";
import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "../models/vault-filter.type";

import { RoutedVaultFilterBridgeService } from "./routed-vault-filter-bridge.service";
import { RoutedVaultFilterService } from "./routed-vault-filter.service";

describe("RoutedVaultFilterBridgeService", () => {
  function activeFilter(filter: RoutedVaultFilterModel): Promise<VaultFilter> {
    // Assigned rather than passed to `mock()`, which wraps a value it is given so the stream never emits.
    const vaultFilterService = mock<VaultFilterService>();
    vaultFilterService.collectionTree$ = of(
      new TreeNode<CollectionFilter>({ id: "AllCollections" } as CollectionFilter, null),
    );
    vaultFilterService.organizationTree$ = of(
      new TreeNode<OrganizationFilter>({ id: "AllVaults" } as OrganizationFilter, null),
    );
    vaultFilterService.cipherTypeTree$ = of(
      new TreeNode<CipherTypeFilter>({ id: "AllItems", name: "allItems", type: "all" }, null),
    );
    vaultFilterService.folderTree$ = of(
      new TreeNode<FolderFilter>({ id: "AllFolders" } as FolderFilter, null),
    );
    const routedVaultFilterService = mock<RoutedVaultFilterService>();
    routedVaultFilterService.filter$ = of(filter);
    const service = new RoutedVaultFilterBridgeService(
      mock<Router>(),
      routedVaultFilterService,
      vaultFilterService,
    );

    return firstValueFrom(service.activeFilter$);
  }

  it("rebuilds the controlled access node from the id in the URL", async () => {
    const filter = await activeFilter({ controlledAccess: "privileged" });

    expect(filter.controlledAccessId).toBe("privileged");
  });

  it("leaves All items unselected while a controlled access option is selected", async () => {
    const filter = await activeFilter({ controlledAccess: "privileged" });

    expect(filter.selectedCipherTypeNode).toBeUndefined();
  });

  it("selects All items when no type or controlled access option is set", async () => {
    const filter = await activeFilter({});

    expect(filter.selectedCipherTypeNode?.node.id).toBe("AllItems");
    expect(filter.controlledAccessId).toBeUndefined();
  });
});

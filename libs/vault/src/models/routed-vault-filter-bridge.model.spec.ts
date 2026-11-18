import { mock, MockProxy } from "jest-mock-extended";

import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { RoutedVaultFilterBridgeService } from "../services/routed-vault-filter-bridge.service";

import { RoutedVaultFilterBridge } from "./routed-vault-filter-bridge.model";
import { RoutedVaultFilterModel } from "./routed-vault-filter.model";
import { VaultFilter } from "./vault-filter.model";
import { CipherTypeFilter, ControlledAccessFilter } from "./vault-filter.type";

describe("RoutedVaultFilterBridge", () => {
  const privileged = new TreeNode<ControlledAccessFilter>(
    { id: "privileged", name: "Privileged" },
    null,
  );

  let bridgeService: MockProxy<RoutedVaultFilterBridgeService>;

  beforeEach(() => {
    bridgeService = mock<RoutedVaultFilterBridgeService>();
  });

  function bridge(
    routedFilter: RoutedVaultFilterModel,
    legacyFilter = new VaultFilter(),
  ): RoutedVaultFilterBridge {
    return new RoutedVaultFilterBridge(routedFilter, legacyFilter, bridgeService);
  }

  describe("controlled access", () => {
    it("routes to the selected option and clears the type, folder and collection", () => {
      bridge({
        type: "login",
        folderId: "folder-1",
        organizationIdParamType: "query",
      }).selectedControlledAccessNode = privileged;

      expect(bridgeService.navigate).toHaveBeenCalledWith({
        organizationIdParamType: "query",
        controlledAccess: "privileged",
        type: undefined,
        folderId: undefined,
        collectionId: undefined,
      });
    });

    it("reads the selection from the legacy filter", () => {
      const routed = bridge(
        { controlledAccess: "privileged" },
        new VaultFilter({ selectedControlledAccessNode: privileged }),
      );

      expect(routed.selectedControlledAccessNode).toBe(privileged);
      expect(routed.controlledAccessId).toBe("privileged");
    });

    it("clears the option when a cipher type is selected", () => {
      bridge({
        controlledAccess: "privileged",
        organizationIdParamType: "query",
      }).selectedCipherTypeNode = new TreeNode<CipherTypeFilter>(
        { id: "login", name: "Login", type: CipherType.Login },
        null,
      );

      expect(bridgeService.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "login", controlledAccess: undefined }),
      );
    });

    it("clears the option on resetFilter", () => {
      bridge({ controlledAccess: "privileged", organizationIdParamType: "query" }).resetFilter();

      expect(bridgeService.navigate).toHaveBeenCalledWith(
        expect.objectContaining({ controlledAccess: undefined }),
      );
    });
  });
});

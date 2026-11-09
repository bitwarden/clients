import { Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";
import { ALL_ITEMS_SCOPE, MY_ITEMS_ROUTE, VaultScope, VaultScopeType } from "@bitwarden/vault";

import { ImportDesktopComponent } from "../../../app/tools/import/import-desktop.component";

import { VaultComponent } from "./vault.component";

const organizationId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11" as OrganizationId;
const sharedFolderId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";

// The component injects dozens of services for the whole vault page. `openImport` uses five of
// them, so it is run on the component's prototype with just those.
describe("VaultComponent openImport", () => {
  const configService = mock<ConfigService>();
  const router = mock<Router>();
  const dialogService = mock<DialogService>();

  const openImport = (options: { importUpgrade: boolean; vfo1: boolean; scope: VaultScope }) => {
    configService.getFeatureFlag.mockImplementation((flag) =>
      Promise.resolve(flag === FeatureFlag.ImportUpgrade ? options.importUpgrade : false),
    );
    const component = Object.assign(Object.create(VaultComponent.prototype), {
      configService,
      router,
      dialogService,
      vfo1Foundation: () => options.vfo1,
      vaultScope: () => options.scope,
      vaultNav: () => undefined,
    }) as unknown as { openImport(): Promise<void> };
    return component.openImport();
  };

  const organizationScope = (collectionId?: string): VaultScope => ({
    type: VaultScopeType.Organization,
    organizationId,
    collectionId: collectionId as never,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    router.navigate.mockResolvedValue(true);
  });

  describe("with the import upgrade on", () => {
    it("starts the import on the organization when viewing its vault", async () => {
      await openImport({ importUpgrade: true, vfo1: true, scope: organizationScope() });

      expect(router.navigate).toHaveBeenCalledWith(["/import"], {
        queryParams: { defaultOrganizationId: organizationId },
      });
      expect(dialogService.open).not.toHaveBeenCalled();
    });

    it("starts the import on the shared folder too when viewing one", async () => {
      await openImport({
        importUpgrade: true,
        vfo1: true,
        scope: organizationScope(sharedFolderId),
      });

      expect(router.navigate).toHaveBeenCalledWith(["/import"], {
        queryParams: { defaultOrganizationId: organizationId, defaultCollectionId: sharedFolderId },
      });
    });

    it("leaves out the collection while it is still the My items placeholder, not an id", async () => {
      await openImport({
        importUpgrade: true,
        vfo1: true,
        scope: organizationScope(MY_ITEMS_ROUTE),
      });

      expect(router.navigate).toHaveBeenCalledWith(["/import"], {
        queryParams: { defaultOrganizationId: organizationId, startedFrom: "my-items" },
      });
    });

    it.each([
      [{ type: VaultScopeType.MyVault } as VaultScope, "my-vault"],
      [{ type: VaultScopeType.Trash } as VaultScope, "trash"],
      [{ type: VaultScopeType.Archive } as VaultScope, "archive"],
      [{ type: VaultScopeType.Folder, folderId: sharedFolderId } as VaultScope, sharedFolderId],
    ])(
      "starts the import from the personal page %j so it ends there",
      async (scope, startedFrom) => {
        await openImport({ importUpgrade: true, vfo1: true, scope });

        expect(router.navigate).toHaveBeenCalledWith(["/import"], { queryParams: { startedFrom } });
      },
    );

    it("passes no scope when viewing all items", async () => {
      await openImport({ importUpgrade: true, vfo1: true, scope: ALL_ITEMS_SCOPE });

      expect(router.navigate).toHaveBeenCalledWith(["/import"]);
    });

    it("passes no scope without the new vault layout, as the legacy import didn't", async () => {
      await openImport({ importUpgrade: true, vfo1: false, scope: organizationScope() });

      expect(router.navigate).toHaveBeenCalledWith(["/import"]);
    });
  });

  describe("with the import upgrade off", () => {
    it("opens the legacy import dialog on the organization and shared folder", async () => {
      await openImport({
        importUpgrade: false,
        vfo1: true,
        scope: organizationScope(sharedFolderId),
      });

      expect(dialogService.open).toHaveBeenCalledWith(ImportDesktopComponent, {
        data: { defaultOrganizationId: organizationId, defaultCollectionId: sharedFolderId },
      });
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("opens the legacy import dialog with no scope without the new vault layout", async () => {
      await openImport({ importUpgrade: false, vfo1: false, scope: organizationScope() });

      expect(dialogService.open).toHaveBeenCalledWith(ImportDesktopComponent, {
        data: { defaultOrganizationId: undefined, defaultCollectionId: undefined },
      });
    });
  });
});

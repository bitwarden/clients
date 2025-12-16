import { Injectable } from "@angular/core";
import { Router } from "@angular/router";

import {
  RoutedVaultFilterService,
  RoutedVaultFilterBridgeService,
  RoutedVaultFilterModel,
  VaultFilterServiceAbstraction as VaultFilterService,
} from "@bitwarden/vault";

/**
 * Desktop-specific extension of RoutedVaultFilterBridgeService that ensures
 * vault filter navigation always goes to the /new-vault route.
 */
@Injectable()
export class DesktopRoutedVaultFilterBridgeService extends RoutedVaultFilterBridgeService {
  private static readonly VAULT_ROUTE = "/new-vault";
  private readonly desktopRouter: Router;
  private readonly desktopRoutedVaultFilterService: RoutedVaultFilterService;

  constructor(
    router: Router,
    routedVaultFilterService: RoutedVaultFilterService,
    vaultFilterService: VaultFilterService,
  ) {
    super(router, routedVaultFilterService, vaultFilterService);
    this.desktopRouter = router;
    this.desktopRoutedVaultFilterService = routedVaultFilterService;
  }

  override navigate(filter: RoutedVaultFilterModel) {
    const extras = this.desktopRoutedVaultFilterService.createRoute(filter)[1];
    const vaultCommands = [DesktopRoutedVaultFilterBridgeService.VAULT_ROUTE];

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.desktopRouter.navigate(vaultCommands, extras);
  }
}

import { computed, inject, Injectable, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { EMPTY, map } from "rxjs";

import { VaultsNavViewModel } from "../../models/vault-nav-view-model";
import { resolveVaultScope, VaultScopeType } from "../../models/vault-scope";
import { VaultNavService } from "../../services/vault-nav.service";

/**
 * Derives whether the current vault context is "My vault" from the active route and navigation
 * model, so {@link EmptyVaultComponent} can show the right empty-state copy without any host
 * wiring.
 *
 * Provided at the component level so each instance reads the nearest `ActivatedRoute`.
 */
@Injectable()
export class EmptyVaultService {
  /**
   * Optional — `null` when rendered outside a router context (e.g. Storybook, unit tests).
   * When present, used with {@link vaultNavService} to derive the active vault scope.
   */
  private readonly activatedRoute = inject(ActivatedRoute, { optional: true });

  /**
   * Optional — not provided in all clients. When absent, personal-only account detection falls back
   * to `parseVaultScope` alone, which still correctly identifies the `my-vault` URL segment.
   */
  private readonly vaultNavService = inject(VaultNavService, { optional: true });

  /**
   * The `:vaultId` route param, or `null` when there is no router or no such param. The `EMPTY`
   * fallback completes without emitting, so `initialValue` keeps the signal stable at `null`.
   */
  private readonly vaultIdParam = toSignal(
    this.activatedRoute?.paramMap.pipe(map((params) => params.get("vaultId"))) ?? EMPTY,
    { initialValue: null as string | null },
  );

  /**
   * The vaults nav view model, or `undefined` when {@link vaultNavService} is not provided. Used
   * by {@link resolveVaultScope} to detect personal-only accounts.
   */
  private readonly vaultNav = this.vaultNavService
    ? toSignal(this.vaultNavService.viewModel$)
    : signal<VaultsNavViewModel | undefined>(undefined);

  /**
   * Whether the current route scopes the page to the personal vault — derived from the `:vaultId`
   * param and the nav view model so personal-only accounts (where the unscoped URL also resolves
   * to My vault) are covered automatically.
   */
  readonly isMyVaultScope = computed(
    () => resolveVaultScope(this.vaultIdParam(), this.vaultNav())?.type === VaultScopeType.MyVault,
  );
}

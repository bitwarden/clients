import { Injectable, OnDestroy, inject } from "@angular/core";
import { ActivatedRoute, NavigationExtras } from "@angular/router";
import { combineLatest, map, Observable, Subject, takeUntil } from "rxjs";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SafeInjectionToken } from "@bitwarden/ui-common";

import {
  isRoutedVaultFilterItemType,
  RoutedVaultFilterModel,
} from "../models/routed-vault-filter.model";

/**
 * Injection token for the base route path used in vault filter navigation.
 */
export const VAULT_FILTER_BASE_ROUTE = new SafeInjectionToken<string>("VaultFilterBaseRoute");

/**
 * This service is an abstraction layer on top of ActivatedRoute that
 * encapsulates the logic of how filters are stored in the URL.
 *
 * The service builds and emits filter models based on URL params and
 * also contains a method for generating routes to corresponding to those params.
 */
@Injectable()
export class RoutedVaultFilterService implements OnDestroy {
  private onDestroy = new Subject<void>();
  private baseRoute: string = inject(VAULT_FILTER_BASE_ROUTE, { optional: true }) ?? "";

  /**
   * Filter values extracted from the URL.
   * To change the values use {@link RoutedVaultFilterService.createRoute}.
   */
  filter$: Observable<RoutedVaultFilterModel>;

  constructor(activatedRoute: ActivatedRoute) {
    this.filter$ = combineLatest([activatedRoute.paramMap, activatedRoute.queryParamMap]).pipe(
      map(([params, queryParams]) => {
        const unsafeType = queryParams.get("type");
        const type = isRoutedVaultFilterItemType(unsafeType) ? unsafeType : undefined;

        return {
          collectionId: (queryParams.get("collectionId") as CollectionId) ?? undefined,
          folderId: queryParams.get("folderId") ?? undefined,
          organizationId:
            (params.get("organizationId") as OrganizationId) ??
            (queryParams.get("organizationId") as OrganizationId) ??
            undefined,
          organizationIdParamType:
            params.get("organizationId") != undefined ? ("path" as const) : ("query" as const),
          type,
        };
      }),
      takeUntil(this.onDestroy),
    );
  }

  /**
   * Create a route that can be used to modify filters with Router or RouterLink.
   * This method is specifically built to leave other query parameters untouched,
   * meaning that navigation will only affect filters and not e.g. `cipherId`.
   * To subscribe to changes use {@link RoutedVaultFilterService.filter$}.
   *
   * Note:
   * This method currently only supports changing filters that are stored
   * in query parameters. This means that {@link RoutedVaultFilterModel.organizationId}
   * will be ignored if {@link RoutedVaultFilterModel.organizationIdParamType}
   * is set to `path`.
   *
   * @param filter Filter values that should be applied to the URL.
   * @returns route that can be used with Router or RouterLink
   */
  createRoute(filter: RoutedVaultFilterModel): [commands: any[], extras?: NavigationExtras] {
    const commands: string[] = this.baseRoute ? [this.baseRoute] : [];
    const extras: NavigationExtras = {
      queryParams: {
        collectionId: filter.collectionId ?? null,
        folderId: filter.folderId ?? null,
        organizationId:
          filter.organizationIdParamType === "path" ? null : (filter.organizationId ?? null),
        type: filter.type ?? null,
      },
      queryParamsHandling: "merge",
      state: {
        focusAfterNav: false,
      },
    };
    return [commands, extras];
  }

  ngOnDestroy(): void {
    this.onDestroy.next();
    this.onDestroy.complete();
  }
}

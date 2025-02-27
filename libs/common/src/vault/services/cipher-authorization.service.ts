import { combineLatest, map, Observable, of, shareReplay, switchMap, withLatestFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CollectionId } from "@bitwarden/common/types/guid";

import { getUserId } from "../../auth/services/account.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { Cipher } from "../models/domain/cipher";
import { CipherView } from "../models/view/cipher.view";

/**
 * Represents either a cipher or a cipher view.
 */
type CipherLike = Cipher | CipherView;

/**
 * Service for managing user cipher authorization.
 */
export abstract class CipherAuthorizationService {
  /**
   * Determines if the user can delete the specified cipher.
   *
   * @param {CipherLike} cipher - The cipher object to evaluate for deletion permissions.
   * @param {CollectionId[]} [allowedCollections] - Optional. The selected collection id from the vault filter.
   * @param {boolean} isAdminConsoleAction - Optional. A flag indicating if the action is being performed from the admin console.
   *
   * @returns {Observable<boolean>} - An observable that emits a boolean value indicating if the user can delete the cipher.
   */
  abstract canDeleteCipher$: (
    cipher: CipherLike,
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ) => Observable<boolean>;

  abstract canDeleteMany$: (
    ciphers: CipherLike[],
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ) => Observable<boolean>;

  /**
   * Determines if the user can clone the specified cipher.
   *
   * @param {CipherLike} cipher - The cipher object to evaluate for cloning permissions.
   * @param {boolean} isAdminConsoleAction - Optional. A flag indicating if the action is being performed from the admin console.
   *
   * @returns {Observable<boolean>} - An observable that emits a boolean value indicating if the user can clone the cipher.
   */
  abstract canCloneCipher$: (
    cipher: CipherLike,
    isAdminConsoleAction?: boolean,
  ) => Observable<boolean>;
}

/**
 * {@link CipherAuthorizationService}
 */
export class DefaultCipherAuthorizationService implements CipherAuthorizationService {
  constructor(
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {}

  private organization$ = (cipher: CipherLike) =>
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      map((orgs) => orgs.find((org) => org.id === cipher.organizationId)),
    );

  canDeleteMany$(
    ciphers: CipherLike[],
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ): Observable<boolean> {
    const results = [];
    for (const cipher of ciphers) {
      if (cipher.organizationId == null) {
        results.push(of(true));
        continue;
      }

      results.push(this.checkPermissions(cipher, allowedCollections, isAdminConsoleAction));
    }

    return combineLatest(results).pipe(map((results) => !results.includes(false)));
  }

  /**
   *
   * {@link CipherAuthorizationService.canDeleteCipher$}
   */
  canDeleteCipher$(
    cipher: CipherLike,
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ): Observable<boolean> {
    if (cipher.organizationId == null) {
      return of(true);
    }

    return this.checkPermissions(cipher, allowedCollections, isAdminConsoleAction);
  }

  /**
   * {@link CipherAuthorizationService.canCloneCipher$}
   */
  canCloneCipher$(cipher: CipherLike, isAdminConsoleAction?: boolean): Observable<boolean> {
    if (cipher.organizationId == null) {
      return of(true);
    }

    return this.organization$(cipher).pipe(
      switchMap((organization) => {
        // Admins and custom users can always clone when in the Admin Console
        if (
          isAdminConsoleAction &&
          organization &&
          (organization.isAdmin || organization.permissions?.editAnyCollection)
        ) {
          return of(true);
        }

        return this.collectionService
          .decryptedCollectionViews$(cipher.collectionIds as CollectionId[])
          .pipe(map((allCollections) => allCollections.some((collection) => collection.manage)));
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  private checkPermissions(
    cipher: CipherLike,
    allowedCollections?: CollectionId[],
    isAdminConsoleAction?: boolean,
  ): Observable<boolean> {
    return this.organization$(cipher).pipe(
      withLatestFrom(this.configService.getFeatureFlag$(FeatureFlag.LimitItemDeletion)),
      switchMap(([organization, featureFlagEnabled]) => {
        if (isAdminConsoleAction) {
          // If the user is an admin, they can delete an unassigned cipher
          if (!cipher.collectionIds || cipher.collectionIds.length === 0) {
            return of(organization?.canEditUnassignedCiphers === true);
          }

          if (organization?.canEditAllCiphers) {
            return of(true);
          }
        }

        if (featureFlagEnabled && !!cipher.permissions) {
          return of(cipher.permissions.delete);
        }

        return this.collectionService
          .decryptedCollectionViews$(cipher.collectionIds as CollectionId[])
          .pipe(
            map((allCollections) => {
              const shouldFilter = allowedCollections?.some(Boolean);

              const collections = shouldFilter
                ? allCollections.filter((c) => allowedCollections?.includes(c.id as CollectionId))
                : allCollections;

              return collections.some((collection) => collection.manage);
            }),
          );
      }),
    );
  }
}

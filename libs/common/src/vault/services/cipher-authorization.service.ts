// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map, Observable, of, shareReplay, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CollectionId } from "@bitwarden/common/types/guid";

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
  canDeleteCipher$: (
    cipher: CipherLike,
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
  canCloneCipher$: (cipher: CipherLike, isAdminConsoleAction?: boolean) => Observable<boolean>;
}

/**
 * {@link CipherAuthorizationService}
 */
export class DefaultCipherAuthorizationService implements CipherAuthorizationService {
  constructor(
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  private organization$ = (cipher: CipherLike) =>
    this.accountService.activeAccount$.pipe(
      switchMap((account) => this.organizationService.organizations$(account?.id)),
      map((orgs) => orgs.find((org) => org.id === cipher.organizationId)),
    );
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

    return this.organization$(cipher).pipe(
      switchMap((organization) => {
        if (isAdminConsoleAction) {
          // If the user is an admin, they can delete an unassigned cipher
          if (!cipher.collectionIds || cipher.collectionIds.length === 0) {
            return of(organization?.canEditUnassignedCiphers === true);
          }

          if (organization?.canEditAllCiphers) {
            return of(true);
          }
        }

        return this.collectionService
          .decryptedCollectionViews$(cipher.collectionIds as CollectionId[])
          .pipe(
            map((allCollections) => {
              const shouldFilter = allowedCollections?.some(Boolean);

              const collections = shouldFilter
                ? allCollections.filter((c) => allowedCollections.includes(c.id as CollectionId))
                : allCollections;

              return collections.some((collection) => collection.manage);
            }),
          );
      }),
    );
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
}

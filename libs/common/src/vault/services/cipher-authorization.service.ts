import { map, Observable, of, switchMap } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
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
   *
   * @returns {Observable<boolean>} - An observable that emits a boolean value indicating if the user can delete the cipher.
   */
  canDeleteCipher$: (
    cipher: CipherLike,
    allowedCollections?: CollectionId[],
  ) => Observable<boolean>;
}

/**
 * {@link CipherAuthorizationService}
 */
export class DefaultCipherAuthorizationService implements CipherAuthorizationService {
  constructor(
    private collectionService: CollectionService,
    private organizationService: OrganizationService,
  ) {}

  /**
   *
   * {@link CipherAuthorizationService.canDeleteCipher$}
   */
  canDeleteCipher$(cipher: CipherLike, allowedCollections?: CollectionId[]): Observable<boolean> {
    if (cipher.organizationId == null) {
      return of(true);
    }

    return this.organizationService.get$(cipher.organizationId).pipe(
      switchMap((organization) => {
        // If the user is an admin, they can delete an unassigned cipher
        if (!cipher.collectionIds || cipher.collectionIds.length === 0) {
          return of(organization?.canEditUnassignedCiphers === true);
        }

        if (organization?.canEditAllCiphers) {
          return of(true);
        }

        return this.collectionService
          .decryptedCollectionViews$(cipher.collectionIds as CollectionId[])
          .pipe(
            map((allCollections) => {
              const collections = allowedCollections
                ? allCollections.filter((c) => allowedCollections.includes(c.id as CollectionId))
                : allCollections;

              return collections.some((collection) => collection.manage);
            }),
          );
      }),
    );
  }
}

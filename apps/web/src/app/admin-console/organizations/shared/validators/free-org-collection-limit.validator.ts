import { AbstractControl, AsyncValidatorFn, FormControl, ValidationErrors } from "@angular/forms";
import { combineLatest, map, Observable, of } from "rxjs";

import { Collection } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";

export function freeOrgCollectionLimitValidator(
  organizations$: Observable<Organization[]>,
  collections$: Observable<Collection[]>,
  i18nService: I18nService,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    if (!(control instanceof FormControl)) {
      return of(null);
    }

    const orgId = control.value;

    if (!orgId) {
      return of(null);
    }

    return combineLatest([organizations$.pipe(getById(orgId)), collections$]).pipe(
      map(([organization, collections]) => {
        if (!organization) {
          return null;
        }

        const orgCollections = collections.filter(
          (collection: Collection) => collection.organizationId === organization.id,
        );
        const hasReachedLimit = organization.maxCollections === orgCollections.length;

        if (hasReachedLimit) {
          return {
            cannotCreateCollections: { message: i18nService.t("cannotCreateCollection") },
          };
        }

        return null;
      }),
    );
  };
}

import { AbstractControl, AsyncValidatorFn, FormControl, ValidationErrors } from "@angular/forms";
import { map, Observable, of } from "rxjs";

import { Collection } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export function freeOrgCollectionLimitValidator(
  orgs: Observable<Organization[]>,
  collections: Collection[],
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

    return orgs.pipe(
      map((organizations) => organizations.find((org) => org.id === orgId)),
      map((org) => {
        if (!org) {
          return null;
        }

        const orgCollections = collections.filter((c) => c.organizationId === org.id);
        const hasReachedLimit = org.maxCollections === orgCollections.length;

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

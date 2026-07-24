import { Injectable } from "@angular/core";
import { Observable, of, combineLatest, map, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * Service responsible for determining access to the browser extension Health report feature.
 */
@Injectable({
  providedIn: "root",
})
export class HealthAccessService {
  constructor(
    private configService: ConfigService,
    private organizationService: OrganizationService,
  ) {}

  /**
   * Given a UserId, returns an observable that emits true when the User has access to the Health report feature.
   * The Health report feature is only available to Users with personal accounts or belonging to free/family Organizations.
   *
   * @param userId A User's ID.
   * @returns An observable that emits true if the User has access to the Health report feature, false otherwise.
   */
  healthEnabled$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.BrowserExtensionHealthReport),
      of(userId).pipe(
        switchMap(
          (userId) =>
            !this.organizationService.hasOrganizations(userId) ||
            this.organizationService
              .organizations$(userId)
              .pipe(
                map((orgs) =>
                  orgs.every(
                    (org) =>
                      org.productTierType === ProductTierType.Free ||
                      org.productTierType === ProductTierType.Families,
                  ),
                ),
              ),
        ),
      ),
    ]).pipe(
      map(([healthFlagEnabled, userHasHealthAccess]) => healthFlagEnabled && userHasHealthAccess),
    );
  }
}

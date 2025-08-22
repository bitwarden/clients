import { Injectable, inject } from "@angular/core";
import { Observable, combineLatest, from, of } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricStateService } from "@bitwarden/key-management";

import { DefaultSingleNudgeService } from "../default-single-nudge.service";
import { NudgeStatus, NudgeType } from "../nudges.service";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: "root" })
export class AccountSecurityNudgeService extends DefaultSingleNudgeService {
  private vaultProfileService = inject(VaultProfileService);
  private logService = inject(LogService);
  private pinService = inject(PinServiceAbstraction);
  private biometricStateService = inject(BiometricStateService);
  private policyService = inject(PolicyService);
  private organizationService = inject(OrganizationService);

  nudgeStatus$(nudgeType: NudgeType, userId: UserId): Observable<NudgeStatus> {
    const profileDate$ = from(this.vaultProfileService.getProfileCreationDate(userId)).pipe(
      catchError(() => {
        this.logService.error("Failed to load profile date:");
        // Default to today to ensure the nudge is shown in case of an error
        return of(new Date());
      }),
    );

    return combineLatest([
      profileDate$,
      this.getNudgeStatus$(nudgeType, userId),
      of(Date.now() - THIRTY_DAYS_MS),
      from(this.pinService.isPinSet(userId)),
      this.biometricStateService.biometricUnlockEnabled$,
      this.organizationService.organizations$(userId),
      this.policyService.policiesByType$(PolicyType.RemoveUnlockWithPin, userId),
    ]).pipe(
      switchMap(
        async ([
          profileCreationDate,
          status,
          profileCutoff,
          isPinSet,
          biometricUnlockEnabled,
          organizations,
          policies,
        ]) => {
          const profileOlderThanCutoff = profileCreationDate.getTime() < profileCutoff;

          const hasOrgWithRemovePinPolicyOn = organizations.some((org) => {
            return policies.some(
              (p) => p.type === PolicyType.RemoveUnlockWithPin && p.organizationId === org.id,
            );
          });

          const hideNudge =
            profileOlderThanCutoff ||
            isPinSet ||
            biometricUnlockEnabled ||
            hasOrgWithRemovePinPolicyOn;

          const acctSecurityNudgeStatus = {
            hasBadgeDismissed: status.hasBadgeDismissed || hideNudge,
            hasSpotlightDismissed: status.hasSpotlightDismissed || hideNudge,
          };

          if (
            (isPinSet || biometricUnlockEnabled || hasOrgWithRemovePinPolicyOn) &&
            !status.hasSpotlightDismissed
          ) {
            await this.setNudgeStatus(nudgeType, acctSecurityNudgeStatus, userId);
          }
          return acctSecurityNudgeStatus;
        },
      ),
    );
  }
}

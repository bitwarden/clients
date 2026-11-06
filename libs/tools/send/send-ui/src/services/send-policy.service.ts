import { inject, Injectable } from "@angular/core";
import { combineLatest, firstValueFrom, map, Observable, shareReplay, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SendDeletionDatePreset } from "@bitwarden/common/tools/models/send-deletion-date-preset";
import { SendDisabledReason } from "@bitwarden/common/tools/models/send-disabled-reason";
import { WhoCanAccessType } from "@bitwarden/common/tools/models/send-who-can-access-type";
import { Send } from "@bitwarden/common/tools/send/models/domain/send";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { OrganizationId } from "@bitwarden/common/types/guid";

/**
 * Service for evaluating Send-related policy restrictions for the current user.
 */
@Injectable({
  providedIn: "root",
})
export class SendPolicyService {
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(getUserId);

  /**
   * Emits `true` when the active user is prohibited from creating or editing Sends.
   * Uses both the Send Controls policy and the legacy Disable Send policy
   */
  readonly disableSend$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.policyService
          .policiesByType$(PolicyType.SendControls, userId)
          .pipe(map((policies) => policies?.some((p) => p.data?.disableSend === true) ?? false)),
        this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
      ]).pipe(map(([sendControls, legacyDisableSend]) => sendControls || legacyDisableSend)),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Emits `true` when the active user is prohibited from hiding their email on Sends.
   * Uses both the Send Controls policy and the legacy Send Options policy
   */
  readonly disableHideEmail$: Observable<boolean> = this.activeUserId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.policyService
          .policiesByType$(PolicyType.SendControls, userId)
          .pipe(
            map((policies) => policies?.some((p) => p.data?.disableHideEmail === true) ?? false),
          ),
        this.policyService
          .policiesByType$(PolicyType.SendOptions, userId)
          .pipe(map((policies) => policies?.some((p) => p.data?.disableHideEmail) ?? false)),
      ]).pipe(map(([sendControls, legacySendOptions]) => sendControls || legacySendOptions)),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly whoCanAccess$: Observable<WhoCanAccessType | null> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.SendControls, userId).pipe(
        map((policies) => {
          const policy = policies?.find((p) => p.data?.whoCanAccess != null);
          return (policy?.data?.whoCanAccess as WhoCanAccessType) ?? null;
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly allowedDomains$: Observable<string[] | null> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.SendControls, userId).pipe(
        map((policies) => {
          const policy = policies?.find((p) => p.data?.allowedDomains);
          const raw = policy?.data?.allowedDomains as string;
          if (!raw) {
            return null;
          }
          return raw
            .split(",")
            .map((d: string) => d.trim().toLowerCase())
            .filter((d: string) => d.length > 0);
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // Returns whatever deletion date preset is mandated by policy and the ID of the organization whose policy set it
  readonly deletionDatePolicyInfo$: Observable<{
    deletionHours: SendDeletionDatePreset | null;
    orgId: OrganizationId | null;
  } | null> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.SendControls, userId).pipe(
        map((policies) => {
          const policy = policies?.find((p) => p.data?.deletionHours != null);
          const deletionHours = (policy?.data?.deletionHours as SendDeletionDatePreset) ?? null;
          const orgId = policy?.organizationId ?? null;
          return { deletionHours, orgId };
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Emits the SendTypes that are allowed by policy
   */
  readonly allowedSendTypes$: Observable<SendType[]> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.SendControls, userId).pipe(
        map((policies) => {
          const allowedSendTypes: SendType[] = policies.flatMap(
            (p) => p.data.allowedSendTypes ?? [],
          );
          const restrictedTypes = [...new Set(allowedSendTypes)];
          return restrictedTypes.length === 0 ? [SendType.Text, SendType.File] : restrictedTypes;
        }),
      ),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  async sendDisabledReason(send: SendView | Send) {
    if (!send.disabled) {
      return SendDisabledReason.None;
    }
    const allowedSendTypes = await firstValueFrom(this.allowedSendTypes$);
    if (allowedSendTypes && !allowedSendTypes.includes(send.type)) {
      return SendDisabledReason.RestrictedType;
    }
    return SendDisabledReason.Other;
  }
}

import { inject, Injectable } from "@angular/core";
import { combineLatest, distinctUntilChanged, firstValueFrom, map, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  StateProvider,
  UserKeyDefinition,
  VAULT_ORG_USER_NOTIFICATION_DISK_LOCAL,
} from "@bitwarden/common/platform/state";
import { OrganizationId } from "@bitwarden/common/types/guid";

export interface OrganizationUserNotificationBannerData {
  organizationId: OrganizationId;
  header: string | null;
  description: string;
  buttonText: string | null;
  showAfterEveryLogin: boolean;
  revisionDate: Date;
}

const dateDeserializer = (value: string) => (value != null ? new Date(value) : null);

export const NOTIFICATION_BANNER_DISMISSED_KEY = new UserKeyDefinition<Date>(
  VAULT_ORG_USER_NOTIFICATION_DISK_LOCAL,
  "notificationBannerDismissed",
  {
    deserializer: dateDeserializer,
    clearOn: [],
  },
);

export const NOTIFICATION_BANNER_DISMISSED_SESSION_KEY = new UserKeyDefinition<Date>(
  VAULT_ORG_USER_NOTIFICATION_DISK_LOCAL,
  "notificationBannerDismissedSession",
  {
    deserializer: dateDeserializer,
    clearOn: ["logout"],
  },
);

@Injectable()
export class VaultOrganizationUserNotificationsService {
  private readonly accountService = inject(AccountService);
  private readonly policyService = inject(PolicyService);
  private readonly configService = inject(ConfigService);
  private readonly stateProvider = inject(StateProvider);
  private readonly eventCollectionService = inject(EventCollectionService);

  private readonly userNotificationPolicies$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.policyService.policiesByType$(PolicyType.OrganizationUserNotification, userId),
    ),
  );

  private readonly latestUserNotificationPolicy$ = this.userNotificationPolicies$.pipe(
    map((policies) =>
      policies.reduce(
        (latest, policy) =>
          latest == null || policy.revisionDate > latest.revisionDate ? policy : latest,
        null as (typeof policies)[number] | null,
      ),
    ),
  );

  readonly notificationData$ = this.latestUserNotificationPolicy$.pipe(
    map((policy) => {
      if (!policy || !policy.enabled) {
        return null;
      }
      return {
        organizationId: policy.organizationId,
        header: (policy.data?.header as string | null) ?? null,
        description: (policy.data?.description as string) ?? "",
        buttonText: (policy.data?.buttonText as string | null) ?? null,
        showAfterEveryLogin: (policy.data?.showAfterEveryLogin as boolean) ?? false,
        revisionDate: policy.revisionDate,
      } satisfies OrganizationUserNotificationBannerData;
    }),
    distinctUntilChanged((a, b) => {
      if (a === b) {
        return true;
      }
      if (a == null || b == null) {
        return false;
      }
      return (
        a.organizationId === b.organizationId &&
        a.header === b.header &&
        a.description === b.description &&
        a.buttonText === b.buttonText &&
        a.showAfterEveryLogin === b.showAfterEveryLogin &&
        a.revisionDate.getTime() === b.revisionDate.getTime()
      );
    }),
  );

  readonly showNotificationBanner$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      combineLatest([
        this.notificationData$,
        this.stateProvider.getUser(userId, NOTIFICATION_BANNER_DISMISSED_KEY).state$,
        this.stateProvider.getUser(userId, NOTIFICATION_BANNER_DISMISSED_SESSION_KEY).state$,
        this.configService.getFeatureFlag$(FeatureFlag.PM31948_OrgUserNotificationBanner),
      ]),
    ),
    map(([data, lastDismissedDate, lastDismissedSessionDate, featureFlagEnabled]) => {
      if (!data || !featureFlagEnabled) {
        return false;
      }

      if (lastDismissedDate == null || lastDismissedDate < data.revisionDate) {
        return true;
      }

      return data.showAfterEveryLogin && lastDismissedSessionDate == null;
    }),
  );

  async saveDismissalToState(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const now = new Date();
    await Promise.all([
      this.stateProvider.getUser(userId, NOTIFICATION_BANNER_DISMISSED_KEY).update(() => now),
      this.stateProvider
        .getUser(userId, NOTIFICATION_BANNER_DISMISSED_SESSION_KEY)
        .update(() => now),
    ]);
  }

  async recordActionButtonClick(organizationId: OrganizationId): Promise<void> {
    await this.eventCollectionService.collect(
      EventType.OrganizationUser_NotificationBannerActionClicked,
      undefined,
      false,
      organizationId,
    );
    await this.saveDismissalToState();
  }
}

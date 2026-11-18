import { inject, Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, firstValueFrom, map, Observable, of, shareReplay, switchMap } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NUDGES_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { CoachmarkService } from "../components/coachmark/coachmark.service";

/** Item types announced as new, in menu order */
export const NEW_ITEM_TYPES: readonly CipherType[] = [
  CipherType.BankAccount,
  CipherType.DriversLicense,
  CipherType.Passport,
];

/** i18n keys for the coachmark title and description */
export type NewItemTypesCoachmarkCopy = {
  titleKey: string;
  descriptionKey: string;
};

// Keyed by which new types are available, in NEW_ITEM_TYPES order, so each combination
// translates as a whole sentence
const DESCRIPTION_KEYS: Record<string, string> = {
  "111": "addBankAccountsLicensesAndPassports",
  "110": "addBankAccountsAndLicenses",
  "101": "addBankAccountsAndPassports",
  "011": "addLicensesAndPassports",
  "100": "addBankAccounts",
  "010": "addLicenses",
  "001": "addPassports",
};

// Memory state clears on lock, so a deferred coachmark gets its chance on the next unlock
const SUPPRESSED_THIS_SESSION = new UserKeyDefinition<boolean>(
  NUDGES_MEMORY,
  "newItemTypesCoachmarkSuppressed",
  { deserializer: (suppressed) => suppressed, clearOn: ["lock", "logout"] },
);

/**
 * Decides when to announce the new item types: a one-time coachmark on the Add button and
 * one-time "New" badges in the choose-item list. Dismissals are stored per device.
 */
@Injectable({ providedIn: "root" })
export class NewItemTypesAnnouncementService {
  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);
  private readonly nudgesService = inject(NudgesService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly stateProvider = inject(StateProvider);
  private readonly coachmarkService = inject(CoachmarkService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  /** Set once the page's onboarding sequence has run, so the coachmark never races its prompts */
  private readonly released = signal(false);
  private readonly released$ = toObservable(this.released);
  private readonly tourRunning$ = toObservable(this.coachmarkService.isRunning);

  /** New item types the user can create: flag on, minus types an admin has restricted */
  readonly availableTypes$: Observable<CipherType[]> = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    this.restrictedItemTypesService.restricted$,
  ]).pipe(
    map(([enabled, restricted]) =>
      enabled
        ? NEW_ITEM_TYPES.filter((type) => !restricted.some((r) => r.cipherType === type))
        : [],
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Coachmark copy while it should show, otherwise `null` */
  readonly coachmarkCopy$: Observable<NewItemTypesCoachmarkCopy | null> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.availableTypes$,
        this.nudgesService.showNudgeSpotlight$(NudgeType.NewItemTypesAnnouncement, userId),
        this.stateProvider.getUser(userId, SUPPRESSED_THIS_SESSION).state$,
        this.released$,
        this.tourRunning$,
      ]),
    ),
    map(([types, pending, suppressed, released, tourRunning]) => {
      if (types.length === 0 || !pending || suppressed || !released || tourRunning) {
        return null;
      }
      return {
        titleKey: types.length === 1 ? "newItemTypeAvailable" : "newItemTypesAvailable",
        descriptionKey: DESCRIPTION_KEYS[NEW_ITEM_TYPES.map((t) => +types.includes(t)).join("")],
      };
    }),
  );

  /** New item types to badge in the choose-item list; empty once the badges were seen */
  readonly badgedTypes$: Observable<CipherType[]> = this.userId$.pipe(
    switchMap((userId) =>
      this.nudgesService.showNudgeBadge$(NudgeType.NewItemTypesAnnouncement, userId),
    ),
    switchMap((show) => (show ? this.availableTypes$ : of([]))),
  );

  /**
   * Lets the coachmark show once the page's onboarding sequence has run.
   * @param otherMessagingShown whether onboarding, redesign or upsell messaging showed instead,
   * which defers the coachmark to the next session
   */
  async release(otherMessagingShown: boolean): Promise<void> {
    if (otherMessagingShown) {
      const userId = await firstValueFrom(this.userId$);
      await this.stateProvider.getUser(userId, SUPPRESSED_THIS_SESSION).update(() => true);
    }
    this.released.set(true);
  }

  async dismissCoachmark(): Promise<void> {
    await this.updateStatus({ hasSpotlightDismissed: true });
  }

  async dismissBadges(): Promise<void> {
    await this.updateStatus({ hasBadgeDismissed: true });
  }

  private async updateStatus(status: {
    hasSpotlightDismissed?: boolean;
    hasBadgeDismissed?: boolean;
  }) {
    const userId: UserId = await firstValueFrom(this.userId$);
    await this.nudgesService.updateNudgeStatus(NudgeType.NewItemTypesAnnouncement, userId, status);
  }
}

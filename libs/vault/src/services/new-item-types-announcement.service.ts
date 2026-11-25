import { inject, Injectable } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, filter, map, Observable, of, shareReplay, switchMap } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NUDGES_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { CoachmarkService } from "../components/coachmark/coachmark.service";

/** Item types announced as new, in menu order */
export const NEW_ITEM_TYPES: readonly CipherType[] = [
  CipherType.BankAccount,
  CipherType.DriversLicense,
  CipherType.Passport,
];

/** i18n keys for the coachmark title and description, and the user it's shown to */
export type NewItemTypesCoachmarkCopy = {
  userId: UserId;
  titleKey: string;
  descriptionKey: string;
};

/** New item types to badge "New", and the user they're shown to */
export type NewItemTypesBadges = {
  userId: UserId;
  types: CipherType[];
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

// Set once the user's onboarding sequence has run, so the coachmark never races its prompts.
// Clears on lock, since the sequence runs again on unlock.
const RELEASED_THIS_SESSION = new UserKeyDefinition<boolean>(
  NUDGES_MEMORY,
  "newItemTypesCoachmarkReleased",
  { deserializer: (released) => released, clearOn: ["lock", "logout"] },
);

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
  private readonly cipherService = inject(CipherService);
  private readonly configService = inject(ConfigService);
  private readonly nudgesService = inject(NudgesService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly stateProvider = inject(StateProvider);
  private readonly coachmarkService = inject(CoachmarkService);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

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

  /**
   * Available new types the user has no items of yet. Dismissals are per device, so this keeps
   * a new client from announcing types the user already uses.
   */
  private unusedTypes$(userId: UserId): Observable<CipherType[]> {
    return combineLatest([
      this.availableTypes$,
      this.cipherService.cipherListViews$(userId).pipe(filter((ciphers) => ciphers != null)),
    ]).pipe(
      map(([types, ciphers]) => {
        const usedTypes = new Set(ciphers.map((cipher) => CipherViewLikeUtils.getType(cipher)));
        return types.filter((type) => !usedTypes.has(type));
      }),
    );
  }

  /** Coachmark copy while it should show, otherwise `null` */
  readonly coachmarkCopy$: Observable<NewItemTypesCoachmarkCopy | null> = this.userId$.pipe(
    switchMap((userId) =>
      combineLatest([
        this.unusedTypes$(userId),
        this.nudgesService.showNudgeSpotlight$(NudgeType.NewItemTypesAnnouncement, userId),
        this.stateProvider.getUser(userId, SUPPRESSED_THIS_SESSION).state$,
        this.stateProvider.getUser(userId, RELEASED_THIS_SESSION).state$,
        this.tourRunning$,
      ]).pipe(
        map(([types, pending, suppressed, released, tourRunning]) => {
          if (types.length === 0 || !pending || suppressed || !released || tourRunning) {
            return null;
          }
          return {
            userId,
            titleKey: types.length === 1 ? "newItemTypeAvailable" : "newItemTypesAvailable",
            descriptionKey:
              DESCRIPTION_KEYS[NEW_ITEM_TYPES.map((t) => +types.includes(t)).join("")],
          };
        }),
      ),
    ),
  );

  /** New item types to badge in the choose-item list; no types once the badges were seen */
  readonly badges$: Observable<NewItemTypesBadges> = this.userId$.pipe(
    switchMap((userId) =>
      this.nudgesService.showNudgeBadge$(NudgeType.NewItemTypesAnnouncement, userId).pipe(
        switchMap((show) => (show ? this.unusedTypes$(userId) : of([]))),
        map((types) => ({ userId, types })),
      ),
    ),
  );

  /**
   * Lets the coachmark show for the user once the page's onboarding sequence has run.
   * @param otherMessagingShown whether onboarding, redesign or upsell messaging showed instead,
   * which defers the coachmark to the next session
   */
  async release(userId: UserId, otherMessagingShown: boolean): Promise<void> {
    if (otherMessagingShown) {
      await this.stateProvider.getUser(userId, SUPPRESSED_THIS_SESSION).update(() => true);
    }
    await this.stateProvider.getUser(userId, RELEASED_THIS_SESSION).update(() => true);
  }

  async dismissCoachmark(userId: UserId): Promise<void> {
    await this.nudgesService.updateNudgeStatus(NudgeType.NewItemTypesAnnouncement, userId, {
      hasSpotlightDismissed: true,
    });
  }

  async dismissBadges(userId: UserId): Promise<void> {
    await this.nudgesService.updateNudgeStatus(NudgeType.NewItemTypesAnnouncement, userId, {
      hasBadgeDismissed: true,
    });
  }
}

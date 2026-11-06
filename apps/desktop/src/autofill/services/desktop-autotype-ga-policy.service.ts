import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { distinctUntilChanged, map, shareReplay, switchMap, tap } from "rxjs/operators";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import {
  AutotypeGaPolicyData,
  AutotypeShortcutOption,
  isAutotypeGaShortcut,
} from "@bitwarden/common/desktop-native/models/autotype-ga-policy.data";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";

@Injectable({ providedIn: "root" })
export class DesktopAutotypeGaPolicyService {
  constructor(
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly policyService: PolicyService,
    private readonly configService: ConfigService,
  ) {}

  readonly autotypeGaDefaultSetting$: Observable<boolean | null> = this.whenGaAndUnlocked$(
    (userId) =>
      this.policyService.policyAppliesToUser$(PolicyType.AutotypeGaPolicy, userId).pipe(
        map((applies) => (applies ? true : null)),
        distinctUntilChanged(),
      ),
  );

  // Keeps the last shortcut while locked, so locking does not swap the shortcut back to the default.
  readonly autotypeGaDefaultKeyboardShortcut$: Observable<string[] | null> =
    this.whenGaAndUnlocked$(
      (userId) =>
        this.policyService
          .policiesByType$(PolicyType.AutotypeGaPolicy, userId)
          .pipe(map((policies) => this.shortcutFromPolicies(policies))),
      { keepLastWhileLocked: true, isSame: (a, b) => a?.join("+") === b?.join("+") },
    );

  /** Lowest organization id. Default and invalid shortcuts are skipped, so sync order does not matter. */
  private shortcutFromPolicies(policies: Policy[]): string[] | null {
    return (
      policies
        .filter((policy) => policy.enabled)
        .sort((a, b) => a.organizationId.localeCompare(b.organizationId))
        .map((policy) => this.shortcutFromPolicy(policy.data))
        .find((shortcut) => shortcut != null) ?? null
    );
  }

  private shortcutFromPolicy(data: Partial<AutotypeGaPolicyData> | undefined): string[] | null {
    const keys = data?.defaultKeyboardShortcut;
    return data?.shortcutOption === AutotypeShortcutOption.Custom && isAutotypeGaShortcut(keys)
      ? keys
      : null;
  }

  /** Null unless the GA flag is on and the active user is unlocked. `keepLastWhileLocked` repeats that user's last value across a lock, and drops it on logout or when the flag turns off. */
  private whenGaAndUnlocked$<T>(
    userPolicy$: (userId: UserId) => Observable<T | null>,
    {
      keepLastWhileLocked = false,
      isSame = (a: T | null, b: T | null) => a === b,
    }: { keepLastWhileLocked?: boolean; isSame?: (a: T | null, b: T | null) => boolean } = {},
  ): Observable<T | null> {
    let held: { userId: UserId; value: T | null } | null = null;

    const clearHeld$ = () => {
      held = null;
      return of(null);
    };

    const policyWhileUnlocked$ = (userId: UserId) =>
      userPolicy$(userId).pipe(
        tap((value) => {
          held = { userId, value };
        }),
      );

    const policyWhileLocked$ = (userId: UserId) => {
      if (keepLastWhileLocked && held != null && held.userId === userId) {
        return of(held.value);
      }

      return of(null);
    };

    const policyForUser$ = (userId: UserId) =>
      this.authService.authStatusFor$(userId).pipe(
        map((status) => status === AuthenticationStatus.Unlocked),
        distinctUntilChanged(),
        switchMap((unlocked) =>
          unlocked ? policyWhileUnlocked$(userId) : policyWhileLocked$(userId),
        ),
      );

    return autotypeFeatureFlagState$(this.configService).pipe(
      switchMap((autotypeFeatureFlagState) => {
        if (autotypeFeatureFlagState !== AutotypeFeatureFlagState.Ga) {
          return clearHeld$();
        }

        return this.accountService.activeAccount$.pipe(
          map((account) => account?.id ?? null),
          distinctUntilChanged(),
          switchMap((userId) => (userId == null ? clearHeld$() : policyForUser$(userId))),
        );
      }),
      distinctUntilChanged(isSame),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}

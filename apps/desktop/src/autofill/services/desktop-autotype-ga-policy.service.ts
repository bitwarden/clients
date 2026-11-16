import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import { distinctUntilChanged, filter, map, shareReplay, switchMap } from "rxjs/operators";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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

  // The custom shortcut from the Autotype GA policy, or null when there is none.
  readonly autotypeGaDefaultKeyboardShortcut$: Observable<string[] | null> =
    this.whenGaAndUnlocked$((userId) =>
      this.policyService.policiesByType$(PolicyType.AutotypeGaPolicy, userId).pipe(
        map((policies) => this.shortcutFromPolicies(policies)),
        distinctUntilChanged((a, b) => a?.join("+") === b?.join("+")),
      ),
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

  /** Emits the active user's policy value while the GA flag is on and the vault is unlocked, otherwise null. */
  private whenGaAndUnlocked$<T>(
    userPolicy$: (userId: UserId) => Observable<T | null>,
  ): Observable<T | null> {
    return autotypeFeatureFlagState$(this.configService).pipe(
      switchMap((autotypeFeatureFlagState) => {
        if (autotypeFeatureFlagState !== AutotypeFeatureFlagState.Ga) {
          return of(null);
        }

        return this.accountService.activeAccount$.pipe(
          filter((account) => account != null && account.id != null),
          getUserId,
          distinctUntilChanged(),
          switchMap((userId) => {
            const isUnlocked$ = this.authService.authStatusFor$(userId).pipe(
              map((status) => status === AuthenticationStatus.Unlocked),
              distinctUntilChanged(),
            );

            return isUnlocked$.pipe(
              switchMap((unlocked) => (unlocked ? userPolicy$(userId) : of(null))),
            );
          }),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}

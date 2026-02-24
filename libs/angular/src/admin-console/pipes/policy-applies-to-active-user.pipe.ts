import { Pipe, PipeTransform, inject } from "@angular/core";
import { Observable, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * Pipe that returns an Observable<boolean> indicating whether the given policy
 * applies to the active user. Chain with the async pipe to consume in templates.
 *
 * Accepts a policy type name string (keyof typeof PolicyType) to avoid
 * exposing PolicyType in the template.
 *
 * @example
 * ```html
 * @if ("DisableSend" | policyAppliesToActiveUser$ | async) {
 *   <p>Send is disabled by policy.</p>
 * }
 * ```
 */
@Pipe({
  name: "policyAppliesToActiveUser$",
  standalone: true,
})
export class PolicyAppliesToActiveUserPipe implements PipeTransform {
  private policyService = inject(PolicyService);
  private accountService = inject(AccountService);

  transform(policyType: keyof typeof PolicyType): Observable<boolean> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policyAppliesToUser$(PolicyType[policyType], userId),
      ),
    );
  }
}

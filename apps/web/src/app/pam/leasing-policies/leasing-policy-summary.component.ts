import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LeasingPolicy } from "@bitwarden/pam";

@Component({
  selector: "pam-leasing-policy-summary",
  templateUrl: "./leasing-policy-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeasingPolicySummaryComponent {
  private readonly i18nService = inject(I18nService);

  readonly policy = input.required<LeasingPolicy>();

  protected readonly summary = computed(() => this.summarize(this.policy()));

  private summarize(policy: LeasingPolicy): string {
    switch (policy.kind) {
      case "human_approval":
        return this.i18nService.t("pamLeasingPolicySummaryHumanApproval");
      case "ip_allowlist":
        return this.i18nService.t(
          "pamLeasingPolicySummaryIpAllowlist",
          String(policy.cidrs.length),
        );
      case "time_of_day":
        return this.i18nService.t(
          "pamLeasingPolicySummaryTimeOfDay",
          String(policy.windows.length),
          policy.tz,
        );
      case "all_of":
        return this.i18nService.t("pamLeasingPolicySummaryAllOf", String(policy.policies.length));
    }
  }
}

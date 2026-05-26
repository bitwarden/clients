import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AccessRule } from "@bitwarden/pam";

@Component({
  selector: "pam-access-rule-summary",
  templateUrl: "./access-rule-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRuleSummaryComponent {
  private readonly i18nService = inject(I18nService);

  readonly rule = input.required<AccessRule>();

  protected readonly summary = computed(() => this.summarize(this.rule()));

  private summarize(rule: AccessRule): string {
    switch (rule.kind) {
      case "human_approval":
        return this.i18nService.t("pamAccessRuleSummaryHumanApproval");
      case "ip_allowlist":
        return this.i18nService.t("pamAccessRuleSummaryIpAllowlist", String(rule.cidrs.length));
      case "time_of_day":
        return this.i18nService.t(
          "pamAccessRuleSummaryTimeOfDay",
          String(rule.windows.length),
          rule.tz,
        );
      case "all_of":
        return this.i18nService.t("pamAccessRuleSummaryAllOf", String(rule.rules.length));
    }
  }
}

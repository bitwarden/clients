import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Condition } from "@bitwarden/pam";

@Component({
  selector: "pam-access-rule-summary",
  templateUrl: "./access-rule-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRuleSummaryComponent {
  private readonly i18nService = inject(I18nService);

  readonly conditions = input.required<Condition[]>();
  readonly singleActiveLease = input<boolean>(false);

  protected readonly summary = computed(() =>
    this.summarize(this.conditions(), this.singleActiveLease()),
  );

  private summarize(conditions: Condition[], singleActiveLease: boolean): string {
    const parts = conditions.map((c) => this.summarizeOne(c));
    if (singleActiveLease) {
      parts.push(this.i18nService.t("pamAccessRuleSummarySingleActiveLease"));
    }
    if (parts.length === 0) {
      return this.i18nService.t("pamAccessRuleSummaryNoConditions");
    }
    return parts.join(" + ");
  }

  private summarizeOne(condition: Condition): string {
    switch (condition.kind) {
      case "human_approval":
        return this.i18nService.t("pamAccessRuleSummaryHumanApproval");
      case "ip_allowlist":
        return this.i18nService.t("pamAccessRuleSummaryIpAllowlist");
    }
  }
}

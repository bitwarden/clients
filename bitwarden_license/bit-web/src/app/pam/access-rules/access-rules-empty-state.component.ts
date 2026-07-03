import { ChangeDetectionStrategy, Component, output } from "@angular/core";
import { RouterLink } from "@angular/router";

import {
  BitwardenIcon,
  ButtonModule,
  CardComponent,
  IconTileComponent,
  ItemModule,
  LinkModule,
  NoItemsModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NoAccessRulesIcon } from "./no-access-rules.icon";

/** The starter templates offered on the empty state. The parent maps each key to a dialog prefill. */
export type AccessRuleTemplateKey = "just-in-time" | "approval-required" | "ip-restricted";

type AccessRuleTemplate = {
  key: AccessRuleTemplateKey;
  icon: BitwardenIcon;
  titleKey: string;
  summaryKey: string;
};

const TEMPLATES: AccessRuleTemplate[] = [
  {
    key: "just-in-time",
    icon: "bwi-clock",
    titleKey: "pamTemplateJustInTimeTitle",
    summaryKey: "pamTemplateJustInTimeSummary",
  },
  {
    key: "approval-required",
    icon: "bwi-check-circle",
    titleKey: "pamTemplateApprovalRequiredTitle",
    summaryKey: "pamTemplateApprovalRequiredSummary",
  },
  {
    key: "ip-restricted",
    icon: "bwi-wireless",
    titleKey: "pamTemplateIpRestrictedTitle",
    summaryKey: "pamTemplateIpRestrictedSummary",
  },
];

/**
 * Empty state shown on the access-rules page when an organization has no rules yet: a hero
 * prompt to create a custom rule, a list of starter templates, and an audit-log footnote.
 * Emits {@link create} for the custom-rule action and {@link useTemplate} with the chosen
 * template key; the parent owns opening the dialog (and any prefill).
 */
@Component({
  selector: "pam-access-rules-empty-state",
  templateUrl: "./access-rules-empty-state.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TypographyModule,
    ButtonModule,
    CardComponent,
    IconTileComponent,
    ItemModule,
    LinkModule,
    NoItemsModule,
    RouterLink,
    I18nPipe,
  ],
  host: {
    class: "tw-block",
  },
})
export class AccessRulesEmptyStateComponent {
  readonly create = output<void>();
  readonly useTemplate = output<AccessRuleTemplateKey>();

  protected readonly templates = TEMPLATES;
  protected readonly noItemsIcon = NoAccessRulesIcon;
}

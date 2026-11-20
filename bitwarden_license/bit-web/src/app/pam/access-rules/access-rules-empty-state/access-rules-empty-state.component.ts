import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import {
  ButtonModule,
  CardComponent,
  IconTileComponent,
  ItemModule,
  StatusLockupComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ACCESS_RULE_TEMPLATES, AccessRuleTemplateKey } from "../access-rule-templates";

/** Shown when an organization has no rules; the parent opens the create page for either output. */
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
    StatusLockupComponent,
    I18nPipe,
  ],
  host: {
    class: "tw-block",
  },
})
export class AccessRulesEmptyStateComponent {
  readonly create = output<void>();
  readonly useTemplate = output<AccessRuleTemplateKey>();

  protected readonly templates = ACCESS_RULE_TEMPLATES;
}

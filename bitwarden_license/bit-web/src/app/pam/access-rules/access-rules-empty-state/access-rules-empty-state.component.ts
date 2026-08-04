import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import {
  ButtonModule,
  CardComponent,
  IconTileComponent,
  ItemModule,
  NoItemsModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ACCESS_RULE_TEMPLATES, AccessRuleTemplateKey } from "../access-rule-templates";
import { NoAccessRulesIcon } from "../no-access-rules.icon";

/**
 * Empty state shown on the access-rules page when an organization has no rules yet: a hero
 * prompt to create a custom rule, and a list of starter templates.
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
    NoItemsModule,
    I18nPipe,
  ],
  host: {
    class: "tw-block",
  },
})
export class AccessRulesEmptyStateComponent {
  /** Emitted when the user chooses to build a custom rule from scratch. */
  readonly create = output<void>();
  /** Emitted with the chosen starter template's key when the user picks one. */
  readonly useTemplate = output<AccessRuleTemplateKey>();

  protected readonly templates = ACCESS_RULE_TEMPLATES;
  protected readonly noItemsIcon = NoAccessRulesIcon;
}

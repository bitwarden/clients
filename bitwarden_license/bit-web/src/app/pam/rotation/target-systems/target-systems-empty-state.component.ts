import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import {
  BitwardenIcon,
  ButtonModule,
  CardComponent,
  IconTileComponent,
  ItemModule,
  NoItemsModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Starter templates offered on the empty state; the parent maps each key to a create-form prefill. */
export type TargetSystemTemplateKey = "manual" | "entra" | "custom-script";

type TargetSystemTemplate = {
  key: TargetSystemTemplateKey;
  icon: BitwardenIcon;
  titleKey: string;
  summaryKey: string;
};

const TEMPLATES: TargetSystemTemplate[] = [
  {
    key: "manual",
    icon: "bwi-pencil-square",
    titleKey: "pamTargetSystemMethodManual",
    summaryKey: "pamTargetSystemTemplateManualSummary",
  },
  {
    key: "entra",
    icon: "bwi-globe",
    titleKey: "pamTargetSystemKindEntra",
    summaryKey: "pamTargetSystemTemplateEntraSummary",
  },
  {
    key: "custom-script",
    icon: "bwi-terminal",
    titleKey: "pamTargetSystemKindCustomScript",
    summaryKey: "pamTargetSystemTemplateCustomScriptSummary",
  },
];

/**
 * Empty state shown on the target-systems tab when an organization has no target systems yet:
 * a hero prompt to create one from scratch, plus a list of starter templates. Emits {@link create}
 * for the custom action and {@link useTemplate} with the chosen template key; the parent owns
 * navigation (and any create-form prefill). Mirrors the access-rules empty state.
 */
@Component({
  selector: "pam-target-systems-empty-state",
  templateUrl: "./target-systems-empty-state.component.html",
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
export class TargetSystemsEmptyStateComponent {
  readonly create = output<void>();
  readonly useTemplate = output<TargetSystemTemplateKey>();

  protected readonly templates = TEMPLATES;
}

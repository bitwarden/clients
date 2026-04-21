import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  inject,
  input,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";
import { IconTileComponent } from "../icon-tile";
import { BitwardenIcon } from "../shared/icon";
import { TypographyDirective } from "../typography/typography.directive";

import { FormControlBaseDirective } from "./form-control-base.directive";
import { FormControlGroupComponent } from "./form-control-group.component";
import { BitHintDirective } from "./hint.directive";

@Component({
  selector: "bit-form-control-card",
  templateUrl: "form-control-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: FormControlBaseDirective,
      inputs: ["label", "inline"],
    },
  ],
  host: {
    class: "[&_bit-hint]:tw-leading-4 [&_bit-hint]:tw-mt-0",
  },
  imports: [TypographyDirective, I18nPipe, IconTileComponent, IconComponent],
})
export class FormControlCardComponent {
  protected readonly icon = input<BitwardenIcon>();
  protected readonly base = inject(FormControlBaseDirective);
  readonly group = inject(FormControlGroupComponent, { optional: true });

  readonly labelId = `${this.base.id}-label`;
  readonly errorId = `${this.base.id}-error`;

  protected readonly hint = contentChild(BitHintDirective);

  /** The error ID that child inputs should reference in aria-describedby. */
  get effectiveErrorId(): string {
    return this.group?.errorId ?? this.errorId;
  }

  /** The hint ID that child inputs should reference in aria-describedby. */
  readonly effectiveHintId = computed(() =>
    this.group ? (this.group.hint()?.id ?? null) : (this.hint()?.id ?? null),
  );

  constructor() {
    this.base.disableMarginSignal.set(true);
  }
}

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
import { BitLabelComponent } from "./label.component";

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
    // tw-min-w-0 lets the card shrink below its content's intrinsic min-width as a grid item,
    // so long labels truncate instead of widening the card past its track.
    class: "tw-block tw-min-w-0 [&_bit-hint]:tw-leading-4 [&_bit-hint]:tw-mt-0",
  },
  imports: [TypographyDirective, I18nPipe, IconTileComponent, IconComponent],
})
export class FormControlCardComponent {
  protected readonly icon = input<BitwardenIcon>();

  /** Native tooltip text for the card. Defaults to the projected label's text. */
  readonly title = input<string>();

  protected readonly base = inject(FormControlBaseDirective);
  readonly group = inject(FormControlGroupComponent, { optional: true });

  readonly labelId = `${this.base.id}-label`;
  readonly errorId = `${this.base.id}-error`;

  protected readonly hint = contentChild(BitHintDirective);
  protected readonly label = contentChild(BitLabelComponent);

  // A getter, not a computed: BitLabelComponent.title reads live textContent, which a computed
  // would cache on first read.
  protected get titleText(): string | null {
    return this.title() ?? this.label()?.title ?? null;
  }

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

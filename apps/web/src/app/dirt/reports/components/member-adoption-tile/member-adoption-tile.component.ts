import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import {
  A11yTitleDirective,
  CardComponent,
  LinkModule,
  PopoverModule,
  SkeletonComponent,
  TypographyModule,
} from "@bitwarden/components";

/**
 * A metric tile: a label, one large pre-formatted metric with an optional unit, and a sublabel.
 *
 * Every input is an already-translated display string; the tile does no i18n and no formatting.
 */
@Component({
  selector: "dirt-member-adoption-tile",
  templateUrl: "./member-adoption-tile.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yTitleDirective,
    CardComponent,
    LinkModule,
    PopoverModule,
    SkeletonComponent,
    TypographyModule,
  ],
  host: {
    class: "tw-block",
  },
})
export class MemberAdoptionTileComponent {
  readonly label = input.required<string>();

  /** Blank or whitespace renders a muted placeholder and suppresses the unit. */
  readonly value = input.required<string>();

  readonly unit = input<string>();

  readonly sublabel = input<string>();

  /**
   * Heading of the info popover, and the trigger's accessible name, so it must stand on its own.
   * The affordance renders only when both `infoTitle` and `infoBody` are supplied.
   */
  readonly infoTitle = input<string>();

  /** Body of the info popover. */
  readonly infoBody = input<string>();

  readonly loading = input(false);

  /** Locale-neutral: this component does no i18n. */
  protected readonly emptyValuePlaceholder = "-";

  protected readonly infoTitleText = computed(() => (this.infoTitle() ?? "").trim());

  protected readonly infoBodyText = computed(() => (this.infoBody() ?? "").trim());

  protected readonly hasInfo = computed(
    () => this.infoTitleText().length > 0 && this.infoBodyText().length > 0,
  );

  protected readonly hasValue = computed(() => this.value().trim().length > 0);

  protected readonly showUnit = computed(
    () => !!this.unit() && (this.loading() || this.hasValue()),
  );
}

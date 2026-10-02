import { ChangeDetectionStrategy, Component, ElementRef, computed, input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../button";
import { LinkModule } from "../link";
import { PopoverModule } from "../popover";
import { TypographyModule } from "../typography";

import { CoachmarkTour } from "./coachmark-tour";

/**
 * One step of a {@link CoachmarkTour}: a spotlit popover on `anchor`, with the standard step
 * indicator and Back / Next / Close footer. Shows while its step is active.
 *
 * @example
 * ```html
 * <bit-table-toolbar #toolbar>…</bit-table-toolbar>
 * <bit-coachmark [tour]="tour" step="filters" [anchor]="toolbar.filtersAnchor()" [title]="'filters' | i18n">
 *   {{ "filtersCoachmarkDescription" | i18n }}
 * </bit-coachmark>
 * ```
 */
@Component({
  selector: "bit-coachmark",
  templateUrl: "./coachmark.component.html",
  imports: [ButtonModule, I18nPipe, LinkModule, PopoverModule, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The popover renders in an overlay; an empty host would still take a flex/grid gap
  host: { class: "tw-hidden" },
})
export class CoachmarkComponent {
  readonly tour = input.required<CoachmarkTour>();
  /** The id of the tour step this coachmark shows for. */
  readonly step = input.required<string>();
  /** The element to spotlight. `undefined` while it hasn't rendered; the step waits for it. */
  readonly anchor = input.required<HTMLElement | ElementRef<HTMLElement> | undefined>();
  readonly title = input.required<string>();
  readonly learnMoreUrl = input<string>();

  protected readonly active = computed(() => this.tour().isActive(this.step()));

  /** The popover closed on its own (its close button, or its anchor went away). */
  protected onOpenChange(open: boolean): void {
    if (!open && this.active()) {
      this.tour().end();
    }
  }
}

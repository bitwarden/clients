import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../button";
import { LinkModule } from "../link";
import { PopoverComponent, PopoverModule, PopoverService } from "../popover";
import { TypographyModule } from "../typography";

import { CoachmarkTourService } from "./coachmark-tour.service";

/**
 * One step of the nearest {@link CoachmarkTourService}: a spotlit popover on the step's anchor,
 * with the standard step indicator and Back / Next / Close footer. Shows while its step is active.
 *
 * @example
 * ```html
 * <bit-coachmark step="filters" [title]="'filters' | i18n">
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
  /** The id of the tour step this coachmark shows for. */
  readonly step = input.required<string>();
  readonly title = input.required<string>();
  readonly learnMoreUrl = input<string>();

  protected readonly tour = inject(CoachmarkTourService);
  private readonly popoverService = inject(PopoverService);
  private readonly popover = viewChild.required(PopoverComponent);

  private readonly active = computed(() => this.tour.isActive(this.step()));

  constructor() {
    effect((onCleanup) => {
      if (!this.active()) {
        return;
      }
      const ref = untracked(() => {
        const { anchor, position } = this.tour.activeStep();
        return this.popoverService.open(this.popover(), anchor, { position, spotlight: true });
      });
      onCleanup(() => ref.close());
    });
  }
}

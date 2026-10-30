import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from "@angular/core";

import { BitTableToolbarComponent, PopoverService } from "@bitwarden/components";
import { CoachmarkComponent, CoachmarkService } from "@bitwarden/vault";

import { VaultPopupTourService } from "../../../services/vault-popup-tour.service";

/**
 * The vault tour's filter steps: the toolbar's filter button, then the filter dialog row
 * {@link VaultPopupTourService} picked when it started the tour. Both live in the toolbar's own
 * template, so the popovers open from code rather than from `[bitPopoverAnchorFor]`.
 */
@Component({
  selector: "app-vault-filters-tour",
  templateUrl: "vault-filters-tour.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoachmarkComponent],
})
export class VaultFiltersTourComponent {
  private readonly coachmarkService = inject(CoachmarkService);
  private readonly vaultTourService = inject(VaultPopupTourService);
  private readonly popoverService = inject(PopoverService);

  /** The toolbar whose filter button and filter dialog rows the steps anchor to. */
  readonly toolbar = input.required<BitTableToolbarComponent>();

  private readonly filtersCoachmark = viewChild.required<CoachmarkComponent>("filtersCoachmark");
  private readonly sharedFoldersCoachmark =
    viewChild.required<CoachmarkComponent>("sharedFoldersCoachmark");

  /** Whether the tour opened the filter dialog for its shared folders step and it's still up. */
  private readonly tourOpenedFilterDialog = signal(false);

  private readonly showCoachmarks = effect((onCleanup) => {
    const toolbar = this.toolbar();

    if (this.coachmarkService.isStepActive("filters")) {
      const ref = this.popoverService.open(
        this.filtersCoachmark().popover(),
        toolbar.filterButton,
        {
          position: this.coachmarkService.getStepPosition("filters"),
          spotlight: true,
        },
      );
      onCleanup(() => ref.close());
      return;
    }

    // The tour drops this step when it has no row to point at.
    const rowKey = untracked(() => this.vaultTourService.sharedFoldersRow());
    if (this.coachmarkService.isStepActive("sharedFolders") && rowKey) {
      untracked(() => {
        this.vaultTourService.filterDialogOpen.set(true);
        this.tourOpenedFilterDialog.set(true);
      });
      const ref = this.popoverService.open(
        this.sharedFoldersCoachmark().popover(),
        toolbar.filterRow(rowKey),
        {
          position: this.coachmarkService.getStepPosition("sharedFolders"),
          spotlight: true,
        },
      );
      onCleanup(() => {
        ref.close();
        // Cleared before the dialog closes, so moving off the step doesn't read as the user closing it.
        this.tourOpenedFilterDialog.set(false);
        this.vaultTourService.filterDialogOpen.set(false);
      });
    }
  });

  /** Closing the dialog takes the shared folders step's anchor with it, so it ends the tour. */
  private readonly endTourOnFilterDialogClose = effect(() => {
    if (this.tourOpenedFilterDialog() && !this.vaultTourService.filterDialogOpen()) {
      untracked(() => {
        this.tourOpenedFilterDialog.set(false);
        void this.coachmarkService.completeTour();
      });
    }
  });
}

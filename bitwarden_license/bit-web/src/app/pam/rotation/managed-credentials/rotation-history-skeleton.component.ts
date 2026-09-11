import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { SkeletonComponent, SkeletonTextComponent, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Placeholder for {@link RotationHistoryComponent}'s table. Carries the same columns and the same
 * table chrome, so the history that lands under it does not shift the page.
 *
 * The whole placeholder is hidden from assistive technology, per the component library: a screen
 * reader would otherwise meet a table of empty cells. {@link RotationLoadingAnnouncerComponent}
 * carries the announcement instead.
 */
@Component({
  selector: "app-rotation-history-skeleton",
  templateUrl: "./rotation-history-skeleton.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SkeletonComponent, SkeletonTextComponent, TableModule, I18nPipe],
})
export class RotationHistorySkeletonComponent {
  /** Whether the credential column is present, matching the history table's own input. */
  readonly showCredential = input(false);

  /** Four rows, one width each. */
  protected readonly rows = ["tw-w-24", "tw-w-20", "tw-w-24", "tw-w-16"];
}

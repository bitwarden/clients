import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { SkeletonComponent, SkeletonTextComponent, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Placeholder for {@link RotationHistoryComponent}'s table, with the same columns so the page
 * doesn't shift. Hidden from assistive technology; {@link RotationLoadingAnnouncerComponent}
 * announces instead.
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

  protected readonly rows = ["tw-w-24", "tw-w-20", "tw-w-24", "tw-w-16"];
}

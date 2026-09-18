import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  Signal,
} from "@angular/core";

import { BitSvg, SearchFolder, VaultIcon } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

interface EmptyFoldersProperties {
  key: EMPTY_FOLDERS_STATE;
  icon: BitSvg;
  title: string;
  description?: string;
}

const EMPTY_FOLDERS_STATE = {
  noSearchMatches: "noSearchMatches",
  emptyFolders: "emptyFolders",
} as const;
type EMPTY_FOLDERS_STATE = (typeof EMPTY_FOLDERS_STATE)[keyof typeof EMPTY_FOLDERS_STATE];

/**
 * The empty state shown by the folders table when there are no rows to display — either because
 * no folders exist yet, or because the active search excludes every folder.
 *
 * Purely presentational: the host supplies the folder count and current search term as inputs,
 * and clearing the search is delegated back to the host as an output.
 */
@Component({
  selector: "vault-empty-folders",
  templateUrl: "./empty-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, StatusLockupComponent, SvgComponent, I18nPipe],
})
export class EmptyFoldersComponent {
  private readonly i18nService = inject(I18nService);

  /** Whether any folders exist at all, ignoring the current search term. */
  readonly hasItems = input.required<boolean>();

  /** The current search term, if any. */
  readonly search = input<string | undefined>();

  /** Emitted when the user asks to clear the active search term. */
  readonly clearSearch = output<void>();

  protected readonly EMPTY_FOLDERS_STATE = EMPTY_FOLDERS_STATE;

  protected readonly emptyStateProperties: Signal<EmptyFoldersProperties | null> = computed(() => {
    const state = this.emptyFoldersState();

    if (!state) {
      return null;
    }

    switch (state) {
      case EMPTY_FOLDERS_STATE.noSearchMatches:
        return {
          key: EMPTY_FOLDERS_STATE.noSearchMatches,
          icon: SearchFolder,
          title: this.i18nService.t("noItemsMatchSearchTerm", this.search()),
        };
      case EMPTY_FOLDERS_STATE.emptyFolders:
        return {
          key: EMPTY_FOLDERS_STATE.emptyFolders,
          icon: VaultIcon,
          title: this.i18nService.t("youHaveNoFolders"),
          description: this.i18nService.t("emptyFoldersDescription"),
        };
    }
  });

  private readonly emptyFoldersState: Signal<EMPTY_FOLDERS_STATE | null> = computed(() => {
    if (this.hasItems() && this.search()) {
      return EMPTY_FOLDERS_STATE.noSearchMatches;
    }
    if (!this.hasItems()) {
      return EMPTY_FOLDERS_STATE.emptyFolders;
    }
    return null;
  });
}

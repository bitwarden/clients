import { Component, input, computed, output } from "@angular/core";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { IconButtonModule, NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultFilter, FolderFilter } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-folder-filter",
  templateUrl: "folder-filter.component.html",
  imports: [A11yTitleDirective, NavigationModule, IconButtonModule, I18nPipe],
})
export class FolderFilterComponent {
  protected readonly folder = input<TreeNode<FolderFilter>>();
  protected readonly activeFilter = input<VaultFilter>();
  protected onEditFolder = output<FolderFilter>();

  protected readonly displayName = computed<string>(() => {
    return this.folder().node.name;
  });

  protected readonly isActive = computed<boolean>(() => {
    return (
      this.folder().node.id === this.activeFilter()?.folderId &&
      !!this.activeFilter()?.selectedFolderNode
    );
  });

  protected applyFilter(event: Event) {
    event.stopPropagation();
    const filter = this.activeFilter();

    if (filter) {
      filter.selectedFolderNode = this.folder();
    }
  }

  protected editFolder(folder: FolderFilter) {
    this.onEditFolder.emit(folder);
  }
}

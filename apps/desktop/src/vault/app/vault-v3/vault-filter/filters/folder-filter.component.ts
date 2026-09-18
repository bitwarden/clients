import { Component, input, computed, output, inject } from "@angular/core";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { IconButtonModule, NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultFilter, FolderFilter } from "@bitwarden/vault";

import { PersistedVaultFilterExpansionService } from "../services/persisted-vault-filter-expansion.service";
import { settledAfterRender } from "../services/settled-after-render";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-folder-filter",
  templateUrl: "folder-filter.component.html",
  imports: [A11yTitleDirective, NavigationModule, IconButtonModule, I18nPipe],
})
export class FolderFilterComponent {
  private collapseService = inject(PersistedVaultFilterExpansionService);
  private settled = settledAfterRender();

  protected readonly folder = input.required<TreeNode<FolderFilter>>();
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

  protected readonly isOpen = computed<boolean>(() => {
    return this.collapseService.isOpen(this.folder().node.id);
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

  protected onOpenChange(open: boolean) {
    if (!this.settled()) {
      return;
    }
    void this.collapseService.setOpen(this.folder().node.id, open);
  }
}

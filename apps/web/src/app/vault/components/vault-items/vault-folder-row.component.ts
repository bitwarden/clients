// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultFolderRow]",
  templateUrl: "vault-folder-row.component.html",
  standalone: false,
})
export class VaultFolderRowComponent<C extends CipherViewLike> {
  protected RowHeightClass = RowHeightClass;

  @Input() disabled: boolean;
  @Input() folder: FolderView;
  @Input() showOwner: boolean;
  @Input() showCollections: boolean;
  @Input() showGroups: boolean;
  @Input() canEditFolder: boolean;
  @Input() canDeleteFolder: boolean;
  @Input() showPermissionsColumn: boolean;

  @Output() onEvent = new EventEmitter<VaultItemEvent<C>>();

  @Input() checked: boolean;
  @Output() checkedToggled = new EventEmitter<void>();

  constructor(private i18nService: I18nService) {}

  get folderDisplayName() {
    // For nested folders, show only the last part of the path
    const parts = this.folder.name.split("/");
    return parts[parts.length - 1];
  }

  get folderPath() {
    const parts = this.folder.name.split("/");
    if (parts.length <= 1) {
      return "";
    }

    // Return parent path for tooltip
    return parts.slice(0, -1).join(" > ");
  }

  protected editFolder() {
    this.onEvent.next({ type: "editFolder", item: this.folder });
  }

  protected deleteFolder() {
    this.onEvent.next({ type: "delete", items: [{ folder: this.folder }] });
  }
}

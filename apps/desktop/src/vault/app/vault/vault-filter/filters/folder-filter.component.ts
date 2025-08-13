import { Component } from "@angular/core";

import { FolderFilterComponent as BaseFolderFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/folder-filter.component";

@Component({
  selector: "app-folder-filter",
  templateUrl: "folder-filter.component.html",
  standalone: false,
})
export class FolderFilterComponent extends BaseFolderFilterComponent {}

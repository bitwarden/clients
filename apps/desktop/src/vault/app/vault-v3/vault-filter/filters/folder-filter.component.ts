import { Component } from "@angular/core";

import { FolderFilterComponent as BaseFolderFilterComponent } from "@bitwarden/angular/vault/vault-filter/components/folder-filter.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-folder-filter",
  templateUrl: "folder-filter.component.html",
  standalone: false,
})
export class FolderFilterComponent extends BaseFolderFilterComponent {}

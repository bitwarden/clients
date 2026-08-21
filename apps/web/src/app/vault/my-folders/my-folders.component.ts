import { ChangeDetectionStrategy, Component } from "@angular/core";

import { MyFoldersComponent as VaultMyFoldersComponent } from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";

@Component({
  templateUrl: "./my-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderModule, VaultMyFoldersComponent],
})
export class MyFoldersComponent {}

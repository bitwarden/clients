import { ChangeDetectionStrategy, Component } from "@angular/core";

import { MyFoldersComponent as VaultMyFoldersComponent } from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header";

@Component({
  templateUrl: "./my-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Desktop pages own their page padding; matches the vault page's spacing.
    class: "tw-block tw-px-8 tw-py-6",
  },
  imports: [DesktopHeaderComponent, VaultMyFoldersComponent],
})
export class MyFoldersComponent {}

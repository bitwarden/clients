import { ChangeDetectionStrategy, Component } from "@angular/core";

import {
  MyFoldersComponent as VaultMyFoldersComponent,
  VaultOrganizationUserNotificationsComponent,
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../../app/layout/header";

@Component({
  templateUrl: "./my-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Unpadded so the banner can span the full content width; the gutters sit on the content
    // below it instead. Matches the vault page.
    class: "tw-block",
  },
  imports: [
    DesktopHeaderComponent,
    VaultMyFoldersComponent,
    VaultOrganizationUserNotificationsComponent,
  ],
})
export class MyFoldersComponent {}

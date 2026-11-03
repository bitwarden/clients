import { ChangeDetectionStrategy, Component } from "@angular/core";

import {
  MyFoldersComponent as VaultMyFoldersComponent,
  VaultOrganizationUserNotificationsComponent,
} from "@bitwarden/vault";

import { HeaderModule } from "../../layouts/header/header.module";

@Component({
  templateUrl: "./my-folders.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-h-full tw-min-h-0",
  },
  imports: [HeaderModule, VaultMyFoldersComponent, VaultOrganizationUserNotificationsComponent],
})
export class MyFoldersComponent {}

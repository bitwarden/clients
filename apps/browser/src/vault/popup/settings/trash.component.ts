import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CalloutModule, NoItemsModule } from "@bitwarden/components";
import { VaultIcons } from "@bitwarden/vault";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { VaultPopupItemsService } from "../services/vault-popup-items.service";

import { TrashListItemsContainerComponent } from "./trash-list-items-container/trash-list-items-container.component";

@Component({
  templateUrl: "trash.component.html",
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    TrashListItemsContainerComponent,
    CalloutModule,
    NoItemsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrashComponent {
  protected deletedCiphers$ = this.vaultPopupItemsService.deletedCiphers$;

  protected emptyTrashIcon = VaultIcons.EmptyTrash;

  constructor(private vaultPopupItemsService: VaultPopupItemsService) {}
}

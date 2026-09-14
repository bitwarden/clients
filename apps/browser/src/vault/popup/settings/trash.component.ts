import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EmptyTrash } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CalloutModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { EmptyVaultComponent, VaultScope, VaultScopeType } from "@bitwarden/vault";

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
    EmptyVaultComponent,
    StatusLockupComponent,
    SvgComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrashComponent {
  protected readonly deletedCiphers$ = this.vaultPopupItemsService.deletedCiphers$;

  /** Legacy (flag-off) empty-trash icon — see {@link vfo1Enabled}. */
  protected readonly emptyTrashIcon = EmptyTrash;

  protected readonly trashScope: VaultScope = { type: VaultScopeType.Trash };

  /** When enabled, the empty-trash state renders via the shared `EmptyVaultComponent`. */
  protected readonly vfo1Enabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  constructor(private readonly vaultPopupItemsService: VaultPopupItemsService) {}
}

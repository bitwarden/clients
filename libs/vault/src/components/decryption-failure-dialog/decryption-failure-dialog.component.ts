import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { CipherId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  ButtonModule,
  CopyClickDirective,
  DialogModule,
  DialogService,
  CenterPositionStrategy,
  IconModule,
  isAtOrLargerThanBreakpointSignal,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type DecryptionFailureDialogParams = {
  cipherIds: CipherId[];
};

// Increments for each instance of this component, used to associate the item id list with its label
let nextId = 0;

@Component({
  selector: "vault-decryption-failure-dialog",
  templateUrl: "./decryption-failure-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, I18nPipe, NgTemplateOutlet, ButtonModule, CopyClickDirective, IconModule],
})
export class DecryptionFailureDialogComponent {
  protected readonly dialogRef = inject(DialogRef);
  protected readonly params = inject<DecryptionFailureDialogParams>(DIALOG_DATA);

  protected readonly labelId = `decryption-failure-item-ids-${nextId++}`;

  /**
   * Narrow viewports get the centered `bit-simple-dialog` treatment; wider ones get a standard
   * `bit-dialog`.
   */
  protected readonly isWideViewport = isAtOrLargerThanBreakpointSignal("md");

  private get isSingleItem() {
    return this.params.cipherIds.length === 1;
  }

  protected get descriptionKey() {
    return this.isSingleItem ? "couldNotDecryptVaultItem" : "couldNotDecryptVaultItems";
  }

  protected get labelKey() {
    return this.isSingleItem ? "itemId" : "itemIds";
  }

  protected get copyButtonKey() {
    return this.isSingleItem ? "copyId" : "copyAllIds";
  }

  protected get valueToCopy() {
    return this.params.cipherIds.join("\n");
  }

  static open(dialogService: DialogService, params: DecryptionFailureDialogParams) {
    return dialogService.open(DecryptionFailureDialogComponent, {
      data: params,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}

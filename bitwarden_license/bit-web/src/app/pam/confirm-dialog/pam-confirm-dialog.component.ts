import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  Translation,
} from "@bitwarden/components";

export type PamConfirmDialogParams = {
  title: Translation;
  content: Translation;
  acceptButtonText: Translation;
  cancelButtonText: Translation;
  /** `bwi-*` class of the centred glyph. */
  icon: string;
  /** Tailwind text colour for that glyph, chosen independently of `acceptButtonType`. */
  iconClass: string;
  acceptButtonType: "primary" | "danger";
};

/**
 * A yes/no confirmation that resolves to a boolean, matching `openSimpleDialog`'s contract.
 *
 * It exists because `openSimpleDialog` derives the glyph, the glyph's colour AND the accept
 * button's variant from a single `type` field, so a red glyph above a blue accept button is
 * inexpressible through it. Authoring `<bit-simple-dialog>` directly hands those three back to
 * the caller as separate params.
 */
@Component({
  selector: "pam-confirm-dialog",
  templateUrl: "./pam-confirm-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule],
})
export class PamConfirmDialogComponent {
  private readonly i18nService = inject(I18nService);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly params = inject<PamConfirmDialogParams>(DIALOG_DATA);

  protected readonly title = this.translate(this.params.title);
  protected readonly content = this.translate(this.params.content);
  protected readonly acceptButtonText = this.translate(this.params.acceptButtonText);
  protected readonly cancelButtonText = this.translate(this.params.cancelButtonText);

  protected readonly iconClasses = ["bwi", this.params.icon, this.params.iconClass];

  private translate(translation: Translation): string {
    return this.i18nService.t(translation.key, ...(translation.placeholders ?? []));
  }

  /**
   * Resolves `false` for every way out that is not the accept button — Escape and the backdrop
   * included — which is the same collapse `openSimpleDialog` applies, so call sites keep reading
   * the result as a plain "did they confirm".
   */
  static async open(
    dialogService: DialogService,
    params: PamConfirmDialogParams,
  ): Promise<boolean> {
    const dialogRef = dialogService.open<boolean, PamConfirmDialogParams>(
      PamConfirmDialogComponent,
      {
        data: params,
        // Simple dialogs stay centred; the default strategy turns them into a bottom sheet on mobile.
        positionStrategy: new CenterPositionStrategy(),
      },
    );

    return (await firstValueFrom(dialogRef.closed)) === true;
  }
}

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  IconModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** i18n keys for a rotation action that needs a warning confirmation. */
export type RotationWarningDialogParams = {
  titleKey: string;
  contentKey: string;
  acceptButtonKey: string;
};

/**
 * A confirmation for a risky rotation action, styled as the design asks: a warning icon and a
 * warning confirm button. `openSimpleDialog` can't do this: it only styles the confirm button for
 * `danger` dialogs (every other type, `warning` included, gets the primary button), and its warning
 * icon uses the legacy `tw-text-warning` amber rather than the `fg-warning` token.
 *
 * Accept closes with `true`. Cancel, Escape and the backdrop close with `undefined`.
 */
@Component({
  selector: "pam-rotation-warning-dialog",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, DialogModule, IconModule, I18nPipe],
  template: `
    <bit-simple-dialog>
      <bit-icon
        bitDialogIcon
        name="bwi-exclamation-triangle"
        class="tw-text-3xl tw-text-fg-warning"
      ></bit-icon>
      <span bitDialogTitle>{{ params.titleKey | i18n }}</span>
      <span bitDialogContent>{{ params.contentKey | i18n }}</span>
      <ng-container bitDialogFooter>
        <button
          type="button"
          bitButton
          buttonType="warning"
          data-testid="rotation-warning-dialog_button_accept"
          (click)="accept()"
        >
          {{ params.acceptButtonKey | i18n }}
        </button>
        <button
          type="button"
          bitButton
          buttonType="secondary"
          bitDialogClose
          data-testid="rotation-warning-dialog_button_cancel"
        >
          {{ "cancel" | i18n }}
        </button>
      </ng-container>
    </bit-simple-dialog>
  `,
})
export class RotationWarningDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean | undefined>>(DialogRef);
  protected readonly params = inject<RotationWarningDialogParams>(DIALOG_DATA);

  protected accept(): void {
    void this.dialogRef.close(true);
  }
}

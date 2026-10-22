import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { InviteLinkMarketing } from "@bitwarden/assets/svg";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
  SvgComponent,
  // TODO(guided-tour removal): drop this import once the tour-preview notice paragraph is
  // removed from invite-link-callout-dialog.component.html — nothing else in this component
  // uses bitTypography. See the header comment in
  // invite-members-dialog/by-link-tab-tour.component.ts for the full removal checklist.
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export const InviteLinkCalloutDialogResult = Object.freeze({
  Skip: "skip",
  ShowMeHow: "showMeHow",
} as const);
export type InviteLinkCalloutDialogResult =
  (typeof InviteLinkCalloutDialogResult)[keyof typeof InviteLinkCalloutDialogResult];

@Component({
  selector: "app-invite-link-callout-dialog",
  templateUrl: "./invite-link-callout-dialog.component.html",
  imports: [ButtonModule, DialogModule, I18nPipe, SvgComponent, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteLinkCalloutDialogComponent {
  private readonly dialogRef = inject<DialogRef<InviteLinkCalloutDialogResult>>(DialogRef);

  protected readonly marketingSvg = InviteLinkMarketing;

  protected async close(result: InviteLinkCalloutDialogResult) {
    await this.dialogRef.close(result);
  }

  static open(dialogService: DialogService) {
    return dialogService.open<InviteLinkCalloutDialogResult>(InviteLinkCalloutDialogComponent, {
      disableClose: true,
    });
  }
}

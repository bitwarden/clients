import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  IconModule,
  IconTileComponent,
  SkeletonComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationLongPipe } from "../../date/duration-long.pipe";
import { RequestAccessFormComponent } from "../request-access-form/request-access-form.component";

export type RequestAccessSheetParams = {
  cipherId: string;
  /** Shown beside the sheet title. */
  itemName?: string;
};

/**
 * The request form in a bottom sheet, for the popup. Closes with `true` when access changed, so the
 * caller re-reads it.
 */
@Component({
  selector: "app-pam-request-access-sheet",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-access-sheet.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    IconModule,
    IconTileComponent,
    SkeletonComponent,
    TypographyModule,
    DurationLongPipe,
    I18nPipe,
    RequestAccessFormComponent,
  ],
})
export class RequestAccessSheetComponent {
  protected readonly params = inject<RequestAccessSheetParams>(DIALOG_DATA);
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;

  static open(dialogService: DialogService, data: RequestAccessSheetParams): DialogRef<boolean> {
    return dialogService.open(RequestAccessSheetComponent, { data });
  }
}

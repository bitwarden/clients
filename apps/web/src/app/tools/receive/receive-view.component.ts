import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveAddEditComponent } from "./receive-add-edit.component";
import { ReceiveView } from "./receive-view";

@Component({
  templateUrl: "./receive-view.component.html",
  imports: [DatePipe, DialogModule, ButtonModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveViewComponent {
  constructor(
    @Inject(DIALOG_DATA) protected readonly receive: ReceiveView,
    private readonly dialogRef: DialogRef,
    private readonly dialogService: DialogService,
  ) {}

  protected openEdit(): void {
    this.dialogRef.close();
    this.dialogService.openDrawer(ReceiveAddEditComponent, { closeOnNavigation: true });
  }
}

import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import { ReceiveService } from "@bitwarden/common/tools/receive/services/receive.service";
import {
  ButtonModule,
  CalloutModule,
  CardComponent,
  CopyClickDirective,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReceiveAddEditComponent } from "./receive-add-edit.component";
import { ReceiveFilesViewComponent } from "./receive-files-view.component";

@Component({
  templateUrl: "./receive-view.component.html",
  imports: [
    CalloutModule,
    CopyClickDirective,
    DatePipe,
    DialogModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
    I18nPipe,
    ReceiveFilesViewComponent,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveViewComponent {
  protected readonly receive = inject<ReceiveView>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly receiveService = inject(ReceiveService);

  protected readonly isExpired = computed(
    () => this.receive.expirationDate != null && this.receive.expirationDate < new Date(),
  );

  protected readonly receiveLink = toSignal(this.receiveService.buildReceiveUrl$(this.receive));

  protected openEdit(): void {
    this.dialogRef.close();
    this.dialogService.openDrawer(ReceiveAddEditComponent, {
      data: this.receive,
      closeOnNavigation: true,
    });
  }
}

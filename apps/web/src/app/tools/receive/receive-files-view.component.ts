import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { ReceiveFileView } from "@bitwarden/common/tools/receive/models/view/receive-file.view";
import { ReceiveView } from "@bitwarden/common/tools/receive/models/view/receive.view";
import { ReceiveFileService } from "@bitwarden/common/tools/receive/services/receive-file.service";
import {
  BitActionDirective,
  IconButtonModule,
  ItemModule,
  SectionHeaderComponent,
  TypographyModule,
  IconTileComponent,
  CardComponent,
  SectionComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-receive-files-view",
  templateUrl: "./receive-files-view.component.html",
  imports: [
    CommonModule,
    I18nPipe,
    IconButtonModule,
    ItemModule,
    BitActionDirective,
    SectionHeaderComponent,
    TypographyModule,
    SectionComponent,
    SectionHeaderComponent,
    CardComponent,
    IconTileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveFilesViewComponent {
  private readonly receiveFileService = inject(ReceiveFileService);
  readonly receiveView = input.required<ReceiveView>();

  readonly downloadFile = (fileView: ReceiveFileView) => {
    return async () => {
      const receiveId = this.receiveView().id;
      await this.receiveFileService.downloadFile(fileView, receiveId);
    };
  };
}

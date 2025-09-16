import { Component } from "@angular/core";

import {
  ButtonModule,
  DialogModule,
  DialogService,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  templateUrl: "./first-report-prompt-dialog.component.html",
  imports: [ButtonModule, DialogModule, LinkModule, TypographyModule, I18nPipe],
})
export class FirstReportPromptDialogComponent {
  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(FirstReportPromptDialogComponent);
  }
}

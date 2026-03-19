import { Component } from "@angular/core";

import { ButtonModule, DialogModule, DialogService, ItemModule } from "@bitwarden/components";
import {
  CredentialGeneratorHistoryDialogComponent,
  GeneratorModule,
} from "@bitwarden/generator-components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "credential-generator",
  templateUrl: "credential-generator.component.html",
  imports: [DialogModule, ButtonModule, I18nPipe, GeneratorModule, ItemModule],
})
export class CredentialGeneratorComponent {
  constructor(private dialogService: DialogService) {}

  openHistoryDialog = () => {
    // open history dialog
    this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
  };
}

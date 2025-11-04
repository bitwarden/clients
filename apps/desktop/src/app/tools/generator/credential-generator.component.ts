import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  ItemModule,
  LinkModule,
} from "@bitwarden/components";
import {
  CredentialGeneratorHistoryDialogComponent,
  GeneratorModule,
} from "@bitwarden/generator-components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "credential-generator",
  templateUrl: "credential-generator.component.html",
  imports: [DialogModule, ButtonModule, JslibModule, GeneratorModule, ItemModule, LinkModule],
})
export class CredentialGeneratorComponent {
  constructor(private dialogService: DialogService) {}

  openHistoryDialog = () => {
    // open history dialog
    this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
  };
}

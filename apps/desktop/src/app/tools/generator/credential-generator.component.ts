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

@Component({
  standalone: true,
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

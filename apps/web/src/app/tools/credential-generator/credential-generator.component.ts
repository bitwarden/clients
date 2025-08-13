import { Component } from "@angular/core";

import { ButtonModule, DialogService, LinkModule } from "@bitwarden/components";
import {
  CredentialGeneratorHistoryDialogComponent,
  GeneratorModule,
} from "@bitwarden/generator-components";

import { HeaderModule } from "../../layouts/header/header.module";
import { SharedModule } from "../../shared";

@Component({
  selector: "credential-generator",
  templateUrl: "credential-generator.component.html",
  imports: [SharedModule, HeaderModule, GeneratorModule, ButtonModule, LinkModule],
})
export class CredentialGeneratorComponent {
  constructor(private dialogService: DialogService) {}

  openHistoryDialog = () => {
    this.dialogService.open(CredentialGeneratorHistoryDialogComponent);
  };
}

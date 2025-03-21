import { DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ButtonModule, DialogModule, TypographyModule } from "@bitwarden/components";

import { VaultItemVisualizerComponent } from "./vault-item-visualizer.component";

type VisualizeVaultItemDialogParams = {
  cipher: CipherView;
};

@Component({
  selector: "vault-item-visualizer-dialog",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    TypographyModule,
    VaultItemVisualizerComponent,
  ],
  templateUrl: "./vault-item-visualizer-dialog.component.html",
})
export class VaultItemVisualizerDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected data: VisualizeVaultItemDialogParams) {}
}

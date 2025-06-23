import { NgIf } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";

const SetupExtensionState = {
  Loading: "loading",
} as const;

type SetupExtensionState = UnionOfValues<typeof SetupExtensionState>;

@Component({
  selector: "vault-setup-extension",
  templateUrl: "./setup-extension.component.html",
  imports: [NgIf, JslibModule],
})
export class SetupExtensionComponent {
  protected state: SetupExtensionState = SetupExtensionState.Loading;
  protected SetupExtensionState = SetupExtensionState;
}

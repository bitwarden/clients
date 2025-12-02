import { ChangeDetectionStrategy, Component } from "@angular/core";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultStateService } from "../../../../services/vault-state.service";
import { VaultFilterModule } from "../vault-filter/vault-filter.module";

@Component({
  selector: "app-vault-nav",
  imports: [I18nPipe, NavigationModule, VaultFilterModule],
  templateUrl: "./vault-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultNavComponent {
  constructor(protected vaultStateService: VaultStateService) {}
}

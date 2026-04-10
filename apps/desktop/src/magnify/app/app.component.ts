import { ChangeDetectionStrategy, Component, signal } from "@angular/core";

import { MagnifyAuthStatus } from "../../autofill/models/magnify-commands";
import { CommandService } from "../services/command-service";

import { SearchBarComponent } from "./components/search-bar/search-bar.component";
import { VaultAuthStatusComponent } from "./components/vault-auth-status/vault-auth-status.component";
import { VAULT_AUTH_STATUS_HEIGHT } from "./utils/magnify-layout";

@Component({
  selector: "magnify-root",
  standalone: true,
  imports: [SearchBarComponent, VaultAuthStatusComponent],
  template: `
    @if (authStatus() === AuthStatus.Unlocked) {
      <search-bar />
    } @else if (authStatus() !== null) {
      <vault-auth-status [status]="authStatus()!" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  protected readonly AuthStatus = MagnifyAuthStatus;
  private readonly _authStatus = signal<MagnifyAuthStatus | null>(null);
  readonly authStatus = this._authStatus.asReadonly();

  constructor(private readonly commandService: CommandService) {
    void this.commandService
      .getAuthStatus()
      .then((status) => {
        this._authStatus.set(status);
        if (status !== MagnifyAuthStatus.Unlocked) {
          this.commandService.resize(VAULT_AUTH_STATUS_HEIGHT);
        }
      })
      .catch(() => {
        this._authStatus.set(MagnifyAuthStatus.Locked);
        this.commandService.resize(VAULT_AUTH_STATUS_HEIGHT);
      });
  }
}

import { ChangeDetectionStrategy, Component, HostListener, computed, input } from "@angular/core";

import { MagnifyAuthStatus } from "../../../../autofill/models/magnify-commands";
import { CommandService } from "../../../services/command-service";

@Component({
  selector: "vault-auth-status",
  standalone: true,
  templateUrl: "./vault-auth-status.component.html",
  styleUrl: "./vault-auth-status.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultAuthStatusComponent {
  readonly status = input.required<MagnifyAuthStatus>();

  readonly title = computed(() =>
    this.status() === MagnifyAuthStatus.LoggedOut ? "You're logged out" : "Your vault is locked",
  );

  readonly subtitle = computed(() =>
    this.status() === MagnifyAuthStatus.LoggedOut
      ? "Open Bitwarden to log in"
      : "Open Bitwarden to unlock",
  );

  constructor(private readonly commandService: CommandService) {}

  @HostListener("window:keydown.enter")
  onEnter(): void {
    this.commandService.focusBitwarden();
  }
}

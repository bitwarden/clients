import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";

import { CommandService } from "../services/command-service";

@Component({
  selector: "magnify-root",
  template: `<p>Magnify</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  constructor(private readonly commandService: CommandService) {}

  async ngOnInit(): Promise<void> {
    try {
      const r = await this.commandService.searchVault("Netfli");

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const r2 = await this.commandService.copyPassword(r[0].id);
    } catch (error: unknown) {
      const authError = this.commandService.getAuthError(error);
      if (authError != null) {
        // eslint-disable-next-line no-console
        console.log("Auth error:", authError);
        // TODO: navigate user to unlock/login in the desktop app
        return;
      }
      throw error;
    }
  }
}

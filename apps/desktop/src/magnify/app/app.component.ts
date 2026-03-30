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
    const r = await this.commandService.searchVault("Netfli");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const r2 = await this.commandService.copyPassword(r[0].id);
  }
}

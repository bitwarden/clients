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
    await this.commandService.searchVault("Netfli");
  }
}

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
    const results = await this.commandService.searchVault("Netfli");

    // eslint-disable-next-line no-console
    console.log("search 'Netfli' results:", results);

    const loginItem = results.find((r) => r.itemType === "login");
    const cardItem = results.find((r) => r.itemType === "card");

    if (loginItem) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const r2 = await this.commandService.copyPassword(loginItem);
    }

    if (cardItem) {
      // eslint-disable-next-line no-console
      console.log("card number:", await this.commandService.copyCardNumber(cardItem));
      // eslint-disable-next-line no-console
      console.log("card expiration:", await this.commandService.copyCardExpiration(cardItem));
      // eslint-disable-next-line no-console
      console.log("card code:", await this.commandService.copyCardCode(cardItem));
    }
  }
}

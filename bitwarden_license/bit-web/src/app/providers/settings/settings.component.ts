import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";

@Component({
  selector: "provider-settings",
  templateUrl: "settings.component.html",
})
export class SettingsComponent {
  constructor(private route: ActivatedRoute, private providerService: ProviderServiceAbstraction) {}

  ngOnInit() {
    this.route.parent.params.subscribe(async (params) => {
      await this.providerService.get(params.providerId);
    });
  }
}

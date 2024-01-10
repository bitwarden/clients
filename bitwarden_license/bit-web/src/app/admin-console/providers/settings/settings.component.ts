import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";

@Component({
  selector: "provider-settings",
  templateUrl: "settings.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class SettingsComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private providerService: ProviderService,
  ) {}

  ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.params.subscribe(async (params) => {
      await this.providerService.get(params.providerId);
    });
  }
}

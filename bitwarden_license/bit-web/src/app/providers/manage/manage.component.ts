import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";
import { Provider } from "@bitwarden/common/models/domain/provider";

@Component({
  selector: "provider-manage",
  templateUrl: "manage.component.html",
})
export class ManageComponent implements OnInit {
  provider: Provider;
  accessEvents = false;

  constructor(private route: ActivatedRoute, private providerService: ProviderServiceAbstraction) {}

  ngOnInit() {
    this.route.parent.params.subscribe(async (params) => {
      this.provider = await this.providerService.get(params.providerId);
      this.accessEvents = this.provider.useEvents;
    });
  }
}

import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";

@Component({
  selector: "providers-layout",
  templateUrl: "providers-layout.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class ProvidersLayoutComponent implements OnInit {
  provider: Provider;
  private providerId: string;

  constructor(
    private route: ActivatedRoute,
    private providerService: ProviderService,
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.params.subscribe(async (params) => {
      this.providerId = params.providerId;
      await this.load();
    });
  }

  async load() {
    this.provider = await this.providerService.get(this.providerId);
  }

  get showMenuBar() {
    return this.showManageTab || this.showSettingsTab;
  }

  get showManageTab() {
    return this.provider.canManageUsers || this.provider.canAccessEventLogs;
  }

  get showSettingsTab() {
    return this.provider.isProviderAdmin;
  }

  get manageRoute(): string {
    switch (true) {
      case this.provider.canManageUsers:
        return "manage/people";
      case this.provider.canAccessEventLogs:
        return "manage/events";
    }
  }
}

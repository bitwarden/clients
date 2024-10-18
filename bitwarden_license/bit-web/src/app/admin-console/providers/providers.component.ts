import { Component, OnInit } from "@angular/core";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

@Component({
  selector: "app-providers",
  templateUrl: "providers.component.html",
})
export class ProvidersComponent implements OnInit {
  providers: Provider[];
  loaded = false;
  actionPromise: Promise<any>;

  constructor(
    private providerService: ProviderService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    await this.load();
  }

  async load() {
    const providers = await this.providerService.getAll();
    providers.sort(Utils.getSortFunction(this.i18nService, "name"));
    this.providers = providers;
    this.loaded = true;
  }
}

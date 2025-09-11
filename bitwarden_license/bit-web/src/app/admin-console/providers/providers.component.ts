// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

@Component({
  selector: "app-providers",
  templateUrl: "providers.component.html",
  standalone: false,
})
export class ProvidersComponent implements OnInit {
  providers: Provider[];
  loaded = false;
  actionPromise: Promise<any>;

  constructor(
    private providerService: ProviderService,
    private i18nService: I18nService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    document.body.classList.remove("layout_frontend");
    await this.load();
  }

  async load() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const providers = await this.providerService.getAll(userId);
    providers.sort(Utils.getSortFunction(this.i18nService, "name"));
    this.providers = providers;
    this.loaded = true;
  }
}

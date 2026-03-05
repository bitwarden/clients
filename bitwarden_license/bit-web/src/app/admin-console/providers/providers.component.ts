// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { map, Observable, switchMap, tap } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-providers",
  templateUrl: "providers.component.html",
  standalone: false,
})
export class ProvidersComponent implements OnInit {
  providers$: Observable<Provider[]>;
  loaded = false;
  actionPromise: Promise<any>;

  constructor(
    private providerService: ProviderService,
    private i18nService: I18nService,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    document.body.classList.remove("layout_frontend");
    this.load();
  }

  load() {
    this.providers$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.providerService.providers$(userId)),
      map((p) => p.sort(Utils.getSortFunction(this.i18nService, "name"))),
      tap(() => (this.loaded = true)),
    );
  }
}

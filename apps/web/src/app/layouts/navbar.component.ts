import { Component, NgZone, OnInit } from "@angular/core";

import { BroadcasterService } from "@bitwarden/common/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/abstractions/messaging.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { ProviderServiceAbstraction } from "@bitwarden/common/abstractions/provider/provider.service.abstraction";
import { SyncService } from "@bitwarden/common/abstractions/sync.service";
import { TokenService } from "@bitwarden/common/abstractions/token.service";
import { Utils } from "@bitwarden/common/misc/utils";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { Provider } from "@bitwarden/common/models/domain/provider";

import { NavigationPermissionsService as OrgNavigationPermissionsService } from "../organizations/services/navigation-permissions.service";

@Component({
  selector: "app-navbar",
  templateUrl: "navbar.component.html",
})
export class NavbarComponent implements OnInit {
  selfHosted = false;
  name: string;
  email: string;
  providers: Provider[] = [];
  organizations: Organization[] = [];

  constructor(
    private messagingService: MessagingService,
    private platformUtilsService: PlatformUtilsService,
    private tokenService: TokenService,
    private providerService: ProviderServiceAbstraction,
    private syncService: SyncService,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone
  ) {
    this.selfHosted = this.platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    this.name = await this.tokenService.getName();
    this.email = await this.tokenService.getEmail();
    if (this.name == null || this.name.trim() === "") {
      this.name = this.email;
    }

    // Ensure providers and organizations are loaded
    if ((await this.syncService.getLastSync()) == null) {
      await this.syncService.fullSync(false);
    }
    this.providers = await this.providerService.getAll();

    this.organizations = await this.buildOrganizations();

    this.broadcasterService.subscribe(this.constructor.name, async (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "organizationCreated":
            if (this.organizations.length < 1) {
              this.organizations = await this.buildOrganizations();
            }
            break;
        }
      });
    });
  }

  async buildOrganizations() {
    const allOrgs = await this.organizationService.getAll();
    return allOrgs
      .filter((org) => OrgNavigationPermissionsService.canAccessAdmin(org))
      .sort(Utils.getSortFunction(this.i18nService, "name"));
  }

  lock() {
    this.messagingService.send("lockVault");
  }

  logOut() {
    this.messagingService.send("logout");
  }
}

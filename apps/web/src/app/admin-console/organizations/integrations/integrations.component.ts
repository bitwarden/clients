// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable, Subject, switchMap, takeUntil } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { HeaderModule } from "../../../layouts/header/header.module";
import { SharedModule } from "../../../shared/shared.module";
import { SharedOrganizationModule } from "../shared";
import { IntegrationGridComponent } from "../shared/components/integrations/integration-grid/integration-grid.component";
import { FilterIntegrationsPipe } from "../shared/components/integrations/integrations.pipe";
import { Integration } from "../shared/components/integrations/models";

@Component({
  selector: "ac-integrations",
  templateUrl: "./integrations.component.html",
  imports: [
    SharedModule,
    SharedOrganizationModule,
    IntegrationGridComponent,
    HeaderModule,
    FilterIntegrationsPipe,
  ],
})
export class AdminConsoleIntegrationsComponent implements OnInit, OnDestroy {
  integrationsList: Integration[] = [];
  tabIndex: number;
  organization$: Observable<Organization>;
  isEventBasedIntegrationsEnabled: boolean = false;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.organization$ = this.route.params.pipe(
      switchMap((params) =>
        this.accountService.activeAccount$.pipe(
          switchMap((account) =>
            this.organizationService
              .organizations$(account?.id)
              .pipe(getOrganizationById(params.organizationId)),
          ),
        ),
      ),
    );
  }

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {
    this.configService
      .getFeatureFlag$(FeatureFlag.EventBasedOrganizationIntegrations)
      .pipe(takeUntil(this.destroy$))
      .subscribe((isEnabled) => {
        this.isEventBasedIntegrationsEnabled = isEnabled;
      });

    this.integrationsList = [
      {
        name: "AD FS",
        linkURL: "https://bitwarden.com/help/saml-adfs/",
        image: "../../../../../../../images/integrations/azure-active-directory.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Auth0",
        linkURL: "https://bitwarden.com/help/saml-auth0/",
        image: "../../../../../../../images/integrations/logo-auth0-badge-color.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "AWS",
        linkURL: "https://bitwarden.com/help/saml-aws/",
        image: "../../../../../../../images/integrations/aws-color.svg",
        imageDarkMode: "../../../../../../../images/integrations/aws-darkmode.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Microsoft Entra ID",
        linkURL: "https://bitwarden.com/help/saml-azure/",
        image: "../../../../../../../images/integrations/logo-microsoft-entra-id-color.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Duo",
        linkURL: "https://bitwarden.com/help/saml-duo/",
        image: "../../../../../../../images/integrations/logo-duo-color.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Google",
        linkURL: "https://bitwarden.com/help/saml-google/",
        image: "../../../../../../../images/integrations/logo-google-badge-color.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "JumpCloud",
        linkURL: "https://bitwarden.com/help/saml-jumpcloud/",
        image: "../../../../../../../images/integrations/logo-jumpcloud-badge-color.svg",
        imageDarkMode: "../../../../../../../images/integrations/jumpcloud-darkmode.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "KeyCloak",
        linkURL: "https://bitwarden.com/help/saml-keycloak/",
        image: "../../../../../../../images/integrations/logo-keycloak-icon.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Okta",
        linkURL: "https://bitwarden.com/help/saml-okta/",
        image: "../../../../../../../images/integrations/logo-okta-symbol-black.svg",
        imageDarkMode: "../../../../../../../images/integrations/okta-darkmode.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "OneLogin",
        linkURL: "https://bitwarden.com/help/saml-onelogin/",
        image: "../../../../../../../images/integrations/logo-onelogin-badge-color.svg",
        imageDarkMode: "../../../../../../../images/integrations/onelogin-darkmode.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "PingFederate",
        linkURL: "https://bitwarden.com/help/saml-pingfederate/",
        image: "../../../../../../../images/integrations/logo-ping-identity-badge-color.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Microsoft Entra ID",
        linkURL: "https://bitwarden.com/help/microsoft-entra-id-scim-integration/",
        image: "../../../../../../../images/integrations/logo-microsoft-entra-id-color.svg",
        type: IntegrationType.SCIM,
      },
      {
        name: "Okta",
        linkURL: "https://bitwarden.com/help/okta-scim-integration/",
        image: "../../../../../../../images/integrations/logo-okta-symbol-black.svg",
        imageDarkMode: "../../../../../../../images/integrations/okta-darkmode.svg",
        type: IntegrationType.SCIM,
      },
      {
        name: "OneLogin",
        linkURL: "https://bitwarden.com/help/onelogin-scim-integration/",
        image: "../../../../../../../images/integrations/logo-onelogin-badge-color.svg",
        imageDarkMode: "../../../../../../../images/integrations/onelogin-darkmode.svg",
        type: IntegrationType.SCIM,
      },
      {
        name: "JumpCloud",
        linkURL: "https://bitwarden.com/help/jumpcloud-scim-integration/",
        image: "../../../../../../../images/integrations/logo-jumpcloud-badge-color.svg",
        imageDarkMode: "../../../../../../../images/integrations/jumpcloud-darkmode.svg",
        type: IntegrationType.SCIM,
      },
      {
        name: "Ping Identity",
        linkURL: "https://bitwarden.com/help/ping-identity-scim-integration/",
        image: "../../../../../../../images/integrations/logo-ping-identity-badge-color.svg",
        type: IntegrationType.SCIM,
      },
      {
        name: "Active Directory",
        linkURL: "https://bitwarden.com/help/ldap-directory/",
        image: "../../../../../../../images/integrations/azure-active-directory.svg",
        type: IntegrationType.BWDC,
      },
      {
        name: "Microsoft Entra ID",
        linkURL: "https://bitwarden.com/help/microsoft-entra-id/",
        image: "../../../../../../../images/integrations/logo-microsoft-entra-id-color.svg",
        type: IntegrationType.BWDC,
      },
      {
        name: "Google Workspace",
        linkURL: "https://bitwarden.com/help/workspace-directory/",
        image: "../../../../../../../images/integrations/logo-google-badge-color.svg",
        type: IntegrationType.BWDC,
      },
      {
        name: "Okta",
        linkURL: "https://bitwarden.com/help/okta-directory/",
        image: "../../../../../../../images/integrations/logo-okta-symbol-black.svg",
        imageDarkMode: "../../../../../../../images/integrations/okta-darkmode.svg",
        type: IntegrationType.BWDC,
      },
      {
        name: "OneLogin",
        linkURL: "https://bitwarden.com/help/onelogin-directory/",
        image: "../../../../../../../images/integrations/logo-onelogin-badge-color.svg",
        imageDarkMode: "../../../../../../../images/integrations/onelogin-darkmode.svg",
        type: IntegrationType.BWDC,
      },
      {
        name: "Splunk",
        linkURL: "https://bitwarden.com/help/splunk-siem/",
        image: "../../../../../../../images/integrations/logo-splunk-black.svg",
        imageDarkMode: "../../../../../../../images/integrations/splunk-darkmode.svg",
        type: IntegrationType.EVENT,
      },
      {
        name: "Microsoft Sentinel",
        linkURL: "https://bitwarden.com/help/microsoft-sentinel-siem/",
        image: "../../../../../../../images/integrations/logo-microsoft-sentinel-color.svg",
        type: IntegrationType.EVENT,
      },
      {
        name: "Rapid7",
        linkURL: "https://bitwarden.com/help/rapid7-siem/",
        image: "../../../../../../../images/integrations/logo-rapid7-black.svg",
        imageDarkMode: "../../../../../../../images/integrations/rapid7-darkmode.svg",
        type: IntegrationType.EVENT,
      },
      {
        name: "Elastic",
        linkURL: "https://bitwarden.com/help/elastic-siem/",
        image: "../../../../../../../images/integrations/logo-elastic-badge-color.svg",
        type: IntegrationType.EVENT,
      },
      {
        name: "Panther",
        linkURL: "https://bitwarden.com/help/panther-siem/",
        image: "../../../../../../../images/integrations/logo-panther-round-color.svg",
        type: IntegrationType.EVENT,
      },
      {
        name: "Microsoft Intune",
        linkURL: "https://bitwarden.com/help/deploy-browser-extensions-with-intune/",
        image: "../../../../../../../images/integrations/logo-microsoft-intune-color.svg",
        type: IntegrationType.DEVICE,
      },
    ];

    if (this.isEventBasedIntegrationsEnabled) {
      this.integrationsList.push({
        name: "Crowdstrike",
        linkURL: "",
        image: "../../../../../../../images/integrations/logo-crowdstrike-black.svg",
        type: IntegrationType.EVENT,
        description: "crowdstrikeEventIntegrationDesc",
        isConnected: false,
        canSetupConnection: true,
      });
    }
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get IntegrationType(): typeof IntegrationType {
    return IntegrationType;
  }
}

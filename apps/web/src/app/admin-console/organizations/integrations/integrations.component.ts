import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { Observable, switchMap, from } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PlanType } from "@bitwarden/common/billing/enums";
import { IntegrationType } from "@bitwarden/common/enums";

import { HeaderModule } from "../../../layouts/header/header.module";
import {
  FilterIntegrationsPipe,
  IntegrationGridComponent,
  Integration,
  IntegrationsAccessPipe,
  IntegrationAccess,
} from "../../../shared/";
import { SharedModule } from "../../../shared/shared.module";
import { SharedOrganizationModule } from "../shared";

@Component({
  selector: "ac-integrations",
  templateUrl: "./integrations.component.html",
  standalone: true,
  imports: [
    SharedModule,
    SharedOrganizationModule,
    IntegrationGridComponent,
    HeaderModule,
    FilterIntegrationsPipe,
    IntegrationsAccessPipe,
  ],
})
export class AdminConsoleIntegrationsComponent implements OnInit {
  integrationsList: Integration[] = [];
  integrationAccessList: IntegrationAccess[] = [];
  tabIndex: number;
  organizationPlanType$: Observable<PlanType>;

  ngOnInit(): void {
    this.organizationPlanType$ = this.route.params.pipe(
      switchMap((params) => this.organizationService.get$(params.organizationId)),
      switchMap((org) => from(this.organizationApiService.getPlanType(org.id))),
    );
  }

  constructor(
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
  ) {
    this.integrationAccessList = [
      {
        type: IntegrationType.SSO,
        canAccess: [
          PlanType.EnterpriseMonthly,
          PlanType.EnterpriseMonthly2023,
          PlanType.EnterpriseMonthly2020,
          PlanType.EnterpriseAnnually,
          PlanType.EnterpriseAnnually2023,
          PlanType.EnterpriseAnnually2020,
        ],
      },
      {
        type: IntegrationType.SCIM,
        canAccess: [
          PlanType.EnterpriseAnnually,
          PlanType.EnterpriseAnnually2023,
          PlanType.EnterpriseAnnually2020,
          PlanType.EnterpriseMonthly,
          PlanType.EnterpriseMonthly2023,
          PlanType.EnterpriseMonthly2020,
          PlanType.TeamsMonthly,
          PlanType.TeamsAnnually,
        ],
      },
      {
        type: IntegrationType.BWDC,
        canAccess: [
          PlanType.EnterpriseAnnually,
          PlanType.EnterpriseAnnually2023,
          PlanType.EnterpriseAnnually2020,
          PlanType.EnterpriseMonthly,
          PlanType.EnterpriseMonthly2023,
          PlanType.EnterpriseMonthly2020,
          PlanType.TeamsAnnually,
          PlanType.TeamsAnnually2023,
          PlanType.TeamsAnnually2020,
          PlanType.TeamsAnnually2019,
          PlanType.TeamsMonthly,
          PlanType.TeamsMonthly2023,
          PlanType.TeamsMonthly2020,
          PlanType.TeamsMonthly2019,
        ],
      },
      {
        type: IntegrationType.EVENT,
        canAccess: [
          PlanType.EnterpriseAnnually,
          PlanType.EnterpriseAnnually2023,
          PlanType.EnterpriseAnnually2020,
          PlanType.EnterpriseAnnually2019,
          PlanType.EnterpriseMonthly,
          PlanType.EnterpriseMonthly2023,
          PlanType.EnterpriseMonthly2020,
          PlanType.EnterpriseMonthly2019,
          PlanType.TeamsAnnually,
          PlanType.TeamsAnnually2023,
          PlanType.TeamsAnnually2020,
          PlanType.TeamsAnnually2019,
          PlanType.TeamsMonthly,
          PlanType.TeamsMonthly2023,
          PlanType.TeamsMonthly2019,
          PlanType.TeamsMonthly2020,
        ],
      },
      {
        type: IntegrationType.DEVICE,
        canAccess: [
          PlanType.EnterpriseAnnually,
          PlanType.EnterpriseAnnually2023,
          PlanType.EnterpriseAnnually2020,
          PlanType.EnterpriseAnnually2019,
          PlanType.EnterpriseMonthly,
          PlanType.EnterpriseMonthly2023,
          PlanType.EnterpriseMonthly2020,
          PlanType.EnterpriseMonthly2019,
          PlanType.TeamsAnnually,
          PlanType.TeamsAnnually2023,
          PlanType.TeamsAnnually2020,
          PlanType.TeamsAnnually2019,
          PlanType.TeamsMonthly,
          PlanType.TeamsMonthly2023,
          PlanType.TeamsMonthly2019,
          PlanType.TeamsMonthly2020,
        ],
      },
    ];
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
  }

  get IntegrationType(): typeof IntegrationType {
    return IntegrationType;
  }
}

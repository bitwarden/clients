import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, Resolve } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { take, takeWhile } from "rxjs/operators";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationServiceName } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { OrganizationIntegrationType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-type";
import { OrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/organization-integration-service";
import { IntegrationStateService } from "@bitwarden/bit-common/dirt/organization-integrations/shared/integration-state.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";

@Injectable()
export class OrganizationIntegrationsResolver implements Resolve<boolean> {
  constructor(
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private configService: ConfigService,
    private organizationIntegrationService: OrganizationIntegrationService,
    private state: IntegrationStateService,
  ) {}

  async resolve(route: ActivatedRouteSnapshot): Promise<boolean> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    if (!userId) {
      throw new Error("User ID not found");
    }

    const orgId = route.paramMap.get("organizationId")!;
    const org = await firstValueFrom(
      this.organizationService.organizations$(userId).pipe(getById(orgId), takeWhile(Boolean)),
    );

    this.state.setOrganization(org);

    await firstValueFrom(this.organizationIntegrationService.setOrganizationId(org.id));

    const integrations: Integration[] = [
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
        name: "Sumo Logic",
        linkURL: "https://bitwarden.com/help/sumo-logic-siem/",
        image: "../../../../../../../images/integrations/logo-sumo-logic-siem.svg",
        imageDarkMode: "../../../../../../../images/integrations/logo-sumo-logic-siem-darkmode.svg",
        type: IntegrationType.EVENT,
        newBadgeExpiration: "2025-12-31",
      },
      {
        name: "Microsoft Intune",
        linkURL: "https://bitwarden.com/help/deploy-browser-extensions-with-intune/",
        image: "../../../../../../../images/integrations/logo-microsoft-intune-color.svg",
        type: IntegrationType.DEVICE,
      },
    ];

    const featureEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.EventManagementForDataDogAndCrowdStrike),
    );

    if (featureEnabled) {
      integrations.push(
        {
          name: OrganizationIntegrationServiceName.CrowdStrike,
          linkURL: "https://bitwarden.com/help/crowdstrike-siem/",
          image: "../../../../../../../images/integrations/logo-crowdstrike-black.svg",
          type: IntegrationType.EVENT,
          canSetupConnection: true,
          integrationType: OrganizationIntegrationType.Hec,
        },
        {
          name: OrganizationIntegrationServiceName.Datadog,
          linkURL: "https://bitwarden.com/help/datadog-siem/",
          image: "../../../../../../../images/integrations/logo-datadog-color.svg",
          type: IntegrationType.EVENT,
          canSetupConnection: true,
          integrationType: OrganizationIntegrationType.Datadog,
        },
      );
    }

    // Add Huntress SIEM integration (separate feature flag)
    const huntressFeatureEnabled = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.EventManagementForHuntress),
    );

    if (huntressFeatureEnabled) {
      integrations.push({
        name: OrganizationIntegrationServiceName.Huntress,
        linkURL: "https://bitwarden.com/help/huntress-siem/",
        image: "../../../../../../../images/integrations/logo-huntress-siem.svg",
        imageDarkMode: "../../../../../../../images/integrations/logo-huntress-siem-darkmode.svg",
        type: IntegrationType.EVENT,
        description: "huntressEventIntegrationDesc",
        canSetupConnection: true,
        integrationType: OrganizationIntegrationType.Hec,
      });
    }

    const orgIntegrations = await firstValueFrom(
      this.organizationIntegrationService.integrations$.pipe(take(1)),
    );

    const merged = integrations.map((i) => ({
      ...i,
      organizationIntegration: orgIntegrations.find((o) => o.serviceName === i.name) ?? null,
    }));

    this.state.setIntegrations(merged);

    return true;
  }
}

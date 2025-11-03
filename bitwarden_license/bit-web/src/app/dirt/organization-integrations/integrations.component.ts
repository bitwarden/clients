import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom, Observable, Subject, switchMap, takeUntil, takeWhile } from "rxjs";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { OrganizationIntegrationServiceType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-service-type";
import { OrganizationIntegrationType } from "@bitwarden/bit-common/dirt/organization-integrations/models/organization-integration-type";
import { DatadogOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/datadog-organization-integration-service";
import { HecOrganizationIntegrationService } from "@bitwarden/bit-common/dirt/organization-integrations/services/hec-organization-integration-service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { IntegrationType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { getById } from "@bitwarden/common/platform/misc";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { IntegrationGridComponent } from "./integration-grid/integration-grid.component";
import { FilterIntegrationsPipe } from "./integrations.pipe";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "ac-integrations",
  templateUrl: "./integrations.component.html",
  imports: [SharedModule, IntegrationGridComponent, HeaderModule, FilterIntegrationsPipe],
})
export class AdminConsoleIntegrationsComponent implements OnInit, OnDestroy {
  tabIndex: number = 0;
  organization$: Observable<Organization> = new Observable<Organization>();
  isEventManagementForDataDogAndCrowdStrikeEnabled: boolean = false;
  private destroy$ = new Subject<void>();

  // initialize the integrations list with default integrations
  integrationsList: Integration[] = [
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
      image: "../../../../../../../images/integrations/logo-sumo-logic.svg",
      imageDarkMode: "../../../../../../../images/integrations/logo-sumo-logic-darkmode.svg",
      type: IntegrationType.EVENT,
    },
    {
      name: "Microsoft Intune",
      linkURL: "https://bitwarden.com/help/deploy-browser-extensions-with-intune/",
      image: "../../../../../../../images/integrations/logo-microsoft-intune-color.svg",
      type: IntegrationType.DEVICE,
    },
  ];

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    if (!userId) {
      throw new Error("User ID not found");
    }

    this.organization$ = this.route.params.pipe(
      switchMap((params) =>
        this.organizationService.organizations$(userId).pipe(
          getById(params.organizationId),
          // Filter out undefined values
          takeWhile((org: Organization | undefined) => !!org),
        ),
      ),
    );

    // Sets the organization ID which also loads the integrations$
    this.organization$.pipe(takeUntil(this.destroy$)).subscribe((org) => {
      this.hecOrganizationIntegrationService.setOrganizationIntegrations(org.id);
      this.datadogOrganizationIntegrationService.setOrganizationIntegrations(org.id);
    });
  }

  constructor(
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private configService: ConfigService,
    private hecOrganizationIntegrationService: HecOrganizationIntegrationService,
    private datadogOrganizationIntegrationService: DatadogOrganizationIntegrationService,
  ) {
    this.configService
      .getFeatureFlag$(FeatureFlag.EventManagementForDataDogAndCrowdStrike)
      .pipe(takeUntil(this.destroy$))
      .subscribe((isEnabled) => {
        this.isEventManagementForDataDogAndCrowdStrikeEnabled = isEnabled;
      });

    // Add the new event based items to the list
    if (this.isEventManagementForDataDogAndCrowdStrikeEnabled) {
      const crowdstrikeIntegration: Integration = {
        name: OrganizationIntegrationServiceType.CrowdStrike,
        linkURL: "https://bitwarden.com/help/crowdstrike-siem/",
        image: "../../../../../../../images/integrations/logo-crowdstrike-black.svg",
        type: IntegrationType.EVENT,
        description: "crowdstrikeEventIntegrationDesc",
        canSetupConnection: true,
        integrationType: OrganizationIntegrationType.Hec,
      };

      this.integrationsList.push(crowdstrikeIntegration);

      const datadogIntegration: Integration = {
        name: OrganizationIntegrationServiceType.Datadog,
        linkURL: "https://bitwarden.com/help/datadog-siem/",
        image: "../../../../../../../images/integrations/logo-datadog-color.svg",
        type: IntegrationType.EVENT,
        description: "datadogEventIntegrationDesc",
        canSetupConnection: true,
        integrationType: OrganizationIntegrationType.Datadog,
      };

      this.integrationsList.push(datadogIntegration);
    }

    // For all existing event based configurations loop through and assign the
    // organizationIntegration for the correct services.
    this.hecOrganizationIntegrationService.integrations$
      .pipe(takeUntil(this.destroy$))
      .subscribe((integrations) => {
        // reset all integrations to null first - in case one was deleted
        this.integrationsList.forEach((i) => {
          if (i.integrationType === OrganizationIntegrationType.Hec) {
            i.organizationIntegration = null;
          }
        });

        integrations.map((integration) => {
          const item = this.integrationsList.find((i) => i.name === integration.serviceType);
          if (item) {
            item.organizationIntegration = integration;
          }
        });
      });

    this.datadogOrganizationIntegrationService.integrations$
      .pipe(takeUntil(this.destroy$))
      .subscribe((integrations) => {
        // reset all integrations to null first - in case one was deleted
        this.integrationsList.forEach((i) => {
          if (i.integrationType === OrganizationIntegrationType.Datadog) {
            i.organizationIntegration = null;
          }
        });

        integrations.map((integration) => {
          const item = this.integrationsList.find((i) => i.name === integration.serviceType);
          if (item) {
            item.organizationIntegration = integration;
          }
        });
      });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // use in the view
  get IntegrationType(): typeof IntegrationType {
    return IntegrationType;
  }
}

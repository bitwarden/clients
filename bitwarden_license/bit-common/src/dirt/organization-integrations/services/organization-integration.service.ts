// import {
//   BehaviorSubject,
//   combineLatest,
//   firstValueFrom,
//   Subject,
//   switchMap,
//   takeUntil,
//   zip,
// } from "rxjs";

// import { OrganizationId, OrganizationIntegrationId } from "@bitwarden/common/types/guid";

// import { HecConfiguration } from "../models/configuration/hec-configuration";
// import { Integration } from "../models/integration";
// import { HecTemplate } from "../models/integration-configuration-config/configuration-template/hec-template";
// import { OrganizationIntegrationConfigurationRequest } from "../models/organization-integration-configuration-request";
// import {
//   OrganizationIntegrationConfigurationResponse,
//   OrganizationIntegrationConfigurationResponseWithIntegrationId,
// } from "../models/organization-integration-configuration-response";
// import { OrganizationIntegrationRequest } from "../models/organization-integration-request";
// import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
// import { OrganizationIntegrationType } from "../models/organization-integration-type";

// import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
// import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

// export class OrganizationIntegrationService {
//   private destroy$ = new Subject<void>();
//   private organizationId$ = new BehaviorSubject<OrganizationId | null>(null);
//   private integrations$ = new BehaviorSubject<OrganizationIntegrationResponse[]>([]);
//   private integrationConfigurations$ = new BehaviorSubject<
//     OrganizationIntegrationConfigurationResponseWithIntegrationId[]
//   >([]);

//   private masterIntegrationList$ = new BehaviorSubject<Integration[]>([]);
//   integrationList$ = this.masterIntegrationList$.asObservable();

//   // retrieve integrations and configurations from the DB
//   private fetch$ = this.organizationId$
//     .pipe(
//       switchMap(async (orgId) => {
//         if (orgId) {
//           const data$ = await this.getIntegrationsAndConfigurations(orgId);
//           return await firstValueFrom(data$);
//         } else {
//           return {
//             integrations: this.integrations$.value,
//             configurations: this.integrationConfigurations$.value,
//           };
//         }
//       }),
//       takeUntil(this.destroy$),
//     )
//     .subscribe({
//       next: ({ integrations, configurations }) => {
//         // update the integrations
//         this.integrations$.next(integrations);
//         this.integrationConfigurations$.next(configurations);
//       },
//     });

//   // Update the master Integration list - if any of the integrations or configurations change
//   private mapping$ = combineLatest([this.integrations$, this.integrationConfigurations$])
//     .pipe(takeUntil(this.destroy$))
//     .subscribe(([integrations, configurations]) => {
//       const existingIntegrations = [...this.masterIntegrationList$.value];

//       // Update the integrations list with the fetched integrations
//       if (integrations && integrations.length > 0) {
//         integrations.forEach((integration) => {
//           const hecConfigJson = this.convertToJson<HecConfiguration>(integration.configuration);
//           const serviceName = hecConfigJson?.service ?? "";
//           const existingIntegration = existingIntegrations.find((i) => i.name === serviceName);

//           if (existingIntegration) {
//             // update integrations
//             existingIntegration.isConnected = !!integration.configuration;
//             existingIntegration.configuration = integration.configuration || "";
//             existingIntegration.HecConfiguration = hecConfigJson;

//             const template = this.getIntegrationConfiguration(
//               integration.id,
//               serviceName,
//               configurations,
//             );

//             existingIntegration.HecConfigurationTemplate = template;
//             existingIntegration.template = JSON.stringify(template || {});
//           }
//         });
//       }

//       // update the integrations list
//       this.masterIntegrationList$.next(existingIntegrations);
//     });

//   constructor(
//     private integrationApiService: OrganizationIntegrationApiService,
//     private integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
//   ) {}

//   setOrganizationId(orgId: OrganizationId, integrationList: Integration[]) {
//     this.organizationId$.next(orgId);
//     this.masterIntegrationList$.next(integrationList);
//   }

//   private async getIntegrationsAndConfigurations(orgId: OrganizationId) {
//     const results$ = zip(this.integrationApiService.getOrganizationIntegrations(orgId)).pipe(
//       switchMap(([integrations]) => {
//         const integrationConfigurations: OrganizationIntegrationConfigurationResponseWithIntegrationId[] =
//           [];
//         const promises: Promise<void>[] = [];

//         integrations.forEach((integration) => {
//           const promise = this.integrationConfigurationApiService
//             .getOrganizationIntegrationConfigurations(orgId, integration.id)
//             .then((configs) => {
//               const mappedConfigurations =
//                 new OrganizationIntegrationConfigurationResponseWithIntegrationId(
//                   integration.id,
//                   configs,
//                 );
//               integrationConfigurations.push(mappedConfigurations);
//             });
//           promises.push(promise);
//         });

//         return Promise.all(promises).then(() => {
//           return { integrations, configurations: integrationConfigurations };
//         });
//       }),
//     );

//     return results$;
//   }

//   /*
//    * Saves the HEC integration configuration for a specific organization.
//    * @param organizationId The ID of the organization.
//    * @param service The name of the service.
//    * @param hecConfiguration The HEC integration configuration.
//    * @returns The saved or updated integration response.
//    */
//   async saveHec(
//     organizationId: OrganizationId,
//     service: string,
//     hecConfiguration: HecConfiguration,
//     hecConfigurationTemplate: HecTemplate,
//   ): Promise<{
//     integration: OrganizationIntegrationResponse;
//     configuration: OrganizationIntegrationConfigurationResponse;
//   }> {
//     // save the Hec Integration record
//     const integrationResponse = await this.saveHecIntegration(organizationId, hecConfiguration);

//     if (!integrationResponse.id) {
//       throw new Error("Failed to save HEC integration");
//     }

//     // Save the configuration for the HEC integration record
//     const configurationResponse = await this.saveHecIntegrationConfiguration(
//       organizationId,
//       integrationResponse.id,
//       service,
//       hecConfigurationTemplate,
//     );

//     if (!configurationResponse.id) {
//       throw new Error("Failed to save HEC integration configuration");
//     }

//     return {
//       integration: integrationResponse,
//       configuration: configurationResponse,
//     };
//   }

//   /**
//    * Saves the HEC integration configuration for a specific organization.
//    * @param organizationId The ID of the organization.
//    * @param configuration The HEC integration configuration.
//    * @param index The index of the integration configuration to update, if it exists.
//    * @returns The saved or updated integration response.
//    *
//    * This method checks if an existing HEC integration exists for the organization.
//    * If it does, it updates the existing integration; otherwise, it creates a new one.
//    * The method returns the saved or updated integration response.
//    */
//   async saveHecIntegration(
//     organizationId: OrganizationId,
//     hecConfiguration: HecConfiguration,
//   ): Promise<OrganizationIntegrationResponse> {
//     const request = new OrganizationIntegrationRequest(
//       OrganizationIntegrationType.Hec,
//       hecConfiguration.toString(),
//     );

//     // find the existing integration
//     const existingIntegration = this.integrations$.value.find(
//       (i) => i.type === OrganizationIntegrationType.Hec,
//     );

//     if (existingIntegration) {
//       // existing integration record found, invoke update API endpoint
//       const updatedIntegration = await this.integrationApiService.updateOrganizationIntegration(
//         organizationId,
//         existingIntegration.id,
//         request,
//       );

//       // update our observable with the updated integration
//       const updatedIntegrations = this.integrations$.value.map((integration) => {
//         if (integration.id === existingIntegration.id) {
//           return updatedIntegration;
//         }
//         return integration;
//       });

//       this.integrations$.next(updatedIntegrations);

//       return updatedIntegration;
//     } else {
//       // no existing integration found, invoke create API endpoint
//       const newIntegration = await this.integrationApiService.createOrganizationIntegration(
//         organizationId,
//         request,
//       );

//       // add this to our integrations observable
//       this.integrations$.next([...this.integrations$.value, newIntegration]);
//       return newIntegration;
//     }
//   }

//   /** * Saves the HEC integration configuration for a specific organization and integration.
//    * @param organizationId The ID of the organization.
//    * @param integrationId The ID of the integration.
//    * @param configurationTemplate The HEC integration configuration.
//    * @returns The saved or updated integration configuration response.
//    *
//    * This method checks if an existing configuration exists for the given integration.
//    * If it does, it updates the existing configuration; otherwise, it creates a new one.
//    * The method returns the saved or updated configuration response.
//    */
//   async saveHecIntegrationConfiguration(
//     organizationId: OrganizationId,
//     integrationId: OrganizationIntegrationId,
//     service: string,
//     configurationTemplate: HecTemplate,
//   ): Promise<OrganizationIntegrationConfigurationResponse> {
//     const request = new OrganizationIntegrationConfigurationRequest(
//       null,
//       null,
//       null,
//       configurationTemplate.toString(),
//     );

//     // check if we have an existing configuration for this integration
//     const integrationConfigurations = this.integrationConfigurations$.value;

//     // find the existing configuration by integrationId
//     const existingConfigurations = integrationConfigurations
//       .filter((config) => config.integrationId === integrationId)
//       .flatMap((config) => config.configurationResponses || []);

//     // find the configuration by service
//     const existingConfiguration =
//       existingConfigurations.length > 0
//         ? existingConfigurations.find(
//             (config) =>
//               config.template &&
//               this.convertToJson<HecTemplate>(config.template)?.service === service,
//           )
//         : null;

//     if (existingConfiguration) {
//       // existing configuration found, invoke update API endpoint
//       const updatedConfiguration =
//         await this.integrationConfigurationApiService.updateOrganizationIntegrationConfiguration(
//           organizationId,
//           integrationId,
//           existingConfiguration.id,
//           request,
//         );

//       // update our configurations for the integration
//       integrationConfigurations.forEach((integrationConfig) => {
//         if (integrationConfig.integrationId === integrationId) {
//           integrationConfig.configurationResponses = integrationConfig.configurationResponses.map(
//             (config) => {
//               return config.id === existingConfiguration.id ? updatedConfiguration : config;
//             },
//           );
//         }
//       });

//       this.integrationConfigurations$.next(integrationConfigurations);

//       return updatedConfiguration;
//     } else {
//       // no existing configuration found, invoke create API endpoint
//       const newConfiguration =
//         await this.integrationConfigurationApiService.createOrganizationIntegrationConfiguration(
//           organizationId,
//           integrationId,
//           request,
//         );

//       // add the new configuration to the integration configurations
//       const integrationConfig = integrationConfigurations.find(
//         (config) => config.integrationId === integrationId,
//       );

//       if (integrationConfig) {
//         integrationConfig.configurationResponses.push(newConfiguration);
//       } else {
//         integrationConfigurations.push({
//           integrationId,
//           configurationResponses: [newConfiguration],
//         });
//       }

//       this.integrationConfigurations$.next(integrationConfigurations);
//       return newConfiguration;
//     }
//   }

//   private getIntegrationConfiguration(
//     integrationId: OrganizationIntegrationId,
//     service: string,
//     integrationConfigurations: OrganizationIntegrationConfigurationResponseWithIntegrationId[],
//   ): HecTemplate | null {
//     if (integrationConfigurations.length === 0) {
//       return null;
//     }

//     const integrationConfigs = integrationConfigurations.find(
//       (config) => config.integrationId === integrationId,
//     );

//     if (!integrationConfigs) {
//       return null;
//     }

//     for (const config of integrationConfigs.configurationResponses) {
//       const template = this.convertToJson<HecTemplate>(config.template || "");
//       if (template && template.service === service) {
//         return template;
//       }
//     }

//     return null;
//   }

//   convertToJson<T>(jsonString?: string): T | null {
//     try {
//       return JSON.parse(jsonString || "") as T;
//     } catch {
//       return null;
//     }
//   }
// }

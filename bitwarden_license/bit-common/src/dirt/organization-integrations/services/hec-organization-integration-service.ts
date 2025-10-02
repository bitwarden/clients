import { BehaviorSubject, firstValueFrom, map, Subject, switchMap, takeUntil, zip } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

import { HecConfiguration } from "../models/configuration/hec-configuration";
import { HecTemplate } from "../models/integration-configuration-config/configuration-template/hec-template";
import { OrganizationIntegration } from "../models/organization-integration";
import { OrganizationIntegrationConfiguration } from "../models/organization-integration-configuration";
import { OrganizationIntegrationConfigurationRequest } from "../models/organization-integration-configuration-request";
import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";
import { OrganizationIntegrationRequest } from "../models/organization-integration-request";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
import { OrganizationIntegrationServiceType } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

export type HecModificationFailureReason = {
  mustBeOwner: boolean;
  success: boolean;
};

export class HecOrganizationIntegrationService {
  private organizationId$ = new BehaviorSubject<OrganizationId | null>(null);
  private _integrations$ = new BehaviorSubject<OrganizationIntegration[]>([]);
  private destroy$ = new Subject<void>();

  integrations$ = this._integrations$.asObservable();

  private fetch$ = this.organizationId$
    .pipe(
      switchMap(async (orgId) => {
        if (orgId) {
          const data$ = await this.setIntegrations(orgId);
          return await firstValueFrom(data$);
        } else {
          return [] as OrganizationIntegration[];
        }
      }),
      takeUntil(this.destroy$),
    )
    .subscribe({
      next: (integrations) => {
        this._integrations$.next(integrations);
      },
    });

  constructor(
    private integrationApiService: OrganizationIntegrationApiService,
    private integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
  ) {}

  /**
   * Sets the organization Id and will trigger the retrieval of the
   * integrations for a given org.
   * @param orgId
   */
  setOrganizationIntegrations(orgId: OrganizationId) {
    if (orgId == this.organizationId$.getValue()) {
      return;
    }
    this._integrations$.next([]);
    this.organizationId$.next(orgId);
  }

  /**
   * Saves a new organization integration and updates the integrations$ observable
   * @param organizationId id of the organization
   * @param service service type of the integration
   * @param url url of the service
   * @param bearerToken api token
   * @param index index in service
   */
  async saveHec(
    organizationId: OrganizationId,
    service: OrganizationIntegrationServiceType,
    url: string,
    bearerToken: string,
    index: string,
  ): Promise<HecModificationFailureReason> {
    if (organizationId != this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      const hecConfig = new HecConfiguration(url, bearerToken, service);
      const newIntegrationResponse = await this.integrationApiService.createOrganizationIntegration(
        organizationId,
        new OrganizationIntegrationRequest(OrganizationIntegrationType.Hec, hecConfig.toString()),
      );

      const newTemplate = new HecTemplate(index, service);
      const newIntegrationConfigResponse =
        await this.integrationConfigurationApiService.createOrganizationIntegrationConfiguration(
          organizationId,
          newIntegrationResponse.id,
          new OrganizationIntegrationConfigurationRequest(null, null, null, newTemplate.toString()),
        );

      const newIntegration = this.mapResponsesToOrganizationIntegration(
        newIntegrationResponse,
        newIntegrationConfigResponse,
      );
      if (newIntegration !== null) {
        this._integrations$.next([...this._integrations$.getValue(), newIntegration]);
      }
      return { mustBeOwner: false, success: true };
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return { mustBeOwner: true, success: false };
      }
      throw error;
    }
  }

  /**
   * Updates an existing organization integration and updates the integrations$ observable
   * @param organizationId id of the organization
   * @param OrganizationIntegrationId id of the organization integration
   * @param OrganizationIntegrationConfigurationId id of the organization integration configuration
   * @param service service type of the integration
   * @param url url of the service
   * @param bearerToken api token
   * @param index index in service
   */
  async updateHec(
    organizationId: OrganizationId,
    OrganizationIntegrationId: OrganizationIntegrationId,
    OrganizationIntegrationConfigurationId: OrganizationIntegrationConfigurationId,
    service: OrganizationIntegrationServiceType,
    url: string,
    bearerToken: string,
    index: string,
  ): Promise<HecModificationFailureReason> {
    if (organizationId != this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      const hecConfig = new HecConfiguration(url, bearerToken, service);
      const updatedIntegrationResponse =
        await this.integrationApiService.updateOrganizationIntegration(
          organizationId,
          OrganizationIntegrationId,
          new OrganizationIntegrationRequest(OrganizationIntegrationType.Hec, hecConfig.toString()),
        );

      const updatedTemplate = new HecTemplate(index, service);
      const updatedIntegrationConfigResponse =
        await this.integrationConfigurationApiService.updateOrganizationIntegrationConfiguration(
          organizationId,
          OrganizationIntegrationId,
          OrganizationIntegrationConfigurationId,
          new OrganizationIntegrationConfigurationRequest(
            null,
            null,
            null,
            updatedTemplate.toString(),
          ),
        );

      const updatedIntegration = this.mapResponsesToOrganizationIntegration(
        updatedIntegrationResponse,
        updatedIntegrationConfigResponse,
      );

      if (updatedIntegration !== null) {
        this._integrations$.next([...this._integrations$.getValue(), updatedIntegration]);
      }
      return { mustBeOwner: false, success: true };
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return { mustBeOwner: true, success: false };
      }
      throw error;
    }
  }

  async deleteHec(
    organizationId: OrganizationId,
    OrganizationIntegrationId: OrganizationIntegrationId,
    OrganizationIntegrationConfigurationId: OrganizationIntegrationConfigurationId,
  ): Promise<HecModificationFailureReason> {
    if (organizationId != this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      // delete the configuration first due to foreign key constraint
      await this.integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration(
        organizationId,
        OrganizationIntegrationId,
        OrganizationIntegrationConfigurationId,
      );

      // delete the integration
      await this.integrationApiService.deleteOrganizationIntegration(
        organizationId,
        OrganizationIntegrationId,
      );

      // update the local observable
      const updatedIntegrations = this._integrations$
        .getValue()
        .filter((i) => i.id !== OrganizationIntegrationId);
      this._integrations$.next(updatedIntegrations);

      return { mustBeOwner: false, success: true };
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return { mustBeOwner: true, success: false };
      }
      throw error;
    }
  }

  /**
   * Gets a OrganizationIntegration for an OrganizationIntegrationId
   * @param integrationId id of the integration
   * @returns OrganizationIntegration or null
   */
  // TODO: Move to base class when another service integration type is implemented
  async getIntegrationById(
    integrationId: OrganizationIntegrationId,
  ): Promise<OrganizationIntegration | null> {
    return await firstValueFrom(
      this.integrations$.pipe(
        map((integrations) => integrations.find((i) => i.id === integrationId) || null),
      ),
    );
  }

  /**
   * Gets a OrganizationIntegration for a service type
   * @param serviceType type of the service
   * @returns OrganizationIntegration or null
   */
  // TODO: Move to base class when another service integration type is implemented
  async getIntegrationByServiceType(
    serviceType: OrganizationIntegrationServiceType,
  ): Promise<OrganizationIntegration | null> {
    return await firstValueFrom(
      this.integrations$.pipe(
        map((integrations) => integrations.find((i) => i.serviceType === serviceType) || null),
      ),
    );
  }

  /**
   * Gets a OrganizationIntegrationConfigurations for an integration ID
   * @param integrationId id of the integration
   * @returns OrganizationIntegration array or null
   */
  // TODO: Move to base class when another service integration type is implemented
  async getIntegrationConfigurations(
    integrationId: OrganizationIntegrationId,
  ): Promise<OrganizationIntegrationConfiguration[] | null> {
    return await firstValueFrom(
      this.integrations$.pipe(
        map((integrations) => {
          const integration = integrations.find((i) => i.id === integrationId);
          return integration ? integration.integrationConfiguration : null;
        }),
      ),
    );
  }

  // TODO: Move to data models to be more explicit for future services
  private mapResponsesToOrganizationIntegration(
    integrationResponse: OrganizationIntegrationResponse,
    configurationResponse: OrganizationIntegrationConfigurationResponse,
  ): OrganizationIntegration | null {
    const hecConfig = this.convertToJson<HecConfiguration>(integrationResponse.configuration);
    const template = this.convertToJson<HecTemplate>(configurationResponse.template);

    if (!hecConfig || !template) {
      return null;
    }

    const integrationConfig = new OrganizationIntegrationConfiguration(
      configurationResponse.id,
      integrationResponse.id,
      null,
      null,
      "",
      template,
    );

    return new OrganizationIntegration(
      integrationResponse.id,
      integrationResponse.type,
      hecConfig.service,
      hecConfig,
      [integrationConfig],
    );
  }

  // Could possibly be moved to a base service. All services would then assume that the
  // integration configuration would always be an array and this hec specific service
  // would just assume a single entry.
  private setIntegrations(orgId: OrganizationId) {
    const results$ = zip(this.integrationApiService.getOrganizationIntegrations(orgId)).pipe(
      switchMap(([responses]) => {
        const integrations: OrganizationIntegration[] = [];
        const promises: Promise<void>[] = [];

        responses.forEach((integration) => {
          const promise = this.integrationConfigurationApiService
            .getOrganizationIntegrationConfigurations(orgId, integration.id)
            .then((response) => {
              // Hec events will only have one OrganizationIntegrationConfiguration
              const config = response[0];

              const orgIntegration = this.mapResponsesToOrganizationIntegration(
                integration,
                config,
              );

              if (orgIntegration !== null) {
                integrations.push(orgIntegration);
              }
            });
          promises.push(promise);
        });
        return Promise.all(promises).then(() => {
          return integrations;
        });
      }),
    );

    return results$;
  }

  // TODO: Move to base service when necessary
  convertToJson<T>(jsonString?: string): T | null {
    try {
      return JSON.parse(jsonString || "") as T;
    } catch {
      return null;
    }
  }
}

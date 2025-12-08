import {
  BehaviorSubject,
  firstValueFrom,
  map,
  Observable,
  Subject,
  switchMap,
  takeUntil,
  zip,
} from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

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

/**
 * Common result type for integration modification operations (save, update, delete).
 * Indicates whether the operation succeeded and if failure was due to insufficient permissions.
 */
export type IntegrationModificationResult = {
  mustBeOwner: boolean;
  success: boolean;
};

/**
 * Base class for organization integration services.
 * Provides common functionality for managing integrations with different external services.
 *
 * @template TConfig - The configuration type specific to the integration (e.g., HecConfiguration, DatadogConfiguration)
 * @template TTemplate - The template type specific to the integration (e.g., HecTemplate, DatadogTemplate)
 */
export abstract class BaseOrganizationIntegrationService<TConfig, TTemplate> {
  private organizationId$ = new BehaviorSubject<OrganizationId | null>(null);
  private _integrations$ = new BehaviorSubject<OrganizationIntegration[]>([]);
  private destroy$ = new Subject<void>();

  integrations$: Observable<OrganizationIntegration[]> = this._integrations$.asObservable();

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

  /**
   * The integration type that this service manages.
   * Must be implemented by child classes to specify their integration type.
   */
  protected abstract readonly integrationType: OrganizationIntegrationType;

  /**
   * Creates a configuration object specific to this integration type.
   * Must be implemented by child classes.
   *
   * @param args - Arguments needed to create the configuration
   * @returns The configuration object
   */
  protected abstract createConfiguration(...args: any[]): TConfig;

  /**
   * Creates a template object specific to this integration type.
   * Must be implemented by child classes.
   *
   * @param args - Arguments needed to create the template
   * @returns The template object
   */
  protected abstract createTemplate(...args: any[]): TTemplate;

  constructor(
    protected integrationApiService: OrganizationIntegrationApiService,
    protected integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
  ) {}

  /**
   * Sets the organization Id and triggers the retrieval of integrations for the given organization.
   * If the organization ID is the same as the current one, the operation is skipped.
   *
   * @param orgId - The organization ID to set
   */
  setOrganizationIntegrations(orgId: OrganizationId): void {
    if (orgId == this.organizationId$.getValue()) {
      return;
    }
    this._integrations$.next([]);
    this.organizationId$.next(orgId);
  }

  /**
   * Saves a new organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param config - The configuration object for this integration
   * @param template - The template object for this integration
   * @returns Promise with the result indicating success or failure reason
   */
  protected async save(
    organizationId: OrganizationId,
    config: TConfig,
    template: TTemplate,
  ): Promise<IntegrationModificationResult> {
    if (organizationId != this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      const configString = (config as any).toString();
      const newIntegrationResponse = await this.integrationApiService.createOrganizationIntegration(
        organizationId,
        new OrganizationIntegrationRequest(this.integrationType, configString),
      );

      const templateString = (template as any).toString();
      const newIntegrationConfigResponse =
        await this.integrationConfigurationApiService.createOrganizationIntegrationConfiguration(
          organizationId,
          newIntegrationResponse.id,
          new OrganizationIntegrationConfigurationRequest(null, null, null, templateString),
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
   * Updates an existing organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @param config - The updated configuration object
   * @param template - The updated template object
   * @returns Promise with the result indicating success or failure reason
   */
  protected async update(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
    config: TConfig,
    template: TTemplate,
  ): Promise<IntegrationModificationResult> {
    if (organizationId != this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      const configString = (config as any).toString();
      const updatedIntegrationResponse =
        await this.integrationApiService.updateOrganizationIntegration(
          organizationId,
          integrationId,
          new OrganizationIntegrationRequest(this.integrationType, configString),
        );

      const templateString = (template as any).toString();
      const updatedIntegrationConfigResponse =
        await this.integrationConfigurationApiService.updateOrganizationIntegrationConfiguration(
          organizationId,
          integrationId,
          configurationId,
          new OrganizationIntegrationConfigurationRequest(null, null, null, templateString),
        );

      const updatedIntegration = this.mapResponsesToOrganizationIntegration(
        updatedIntegrationResponse,
        updatedIntegrationConfigResponse,
      );

      if (updatedIntegration !== null) {
        const unchangedIntegrations = this._integrations$
          .getValue()
          .filter((i) => i.id !== integrationId);
        this._integrations$.next([...unchangedIntegrations, updatedIntegration]);
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
   * Deletes an organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @returns Promise with the result indicating success or failure reason
   */
  protected async delete(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
  ): Promise<IntegrationModificationResult> {
    if (organizationId != this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      // delete the configuration first due to foreign key constraint
      await this.integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration(
        organizationId,
        integrationId,
        configurationId,
      );

      // delete the integration
      await this.integrationApiService.deleteOrganizationIntegration(organizationId, integrationId);

      // update the local observable
      const updatedIntegrations = this._integrations$
        .getValue()
        .filter((i) => i.id !== integrationId);
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
   * Gets an OrganizationIntegration by its ID.
   *
   * @param integrationId - ID of the integration
   * @returns Promise resolving to the OrganizationIntegration or null if not found
   */
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
   * Gets an OrganizationIntegration by its service type.
   *
   * @param serviceType - Type of the service
   * @returns Promise resolving to the OrganizationIntegration or null if not found
   */
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
   * Gets all OrganizationIntegrationConfigurations for a given integration ID.
   *
   * @param integrationId - ID of the integration
   * @returns Promise resolving to an array of OrganizationIntegrationConfiguration or null
   */
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

  /**
   * Maps API responses to an OrganizationIntegration domain model.
   *
   * @param integrationResponse - The integration response from the API
   * @param configurationResponse - The configuration response from the API
   * @returns OrganizationIntegration or null if mapping fails
   */
  private mapResponsesToOrganizationIntegration(
    integrationResponse: OrganizationIntegrationResponse,
    configurationResponse: OrganizationIntegrationConfigurationResponse,
  ): OrganizationIntegration | null {
    const config = this.convertToJson<TConfig>(integrationResponse.configuration);
    const template = this.convertToJson<TTemplate>(configurationResponse.template);

    if (!config || !template) {
      return null;
    }

    const integrationConfig = new OrganizationIntegrationConfiguration(
      configurationResponse.id,
      integrationResponse.id,
      null,
      null,
      "",
      template as any,
    );

    return new OrganizationIntegration(
      integrationResponse.id,
      integrationResponse.type,
      (config as any).service,
      config as any,
      [integrationConfig],
    );
  }

  /**
   * Fetches integrations for the given organization from the API.
   *
   * @param orgId - Organization ID to fetch integrations for
   * @returns Observable of OrganizationIntegration array
   */
  private setIntegrations(orgId: OrganizationId): Observable<OrganizationIntegration[]> {
    const results$ = zip(this.integrationApiService.getOrganizationIntegrations(orgId)).pipe(
      switchMap(([responses]) => {
        const integrations: OrganizationIntegration[] = [];
        const promises: Promise<void>[] = [];

        responses.forEach((integration) => {
          if (integration.type === this.integrationType) {
            const promise = this.integrationConfigurationApiService
              .getOrganizationIntegrationConfigurations(orgId, integration.id)
              .then((response) => {
                // Integration will only have one OrganizationIntegrationConfiguration
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
          }
        });
        return Promise.all(promises).then(() => {
          return integrations;
        });
      }),
    );

    return results$;
  }

  /**
   * Converts a JSON string to a typed object.
   *
   * @param jsonString - JSON string to parse
   * @returns Parsed object of type T or null if parsing fails
   */
  protected convertToJson<T>(jsonString?: string): T | null {
    try {
      return JSON.parse(jsonString || "") as T;
    } catch {
      return null;
    }
  }
}

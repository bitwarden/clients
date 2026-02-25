import { BehaviorSubject, map, Observable, of, switchMap, tap, zip } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

import {
  OrgIntegrationBuilder,
  OrgIntegrationConfiguration,
  OrgIntegrationTemplate,
} from "../models/integration-builder";
import { OrganizationIntegration } from "../models/organization-integration";
import { OrganizationIntegrationConfiguration } from "../models/organization-integration-configuration";
import { OrganizationIntegrationConfigurationRequest } from "../models/organization-integration-configuration-request";
import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";
import { OrganizationIntegrationRequest } from "../models/organization-integration-request";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";
/**
 * Common result type for integration modification operations (save, update, delete).
 * was the server side failure due to insufficient permissions (must be owner)?
 */
export type IntegrationModificationResult = {
  mustBeOwner: boolean;
  success: boolean;
  organizationIntegrationResult?: OrganizationIntegration | undefined;
};

/**
 * Provides common functionality for managing integrations with different external services.
 */
export class OrganizationIntegrationService {
  private organizationId$ = new BehaviorSubject<OrganizationId | null>(null);
  private _integrations$ = new BehaviorSubject<OrganizationIntegration[]>([]);

  integrations$: Observable<OrganizationIntegration[]> = this._integrations$.asObservable();

  constructor(
    protected integrationApiService: OrganizationIntegrationApiService,
    protected integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
  ) {}

  /**
   * Sets the organization Id and triggers the retrieval of integrations for the given organization.
   * The integrations will be available via the integrations$ observable.
   * If the organization ID is the same as the current one, no action is taken.
   * Use this method to kick off loading integrations for a specific organization.
   * Use integrations$ to subscribe to the loaded integrations.
   *
   * @param orgId - The organization ID to set
   * @returns Observable<void> that completes when the operation is done. Subscribe to trigger the load.
   */
  setOrganizationId(orgId: OrganizationId): Observable<void> {
    if (orgId === this.organizationId$.getValue()) {
      return of(void 0);
    }
    this._integrations$.next([]);
    this.organizationId$.next(orgId);

    // subscribe to load and set integrations
    // use integrations$ to get the loaded integrations
    return this.setIntegrations(orgId).pipe(
      tap((integrations) => {
        this._integrations$.next(integrations);
      }),
      map((): void => void 0),
    );
  }

  /**
   * Saves a new organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationType - Type of the organization integration
   * @param config - The configuration object for this integration
   * @param template - The template object for this integration
   * @returns Promise with the result indicating success or failure reason
   */
  async save(
    organizationId: OrganizationId,
    integrationType: OrganizationIntegrationType,
    config: OrgIntegrationConfiguration,
    template: OrgIntegrationTemplate,
  ): Promise<IntegrationModificationResult> {
    if (organizationId !== this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      const configString = config.toString();
      const newIntegrationResponse = await this.integrationApiService.createOrganizationIntegration(
        organizationId,
        new OrganizationIntegrationRequest(integrationType, configString),
      );

      const templateString = template.toString();
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
      return {
        mustBeOwner: false,
        success: newIntegration !== null,
        organizationIntegrationResult: newIntegration ?? undefined,
      };
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return { mustBeOwner: true, success: false, organizationIntegrationResult: undefined };
      }
      throw error;
    }
  }

  /**
   * Updates an existing organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param integrationType - Type of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @param config - The updated configuration object
   * @param template - The updated template object
   * @returns Promise with the result indicating success or failure reason
   */
  async update(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    integrationType: OrganizationIntegrationType,
    configurationId: OrganizationIntegrationConfigurationId,
    config: OrgIntegrationConfiguration,
    template: OrgIntegrationTemplate,
  ): Promise<IntegrationModificationResult> {
    if (organizationId !== this.organizationId$.getValue()) {
      throw new Error("Organization ID mismatch");
    }

    try {
      const configString = config.toString();
      const updatedIntegrationResponse =
        await this.integrationApiService.updateOrganizationIntegration(
          organizationId,
          integrationId,
          new OrganizationIntegrationRequest(integrationType, configString),
        );

      const templateString = template.toString();
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
        const integrations = this._integrations$.getValue();
        const index = integrations.findIndex((i) => i.id === integrationId);
        if (index !== -1) {
          integrations[index] = updatedIntegration;
        } else {
          integrations.push(updatedIntegration);
        }
        this._integrations$.next([...integrations]);
      }
      return {
        mustBeOwner: false,
        success: updatedIntegration !== null,
        organizationIntegrationResult: updatedIntegration ?? undefined,
      };
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return { mustBeOwner: true, success: false, organizationIntegrationResult: undefined };
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
  async delete(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
  ): Promise<IntegrationModificationResult> {
    if (organizationId !== this.organizationId$.getValue()) {
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

      return { mustBeOwner: false, success: true, organizationIntegrationResult: undefined };
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === 404) {
        return { mustBeOwner: true, success: false, organizationIntegrationResult: undefined };
      }
      throw error;
    }
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
    const integrationType = integrationResponse.type;
    const config = OrgIntegrationBuilder.buildConfiguration(
      integrationType,
      integrationResponse.configuration,
    );
    const template = OrgIntegrationBuilder.buildTemplate(
      integrationType,
      configurationResponse.template ?? "{}",
    );

    if (!config || !template) {
      return null;
    }

    const integrationConfig = new OrganizationIntegrationConfiguration(
      configurationResponse.id,
      integrationResponse.id,
      null,
      "",
      template,
    );

    return new OrganizationIntegration(
      integrationResponse.id,
      integrationResponse.type,
      config.bw_serviceName,
      config,
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
        });
        return Promise.all(promises).then(() => {
          return integrations;
        });
      }),
    );

    return results$;
  }
}

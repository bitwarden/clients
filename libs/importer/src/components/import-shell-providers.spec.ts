import { Injector, Provider } from "@angular/core";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import {
  DefaultImportDestinationService,
  ImportCollectionServiceAbstraction,
  ImportDestinationCollections,
  ImportDestinationServiceAbstraction,
  OrganizationImportDestinationService,
} from "../services";

import { IMPORT_ORGANIZATION_ID_ROUTE_PARAM, importShellProviders } from "./import-shell-providers";

abstract class PersonalCollections implements ImportDestinationCollections {
  abstract decryptedCollections$: ImportDestinationCollections["decryptedCollections$"];
}

describe("importShellProviders destination service", () => {
  const organizationId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";

  const destinationServiceFor = (
    options: Parameters<typeof importShellProviders>[1],
    params: Record<string, string> = {},
  ) => {
    const injector = Injector.create({
      providers: [
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: PolicyService, useValue: mock<PolicyService>() },
        { provide: AccountService, useValue: mock<AccountService>({ activeAccount$: of(null) }) },
        { provide: RestrictedItemTypesService, useValue: mock<RestrictedItemTypesService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        { provide: PersonalCollections, useValue: mock<ImportDestinationCollections>() },
        {
          provide: ImportCollectionServiceAbstraction,
          useValue: mock<ImportCollectionServiceAbstraction>(),
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(params) } },
        },
        ...(importShellProviders(PersonalCollections, options) as Provider[]),
      ],
    });
    return injector.get(ImportDestinationServiceAbstraction);
  };

  it("is the personal service when no organization collections are passed", () => {
    expect(destinationServiceFor(undefined)).toBeInstanceOf(DefaultImportDestinationService);
  });

  it("is the personal service when the route has no organization", () => {
    const service = destinationServiceFor({
      organizationCollections: ImportCollectionServiceAbstraction,
    });

    expect(service).toBeInstanceOf(DefaultImportDestinationService);
  });

  it("is the organization-locked service when the route has an organization", () => {
    const service = destinationServiceFor(
      { organizationCollections: ImportCollectionServiceAbstraction },
      { [IMPORT_ORGANIZATION_ID_ROUTE_PARAM]: organizationId },
    );

    expect(service).toBeInstanceOf(OrganizationImportDestinationService);
  });

  it("rejects a route organization that is not an id, rather than importing somewhere else", () => {
    expect(() =>
      destinationServiceFor(
        { organizationCollections: ImportCollectionServiceAbstraction },
        { [IMPORT_ORGANIZATION_ID_ROUTE_PARAM]: "not-an-id" },
      ),
    ).toThrow("Invalid OrganizationId");
  });
});

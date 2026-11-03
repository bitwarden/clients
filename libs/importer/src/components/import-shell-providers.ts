import { ActivatedRoute } from "@angular/router";

import { safeProvider, SafeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { isId, OrganizationId } from "@bitwarden/common/types/guid";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import {
  DefaultImportDestinationService,
  ImportCollectionServiceAbstraction,
  ImportDestinationCollections,
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
  OrganizationImportDestinationService,
} from "../services";

import { ImportShellStagingService } from "./import-shell-staging.service";

/** The route param that makes an import an organization's own, from its admin console. */
export const IMPORT_ORGANIZATION_ID_ROUTE_PARAM = "organizationId";

/** Providers shared by the progress bar, credential parsing and location selection. Each app's
 *  import shell provides them so the state lives only as long as the shell: the hand-off between
 *  the screens holds decrypted vault data.
 *
 *  `collectionService` is passed in because the importer can't import admin-console.
 *
 *  Passing `organizationCollections` makes the location step depend on the route: with an
 *  `organizationId` it offers only that organization, from its admin collections; without one it is
 *  the personal location step. */
export const importShellProviders = (
  collectionService: abstract new (...args: any) => ImportDestinationCollections,
  options: {
    organizationCollections?: abstract new (...args: any) => ImportCollectionServiceAbstraction;
  } = {},
): SafeProvider[] => [
  options.organizationCollections == null
    ? safeProvider({
        provide: ImportDestinationServiceAbstraction,
        useClass: DefaultImportDestinationService,
        deps: [
          OrganizationService,
          collectionService,
          PolicyService,
          AccountService,
          RestrictedItemTypesService,
          I18nService,
        ],
      })
    : safeProvider({
        provide: ImportDestinationServiceAbstraction,
        useFactory: (
          route: ActivatedRoute,
          organizationService: OrganizationService,
          collections: ImportDestinationCollections,
          policyService: PolicyService,
          accountService: AccountService,
          restrictedItemTypesService: RestrictedItemTypesService,
          i18nService: I18nService,
          organizationCollections: ImportCollectionServiceAbstraction,
        ): ImportDestinationServiceAbstraction => {
          const organizationId = route.snapshot.paramMap.get(IMPORT_ORGANIZATION_ID_ROUTE_PARAM);
          if (organizationId == null) {
            return new DefaultImportDestinationService(
              organizationService,
              collections,
              policyService,
              accountService,
              restrictedItemTypesService,
              i18nService,
            );
          }
          if (!isId<OrganizationId>(organizationId)) {
            throw new Error(
              `Invalid OrganizationId provided in route parameter \`${IMPORT_ORGANIZATION_ID_ROUTE_PARAM}\``,
            );
          }
          return new OrganizationImportDestinationService(
            organizationId,
            organizationService,
            organizationCollections,
            accountService,
            restrictedItemTypesService,
            i18nService,
            policyService,
            collections,
          );
        },
        deps: [
          ActivatedRoute,
          OrganizationService,
          collectionService,
          PolicyService,
          AccountService,
          RestrictedItemTypesService,
          I18nService,
          options.organizationCollections,
        ],
      }),
  safeProvider({
    provide: ImportStagingServiceAbstraction,
    useClass: ImportShellStagingService,
    deps: [],
  }),
];

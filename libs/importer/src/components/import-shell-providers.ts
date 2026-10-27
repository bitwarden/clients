import { safeProvider, SafeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";

import {
  DefaultImportDestinationService,
  ImportDestinationCollections,
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
} from "../services";

import { ImportShellStagingService } from "./import-shell-staging.service";

/** Providers shared by the progress bar, credential parsing and location selection. Each app's
 *  import shell provides them so the state lives only as long as the shell: the hand-off between
 *  the screens holds decrypted vault data.
 *
 *  `collectionService` is passed in because the importer can't import admin-console. */
export const importShellProviders = (
  collectionService: abstract new (...args: any) => ImportDestinationCollections,
): SafeProvider[] => [
  safeProvider({
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
  }),
  safeProvider({
    provide: ImportStagingServiceAbstraction,
    useClass: ImportShellStagingService,
    deps: [],
  }),
];

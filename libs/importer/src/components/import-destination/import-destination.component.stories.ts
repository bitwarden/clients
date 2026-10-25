import { applicationConfig, Decorator, Meta, StoryObj } from "@storybook/angular";
import { defer, NEVER, Observable, of, throwError } from "rxjs";

import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";

import {
  ImportDestinationKind,
  ImportDestinationOption,
  ImportDestinations,
  ImportResult,
} from "../../models";
import {
  DefaultImportStagingService,
  ImportDestinationServiceAbstraction,
  ImportStagingServiceAbstraction,
  ImportUpgradeServiceAbstraction,
} from "../../services";

import { ImportDestinationComponent } from "./import-destination.component";

const sharedFolder = (id: string, orgId: string, name: string): CollectionView => {
  const view = new CollectionView({
    id: id as CollectionId,
    organizationId: orgId as OrganizationId,
    name,
  });
  view.manage = true;
  return view;
};

const myVault: ImportDestinationOption = {
  id: "myVault",
  kind: ImportDestinationKind.MyVault,
  sharedFolders: [],
  restrictions: [],
};

const organization = (
  id: string,
  name: string,
  extra: Partial<ImportDestinationOption> = {},
): ImportDestinationOption => ({
  id: `organization:${id}`,
  kind: ImportDestinationKind.Organization,
  organizationId: id as OrganizationId,
  organizationName: name,
  productTierType: ProductTierType.Enterprise,
  sharedFolders: [],
  restrictions: [],
  ...extra,
});

const myItems = (orgId: string, name: string): ImportDestinationOption => {
  const defaultCollection = sharedFolder(`my-${orgId}`, orgId, "My items");
  defaultCollection.type = CollectionTypes.DefaultUserCollection;
  return {
    id: `myItems:${orgId}`,
    kind: ImportDestinationKind.MyItems,
    organizationId: orgId as OrganizationId,
    organizationName: name,
    defaultCollection,
    sharedFolders: [],
    restrictions: [],
  };
};

const ready = (options: ImportDestinationOption[]): Observable<ImportDestinations> =>
  of({ options, hasStep: true });

/** Set by each story's decorator before the component renders. */
let destinations$: () => Observable<ImportDestinations> = () => ready([myVault]);

const withDestinations =
  (source: () => Observable<ImportDestinations>): Decorator =>
  (storyFn, context) => {
    destinations$ = source;
    const staged = new ImportResult();
    staged.success = true;
    staged.ciphers = [new CipherView()];
    stagingService.stage({ kind: "parsed", importType: "dashlane", result: staged });
    return storyFn(context);
  };

const stagingService = new DefaultImportStagingService();

const destinationService = {
  destinations$: defer(() => destinations$()),
  importableCount: async () => 74,
  hasUnassignedItems: async () => false,
} as unknown as ImportDestinationServiceAbstraction;

const importService = {
  importImportResult: async (result: ImportResult) => result,
} as unknown as ImportUpgradeServiceAbstraction;

export default {
  title: "Tools/Import/Destination",
  component: ImportDestinationComponent,
  decorators: [
    applicationConfig({
      providers: [
        { provide: ImportDestinationServiceAbstraction, useValue: destinationService },
        { provide: ImportStagingServiceAbstraction, useValue: stagingService },
        { provide: ImportUpgradeServiceAbstraction, useValue: importService },
        {
          provide: DialogService,
          useValue: { openSimpleDialog: async () => true, open: () => ({ closed: of(undefined) }) },
        },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: SyncService, useValue: { fullSync: async () => true } },
        { provide: LogService, useValue: { error: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              selectAVaultTitle: "Select a vault",
              selectALocationTitle: "Select a location",
              importDestinationDescription: "Choose where to import these items.",
              myVault: "My vault",
              importMyItemsOption: "My items",
              importVisibleOnlyToYou: "Visible only to you",
              importMyItemsOwnedBy: (org?: string) => `Owned by ${org}, but visible only to you`,
              importOrganizationVault: "Organization vault",
              importMoveAllItemsIntoSharedFolderA: (org?: string) =>
                `Move all items into a ${org} shared folder`,
              importMoveAllItemsIntoSharedFolderAn: (org?: string) =>
                `Move all items into an ${org} shared folder`,
              sharedFolder: "Shared folder",
              importSharedFolderHint:
                "Move everything to a parent folder, the nested folder structure will be maintained",
              importSharedFolderRequired: "A shared folder is required.",
              importItemsCount: (count?: string) => `Import ${count} items`,
              importItemsSingular: "Import 1 item",
              importVerb: "Import",
              importItemTypesRestricted: (org?: string, types?: string) =>
                `${org} doesn’t allow you to import ${types}. If they are in your import, they will be skipped.`,
              importRestrictedTypeLogin: "logins",
              importRestrictedTypeSecureNote: "secure notes",
              importRestrictedTypeCard: "cards",
              importRestrictedTypeIdentity: "identities",
              importRestrictedTypeSshKey: "SSH keys",
              importRestrictedTypeBankAccount: "bank accounts",
              importRestrictedTypeDriversLicense: "licenses",
              importRestrictedTypePassport: "passports",
              learnMore: "Learn more",
              back: "Back",
              errorOccurred: "An error has occurred.",
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/XSVfwUs74g0353SKulKmWN/Import?node-id=6358-68495",
    },
  },
} as Meta<ImportDestinationComponent>;

type Story = StoryObj<ImportDestinationComponent>;

/** No policies: My vault first; the first card is selected. */
export const MyVaultAndOrganization: Story = {
  decorators: [
    withDestinations(() =>
      ready([
        myVault,
        organization("a", "Acme Co", {
          sharedFolders: [sharedFolder("f1", "a", "Engineering"), sharedFolder("f2", "a", "Sales")],
        }),
      ]),
    ),
  ],
};

/** Select the organization card to show the shared-folder checkbox, then check it for the dropdown. */
export const OrganizationWithSharedFolders: Story = {
  decorators: [
    withDestinations(() =>
      ready([
        myVault,
        organization("a", "Acme Co", { sharedFolders: [sharedFolder("f1", "a", "Engineering")] }),
        organization("b", "Beta Family", {
          productTierType: ProductTierType.Families,
          sharedFolders: [sharedFolder("f2", "b", "Home")],
        }),
      ]),
    ),
  ],
};

/** Centralized ownership, one org: no My vault card, My items first ("Select a location"). */
export const CentralizedOwnershipOneOrganization: Story = {
  decorators: [
    withDestinations(() => ready([myItems("a", "Acme Co"), organization("a", "Acme Co")])),
  ],
};

/** Centralized ownership, two orgs: a My items card sits directly before each org. */
export const CentralizedOwnershipTwoOrganizations: Story = {
  decorators: [
    withDestinations(() =>
      ready([
        myItems("a", "Acme Co"),
        organization("a", "Acme Co"),
        myItems("b", "Beta Co"),
        organization("b", "Beta Co"),
      ]),
    ),
  ],
};

/** My vault with an org that removes item types: one callout per restricting org. */
export const RestrictedItemTypesOnMyVault: Story = {
  decorators: [
    withDestinations(() =>
      ready([
        {
          ...myVault,
          restrictions: [
            { organizationName: "Acme Co", types: [CipherType.Card] },
            { organizationName: "Beta Co", types: [CipherType.Passport, CipherType.Identity] },
          ],
        },
        organization("a", "Acme Co"),
      ]),
    ),
  ],
};

/** Both policies: My items in an org that also restricts three item types. */
export const CentralizedOwnershipWithRestrictions: Story = {
  decorators: [
    withDestinations(() =>
      ready([
        {
          ...myItems("a", "Acme Co"),
          restrictions: [
            {
              organizationName: "Acme Co",
              types: [CipherType.Card, CipherType.Identity, CipherType.BankAccount],
            },
          ],
        },
        organization("a", "Acme Co"),
      ]),
    ),
  ],
};

/** Destinations still loading: spinner, Import disabled. */
export const Loading: Story = {
  decorators: [withDestinations(() => NEVER)],
};

/** The destination lookup failed: Import stays disabled. */
export const LookupFailed: Story = {
  decorators: [withDestinations(() => throwError(() => new Error("lookup failed")))],
};

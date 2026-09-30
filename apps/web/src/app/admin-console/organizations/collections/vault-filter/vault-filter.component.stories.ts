import { importProvidersFrom, signal } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CipherTypeFilter,
  VaultFilter,
  VaultFilterServiceAbstraction,
  Vfo1TerminologyService,
} from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../../core/tests";
import { CoachmarkService } from "../../../../vault/components/coachmark";

import { VaultFilterComponent } from "./vault-filter.component";
import { VaultFilterModule } from "./vault-filter.module";

function mockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1" as OrganizationId,
    name: "Acme Corp",
    enabled: true,
    ...overrides,
  } as unknown as Organization;
}

function mockTypeTree(
  head: CipherTypeFilter,
  items: CipherTypeFilter[],
): TreeNode<CipherTypeFilter> {
  const root = new TreeNode<CipherTypeFilter>(
    head,
    undefined as unknown as TreeNode<CipherTypeFilter>,
  );
  root.children = items.map(
    (item) =>
      new TreeNode<CipherTypeFilter>(item, undefined as unknown as TreeNode<CipherTypeFilter>),
  );
  return root;
}

/**
 * Mirrors the default (no feature flags) list `VaultFilterService.cipherTypeFilters$` emits.
 * `name` is pre-translated (not piped through `| i18n` in the template), matching how the real
 * service calls `i18nService.t(...)` before storing the filter.
 */
const mockCipherTypeFilters: CipherTypeFilter[] = [
  { id: "login", name: "Login", type: CipherType.Login, icon: "bwi-globe" },
  { id: "card", name: "Card", type: CipherType.Card, icon: "bwi-credit-card" },
  { id: "identity", name: "Identity", type: CipherType.Identity, icon: "bwi-id-card" },
  { id: "note", name: "Secure note", type: CipherType.SecureNote, icon: "bwi-sticky-note" },
  { id: "sshKey", name: "SSH key", type: CipherType.SshKey, icon: "bwi-key" },
];

const mockVaultFilterService: Partial<VaultFilterServiceAbstraction> = {
  setOrganizationFilter: () => {},
  buildTypeTree: (head, array) => of(mockTypeTree(head, array)),
  cipherTypeFilters$: of(mockCipherTypeFilters),
  collapsedFilterNodes$: of(new Set<string>()),
  setCollapsedFilterNodes: () => Promise.resolve(),
};

const mockRestrictedItemTypesService: Partial<RestrictedItemTypesService> = {
  restricted$: of([]),
};

/** Avoids constructing the real service, which needs OrganizationService/StateProvider/etc. */
const mockCoachmarkService: Partial<CoachmarkService> = {
  activeStepId: signal(null),
  currentStepNumber: signal(0),
  totalSteps: signal(0),
  isStepActive: () => false,
  getStepPosition: () => undefined,
  getStepTitle: () => "",
  getStepDescription: () => "",
  getStepLearnMoreUrl: () => undefined,
  previousStep: () => Promise.resolve(),
  nextStep: () => Promise.resolve(),
  completeTour: () => Promise.resolve(),
};

const mockAccountService: Partial<AccountService> = {
  activeAccount$: of({
    id: "user-1",
    email: "user@example.com",
    name: "Story User",
    emailVerified: true,
  }) as unknown as AccountService["activeAccount$"],
};

const mockVfo1TerminologyService: Partial<Vfo1TerminologyService> = {
  enabled: signal(false),
  iconClass: (iconClass) => iconClass,
};

type StoryArgs = {
  activeFilter: VaultFilter;
  organization: Organization;
  searchText: string;
  ciphers$: typeof of<CipherView[]>;
};

const render: StoryObj<StoryArgs>["render"] = (args) => ({
  props: {
    ...args,
    ciphers$: of([] as CipherView[]),
  },
  template: `
    <app-organization-vault-filter
      [activeFilter]="activeFilter"
      [organization]="organization"
      [ciphers$]="ciphers$"
      [searchText]="searchText"
    ></app-organization-vault-filter>
  `,
});

export default {
  title: "Admin Console/Organizations/Collections/Vault Filter",
  component: VaultFilterComponent,
  args: {
    activeFilter: new VaultFilter(),
    organization: mockOrganization(),
    searchText: "",
  },
  decorators: [
    moduleMetadata({
      imports: [VaultFilterModule],
      providers: [
        { provide: VaultFilterServiceAbstraction, useValue: mockVaultFilterService },
        { provide: RestrictedItemTypesService, useValue: mockRestrictedItemTypesService },
        { provide: Vfo1TerminologyService, useValue: mockVfo1TerminologyService },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        { provide: CoachmarkService, useValue: mockCoachmarkService },
        { provide: AccountService, useValue: mockAccountService },
      ],
    }),
  ],
} satisfies Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

/** Loaded state — search box plus type/collection/trash filter sections built from the mocked tree. */
export const Default: Story = { render };

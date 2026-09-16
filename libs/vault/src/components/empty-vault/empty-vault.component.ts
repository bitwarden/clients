import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  Signal,
} from "@angular/core";

import {
  BitSvg,
  VaultIcon,
  BusinessWelcome,
  SearchFolder,
  EmptyTrash,
} from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultScope, VaultScopeType } from "../../models/vault-scope";
import {
  VAULT_FILTER_KEYS,
  VaultItemsTableFilters,
} from "../vault-items-table/vault-items-table-filter-keys";

interface EmptyVaultProperties {
  /** The key representing the specific empty vault state. */
  key: EMPTY_VAULT_STATE;
  /** Icon associated with the empty vault state. */
  icon?: BitSvg;
  /** Title associated with the empty vault state, already localized. */
  title?: string;
  /** Description associated with the empty vault state, already localized. */
  description?: string;
}

const EMPTY_VAULT_STATE = {
  noSearchMatches: "noSearchMatches",
  noFilterMatches: "noFilterMatches",
  emptyPersonalVault: "emptyPersonalVault",
  emptyOrgVault: "emptyOrgVault",
  emptySharedFolder: "emptySharedFolder",
  emptyMultipleVaults: "emptyMultipleVaults",
  emptyTrash: "emptyTrash",
  emptyArchive: "emptyArchive",
  emptyMyItems: "emptyMyItems",
} as const;
type EMPTY_VAULT_STATE = (typeof EMPTY_VAULT_STATE)[keyof typeof EMPTY_VAULT_STATE];

/**
 * The empty state shown by the vault items table when there are no rows to display — either because
 * the vault is genuinely empty, or because the active filters exclude every item.
 *
 * Purely presentational: every fact it needs — the live filter values, and the vault scope's
 * name/kind — is supplied by the host as an input, and clearing search or filters is delegated
 * back to the host as an output. It has no dependency on where in the app it is used, so it needs
 * no router, account, or table context to render or to test.
 */
@Component({
  selector: "vault-empty-vault",
  templateUrl: "./empty-vault.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, StatusLockupComponent, SvgComponent, I18nPipe],
})
export class EmptyVaultComponent {
  private readonly i18nService = inject(I18nService);

  /** Whether the vault has any items at all, ignoring any search or filters. */
  readonly hasItems = input.required<boolean>();

  /** The host table's combined filter-chip values, if any. */
  readonly filterValues = input<VaultItemsTableFilters>({});

  /** The vault scope, used to determine which empty state to show. */
  readonly scope = input<VaultScope>();

  /** The organization the current vault scope names, for an organization vault. */
  readonly organizationName = input<string>();

  /** The default collection ID for the current vault scope, if any. */
  readonly defaultCollectionId = input<string>();

  /** Whether the account has more than one vault (personal + at least one org). */
  readonly hasMultipleVaults = input(false);

  /** The shared folder the current vault scope has drilled into, when it has. */
  readonly sharedFolderName = input<string>();

  /** Emitted when the user asks to clear the active search term. */
  readonly clearSearch = output<void>();

  /** Emitted when the user asks to clear the active filter chips. */
  readonly clearFilters = output<void>();

  protected readonly EMPTY_VAULT_STATE = EMPTY_VAULT_STATE;

  protected readonly addItemEmptyStates: EMPTY_VAULT_STATE[] = [
    EMPTY_VAULT_STATE.emptyPersonalVault,
    EMPTY_VAULT_STATE.emptyOrgVault,
    EMPTY_VAULT_STATE.emptyMultipleVaults,
    EMPTY_VAULT_STATE.emptySharedFolder,
    EMPTY_VAULT_STATE.emptyMyItems,
  ];

  protected readonly emptyStateProperties: Signal<EmptyVaultProperties | null> = computed(() => {
    const emptyVaultState = this.emptyVaultState();

    if (!emptyVaultState) {
      return null;
    }

    const emptyVaultProperties = this.getEmptyVaultProperties();

    return emptyVaultProperties.find((prop) => prop.key === emptyVaultState) || null;
  });

  private readonly emptyVaultState: Signal<EMPTY_VAULT_STATE | null> = computed(() => {
    const filterValues = this.filterValues();
    const hasItems = this.hasItems();
    if (hasItems && filterValues[VAULT_FILTER_KEYS.search]) {
      return EMPTY_VAULT_STATE.noSearchMatches;
    }
    if (
      hasItems &&
      !filterValues[VAULT_FILTER_KEYS.search] &&
      Object.values(filterValues).filter(Boolean).length > 0
    ) {
      return EMPTY_VAULT_STATE.noFilterMatches;
    }

    const scope = this.scope();
    if (!scope) {
      return null;
    }

    switch (scope.type) {
      case VaultScopeType.Trash:
        return EMPTY_VAULT_STATE.emptyTrash;
      case VaultScopeType.Archive:
        return EMPTY_VAULT_STATE.emptyArchive;
      case VaultScopeType.MyVault:
        return EMPTY_VAULT_STATE.emptyPersonalVault;
      case VaultScopeType.Organization:
        return this.resolveOrgEmptyState(scope);
      case VaultScopeType.AllItems:
        if (this.hasMultipleVaults()) {
          return EMPTY_VAULT_STATE.emptyMultipleVaults;
        }
        return this.organizationName() ? EMPTY_VAULT_STATE.emptyOrgVault : null;
    }
  });

  private resolveOrgEmptyState(
    scope: Extract<VaultScope, { type: typeof VaultScopeType.Organization }>,
  ) {
    const myItemsId = this.defaultCollectionId();
    const isDefaultCollection = myItemsId != null && scope.collectionId === myItemsId;

    if (isDefaultCollection) {
      return EMPTY_VAULT_STATE.emptyMyItems;
    } else if (this.sharedFolderName()) {
      return EMPTY_VAULT_STATE.emptySharedFolder;
    }

    return EMPTY_VAULT_STATE.emptyOrgVault;
  }

  /**
   * Returns the variants of empty vaults.
   * Note: This is a function so that the translations are evaluated during each call, ensure replacement
   * values are up to date.
   */
  private getEmptyVaultProperties(): EmptyVaultProperties[] {
    return [
      {
        key: EMPTY_VAULT_STATE.emptyPersonalVault,
        icon: VaultIcon,
        title: this.i18nService.t("noItemsInMyVault"),
        description: this.i18nService.t("emptyVaultsDescription"),
      },
      {
        key: EMPTY_VAULT_STATE.emptyMultipleVaults,
        icon: VaultIcon,
        title: this.i18nService.t("noItemsInVaults"),
        description: this.i18nService.t("emptyVaultsDescription"),
      },
      {
        key: EMPTY_VAULT_STATE.emptyOrgVault,
        icon: BusinessWelcome,
        title: this.i18nService.t("noItemsInOrganizationVault", this.organizationName()),
        description: this.i18nService.t("emptyVaultsDescription"),
      },
      {
        key: EMPTY_VAULT_STATE.emptyMyItems,
        title: this.i18nService.t("emptyMyItems"),
        description: this.i18nService.t("emptyMyItemsDescription", this.organizationName()),
      },
      {
        key: EMPTY_VAULT_STATE.emptySharedFolder,
        icon: BusinessWelcome,
        title: this.i18nService.t("noItemsInSharedFolder", this.sharedFolderName()),
        description: this.i18nService.t("emptySharedFolderDescription", this.organizationName()),
      },
      {
        key: EMPTY_VAULT_STATE.emptyTrash,
        icon: EmptyTrash,
        title: this.i18nService.t("noItemsInTrash"),
        description: this.i18nService.t("noItemsInTrashDescription"),
      },
      {
        key: EMPTY_VAULT_STATE.emptyArchive,
        icon: VaultIcon,
        title: this.i18nService.t("noItemsInArchive"),
        description: this.i18nService.t("noItemsInArchiveDesc"),
      },
      {
        key: EMPTY_VAULT_STATE.noFilterMatches,
        icon: SearchFolder,
        title: this.i18nService.t("noItemsMatchSelectedFilters"),
      },
      {
        key: EMPTY_VAULT_STATE.noSearchMatches,
        icon: SearchFolder,
        title: this.i18nService.t(
          "noItemsMatchSearchTerm",
          this.filterValues()[VAULT_FILTER_KEYS.search],
        ),
      },
    ];
  }
}

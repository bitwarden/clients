import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { ButtonModule, CalloutComponent, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  CipherRowMenuHandlers,
  CipherRowMenuService,
  NewCipherMenuComponent,
  VaultBatchBarService,
  VaultItemsTableComponent,
  VaultItemsTableRowAction,
} from "@bitwarden/vault";

import { VaultItemEvent } from "../vault-items/vault-item-event";

@Component({
  selector: "app-vault-list-table",
  templateUrl: "./vault-list-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CalloutComponent,
    I18nPipe,
    LinkModule,
    NewCipherMenuComponent,
    VaultItemsTableComponent,
  ],
  host: {
    class: "tw-flex tw-flex-col",
  },
})
export class VaultListTableComponent<C extends CipherViewLike> {
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly cipherRowMenuService = inject(CipherRowMenuService);
  private readonly batchBarService = inject<VaultBatchBarService<C>>(VaultBatchBarService, {
    optional: true,
  });

  private readonly vaultItemsTable = viewChild(VaultItemsTableComponent);

  constructor() {
    this.batchBarService?.cleared$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.vaultItemsTable()?.clearSelection();
    });
  }

  readonly ciphers = input.required<C[]>();
  readonly folders = input<FolderView[]>([]);
  readonly collections = input<CollectionView[]>([]);
  readonly allCollections = input<CollectionView[]>([]);
  readonly organizations = input<Organization[]>([]);
  readonly loading = input<boolean>(false);
  readonly showPremiumCallout = input<boolean>(false);
  readonly canCreateCipher = input<boolean>(true);
  readonly showAddCipherBtn = input<boolean>(true);

  readonly onEvent = output<VaultItemEvent<C>>();
  readonly onAddCipher = output<CipherType>();
  readonly onAddFolder = output<void>();
  readonly onAddItemDialog = output<void>();
  readonly onImport = output<void>();

  private readonly cipherRowMenuHandlers = computed<CipherRowMenuHandlers<C>>(() => ({
    edit: (item) => this.onEvent.emit({ type: "editCipher", item }),
    clone: (item) => this.onEvent.emit({ type: "clone", item }),
    assignToCollections: (item) =>
      this.onEvent.emit({ type: "assignToCollections", items: [item] }),
  }));

  protected readonly rowActions = computed<VaultItemsTableRowAction<C>[]>(() =>
    this.cipherRowMenuService.getRowActions<C>(this.allCollections(), this.cipherRowMenuHandlers()),
  );

  protected readonly itemAction = (item: C): void =>
    this.onEvent.emit({ type: "viewCipher", item });

  protected handleSelectionChange(items: readonly C[]): void {
    if (!this.batchBarService) {
      return;
    }
    this.batchBarService.selection.clear();
    this.batchBarService.selection.select(...items.map((cipher) => ({ cipher })));
  }

  async navigateToGetPremium(): Promise<void> {
    await this.premiumUpgradePromptService.promptForPremium();
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  private readonly configService = inject(ConfigService);

  /**
   * Whether this client renders the bulk-actions bar. Desktop gates it on a second, desktop-only
   * flag that `VaultBatchBarService` doesn't know about, so the table has to be told — otherwise
   * it holds space for a bar the host never shows.
   */
  protected readonly showBulkBar = toSignal(
    combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM37785_VaultBatchBar),
      this.configService.getFeatureFlag$(FeatureFlag.PM37785_DesktopVaultBatchBar),
    ]).pipe(map(([batchBar, desktopBatchBar]) => batchBar && desktopBatchBar)),
    { initialValue: false },
  );

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

  async navigateToGetPremium(): Promise<void> {
    await this.premiumUpgradePromptService.promptForPremium();
  }
}

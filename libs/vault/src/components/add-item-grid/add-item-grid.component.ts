import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DIALOG_CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import {
  BitwardenIcon,
  IconComponent,
  ItemModule,
  TypographyModule,
  IconTileComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

type DialogItem = {
  icon: BitwardenIcon;
  labelKey: string;
  subtitleKey: string;
  action: () => void;
};

@Component({
  selector: "vault-add-item-grid",
  templateUrl: "./add-item-grid.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, I18nPipe, IconTileComponent, IconComponent, ItemModule, TypographyModule],
})
export class AddItemGridComponent {
  readonly canCreateFolder = input(false);
  readonly canCreateCollection = input(false);
  readonly canCreateSshKey = input(false);

  readonly cipherSelected = output<CipherType>();
  readonly folderSelected = output();
  readonly collectionSelected = output();

  private readonly restrictedTypes = toSignal(this.restrictedItemTypesService.restricted$, {
    initialValue: [] as RestrictedCipherType[],
  });

  protected readonly items = computed<DialogItem[]>(() => {
    const restrictedTypes = this.restrictedTypes();
    const items: DialogItem[] = DIALOG_CIPHER_MENU_ITEMS.filter((item) => {
      if (!this.canCreateSshKey() && item.type === CipherType.SshKey) {
        return false;
      }
      return !restrictedTypes.some((r) => r.cipherType === item.type);
    }).map((item) => ({
      icon: item.icon as BitwardenIcon,
      labelKey: item.labelKey,
      subtitleKey: item.subtitleKey,
      action: () => this.cipherSelected.emit(item.type),
    }));

    if (this.canCreateFolder()) {
      items.push({
        icon: "bwi-folder",
        labelKey: "folder",
        subtitleKey: "folderSubtitle",
        action: () => this.folderSelected.emit(),
      });
    }

    if (this.canCreateCollection()) {
      items.push({
        icon: "bwi-collection-shared",
        labelKey: "collection",
        subtitleKey: "collectionSubtitle",
        action: () => this.collectionSelected.emit(),
      });
    }

    return items;
  });

  constructor(private readonly restrictedItemTypesService: RestrictedItemTypesService) {}
}

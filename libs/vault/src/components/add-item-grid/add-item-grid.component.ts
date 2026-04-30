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

export const AddItemGridResult = Object.freeze({
  Cipher: "cipher",
  Folder: "folder",
  Collection: "collection",
} as const);

export type AddItemGridResult =
  | { result: typeof AddItemGridResult.Cipher; cipherType: CipherType }
  | { result: typeof AddItemGridResult.Folder }
  | { result: typeof AddItemGridResult.Collection };

type GridItem = {
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

  readonly itemSelected = output<AddItemGridResult>();

  private readonly restrictedTypes = toSignal(this.restrictedItemTypesService.restricted$, {
    initialValue: [] as RestrictedCipherType[],
  });

  protected readonly items = computed<GridItem[]>(() => {
    const restrictedTypes = this.restrictedTypes();
    const items: GridItem[] = DIALOG_CIPHER_MENU_ITEMS.filter((item) => {
      if (!this.canCreateSshKey() && item.type === CipherType.SshKey) {
        return false;
      }
      return !restrictedTypes.some((r) => r.cipherType === item.type);
    }).map((item) => ({
      icon: item.icon as BitwardenIcon,
      labelKey: item.labelKey,
      subtitleKey: item.subtitleKey,
      action: () =>
        this.itemSelected.emit({ result: AddItemGridResult.Cipher, cipherType: item.type }),
    }));

    if (this.canCreateFolder()) {
      items.push({
        icon: "bwi-folder",
        labelKey: "folder",
        subtitleKey: "folderSubtitle",
        action: () => this.itemSelected.emit({ result: AddItemGridResult.Folder }),
      });
    }

    if (this.canCreateCollection()) {
      items.push({
        icon: "bwi-collection-shared",
        labelKey: "collection",
        subtitleKey: "collectionSubtitle",
        action: () => this.itemSelected.emit({ result: AddItemGridResult.Collection }),
      });
    }

    return items;
  });

  constructor(private readonly restrictedItemTypesService: RestrictedItemTypesService) {}
}

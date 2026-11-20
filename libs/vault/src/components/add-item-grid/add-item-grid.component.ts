import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { take } from "rxjs";

import { CipherType } from "@bitwarden/common/vault/enums";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";
import { DIALOG_CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import {
  BadgeComponent,
  BitwardenIcon,
  IconComponent,
  ItemModule,
  TypographyModule,
  IconTileComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NewItemTypesAnnouncementService } from "../../services/new-item-types-announcement.service";
import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

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
  badged?: boolean;
  action: () => void;
};

@Component({
  selector: "vault-add-item-grid",
  templateUrl: "./add-item-grid.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    CommonModule,
    I18nPipe,
    IconTileComponent,
    IconComponent,
    ItemModule,
    TypographyModule,
  ],
})
export class AddItemGridComponent implements OnInit {
  readonly canCreateCipher = input(true);
  readonly canCreateFolder = input(false);
  readonly canCreateCollection = input(false);
  readonly canCreateSshKey = input(false);

  readonly itemSelected = output<AddItemGridResult>();

  private readonly restrictedTypes = toSignal(this.restrictedItemTypesService.restricted$, {
    initialValue: [] as RestrictedCipherType[],
  });

  private readonly announcementService = inject(NewItemTypesAnnouncementService);
  private readonly destroyRef = inject(DestroyRef);

  /** Types badged "New", held from first render since showing them marks the badges seen */
  private readonly badgedTypes = signal<CipherType[]>([]);

  readonly items = computed<GridItem[]>(() => {
    const restrictedTypes = this.restrictedTypes();
    const badgedTypes = this.badgedTypes();
    const items: GridItem[] = this.canCreateCipher()
      ? DIALOG_CIPHER_MENU_ITEMS.filter((item) => {
          if (!this.canCreateSshKey() && item.type === CipherType.SshKey) {
            return false;
          }
          return !restrictedTypes.some((r) => r.cipherType === item.type);
        }).map((item) => ({
          icon: item.icon as BitwardenIcon,
          labelKey: item.labelKey,
          subtitleKey: item.subtitleKey,
          badged: badgedTypes.includes(item.type),
          action: () =>
            this.itemSelected.emit({ result: AddItemGridResult.Cipher, cipherType: item.type }),
        }))
      : [];

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
        icon: this.vfo1TerminologyService.iconClass("bwi-collection-shared"),
        labelKey: this.vfo1TerminologyService.enabled() ? "sharedFolder" : "collection",
        subtitleKey: "collectionSubtitle",
        action: () => this.itemSelected.emit({ result: AddItemGridResult.Collection }),
      });
    }

    return items;
  });

  private readonly vfo1TerminologyService = inject(Vfo1TerminologyService);

  constructor(private readonly restrictedItemTypesService: RestrictedItemTypesService) {}

  ngOnInit(): void {
    if (!this.canCreateCipher()) {
      return;
    }
    this.announcementService.badgedTypes$
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((types) => {
        this.badgedTypes.set(types);
        if (types.length > 0) {
          void this.announcementService.dismissBadges();
        }
      });
  }
}

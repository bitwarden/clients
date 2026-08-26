import { CommonModule } from "@angular/common";
import { Component, inject, input, output } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, shareReplay } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
import {
  BitwardenIcon,
  ButtonModule,
  ButtonType,
  IconModule,
  MenuModule,
  PopoverComponent,
  PopoverModule,
  PositionIdentifier,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { Vfo1I18nPipe } from "../../pipes/vfo1-i18n.pipe";
import { Vfo1IconPipe } from "../../pipes/vfo1-icon.pipe";
import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-new-cipher-menu",
  templateUrl: "new-cipher-menu.component.html",
  imports: [
    ButtonModule,
    CommonModule,
    MenuModule,
    PopoverModule,
    I18nPipe,
    JslibModule,
    Vfo1I18nPipe,
    TooltipDirective,
    Vfo1IconPipe,
    IconModule,
  ],
})
export class NewCipherMenuComponent {
  readonly canCreateCipher = input(false);
  readonly canCreateFolder = input(false);
  readonly canCreateCollection = input(false);
  readonly canCreateSshKey = input(false);
  readonly icon = input<BitwardenIcon>("bwi-plus");
  readonly buttonType = input<ButtonType>("primary");

  /**
   * When `true`, the "New" button is rendered in a disabled state, e.g. because the
   * organization is suspended and nothing can be created until it's reinstated.
   */
  readonly disabled = input(false);

  /** Optional popover to anchor to the "New" button for coachmark tours */
  readonly coachmarkPopover = input<PopoverComponent>();
  /** Whether the coachmark popover is open */
  readonly coachmarkPopoverOpen = input(false);
  /** Popover position */
  readonly coachmarkPosition = input<PositionIdentifier>();

  folderAdded = output();
  collectionAdded = output();
  cipherAdded = output<CipherType>();
  onAddItemDialog = output();

  private readonly terminology = inject(Vfo1TerminologyService);

  private readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
    { initialValue: false },
  );

  protected readonly useNewItemDialog = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    { initialValue: false },
  );

  constructor(
    private restrictedItemTypesService: RestrictedItemTypesService,
    private configService: ConfigService,
  ) {}

  /**
   * Returns an observable that emits the cipher menu items, filtered by the restricted types.
   */
  cipherMenuItems$ = combineLatest([
    this.restrictedItemTypesService.restricted$,
    toObservable(this.canCreateCipher),
    toObservable(this.canCreateSshKey),
  ]).pipe(
    map(([restrictedTypes, canCreateCipher, canCreateSshKey]) => {
      // If user cannot create ciphers at all, return empty array
      if (!canCreateCipher) {
        return [];
      }
      return CIPHER_MENU_ITEMS.filter((item) => {
        if (!canCreateSshKey && item.type === CipherType.SshKey) {
          return false;
        }
        return !restrictedTypes.some((restrictedType) => restrictedType.cipherType === item.type);
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Returns the appropriate button label based on what can be created.
   * If only collections can be created (no ciphers or folders), show "New Collection".
   * Otherwise, show "New".
   */
  protected getButtonLabel(): string {
    const canCreateCipher = this.canCreateCipher();
    const canCreateFolder = this.canCreateFolder();
    const canCreateCollection = this.canCreateCollection();
    const btnTextAddCreateFeatureFlag = this.btnTextAddCreateFeatureFlag();

    // If only collections can be created, be specific
    if (!canCreateCipher && !canCreateFolder && canCreateCollection) {
      const sharedFolderTerminology = this.terminology.enabled();
      if (btnTextAddCreateFeatureFlag) {
        return sharedFolderTerminology ? "addSharedFolder" : "addCollection";
      } else {
        return sharedFolderTerminology ? "newSharedFolder" : "newCollection";
      }
    }

    if (btnTextAddCreateFeatureFlag) {
      if (this.buttonType() === "secondary") {
        return "addItem";
      } else {
        return "add";
      }
    } else {
      return this.terminology.enabled() ? "add" : "new";
    }
  }

  /**
   * Returns true if only collections can be created (no other options).
   * When this is true, the button should directly create a collection instead of showing a dropdown.
   */
  protected isOnlyCollectionCreation(): boolean {
    return !this.canCreateCipher() && !this.canCreateFolder() && this.canCreateCollection();
  }

  /**
   * Handles the button click. If only collections can be created, directly emit the collection event.
   * Otherwise, the menu trigger will handle opening the dropdown.
   */
  protected handleButtonClick(): void {
    if (this.isOnlyCollectionCreation()) {
      this.collectionAdded.emit();
      return;
    }
    if (this.useNewItemDialog()) {
      this.onAddItemDialog.emit();
    }
  }
}

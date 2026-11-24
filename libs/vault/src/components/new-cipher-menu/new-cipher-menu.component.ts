import { CommonModule } from "@angular/common";
import { Component, computed, inject, input, output, viewChild } from "@angular/core";
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
  PopoverModule,
  PositionIdentifier,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { Vfo1I18nPipe } from "../../pipes/vfo1-i18n.pipe";
import { Vfo1IconPipe } from "../../pipes/vfo1-icon.pipe";
import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";
import { CoachmarkComponent } from "../coachmark/coachmark.component";
import { CoachmarkService } from "../coachmark/coachmark.service";
import { NewItemTypesCoachmarkComponent } from "../new-item-types-coachmark/new-item-types-coachmark.component";

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
    CoachmarkComponent,
    NewItemTypesCoachmarkComponent,
  ],
})
export class NewCipherMenuComponent {
  readonly canCreateCipher = input(false);
  readonly canCreateFolder = input(false);
  readonly canCreateCollection = input(false);
  readonly canCreateSshKey = input(false);
  readonly icon = input<BitwardenIcon>("bwi-plus");
  readonly buttonType = input<ButtonType>("primary");
  readonly id = input<string>();

  /**
   * When `true`, the "New" button is rendered in a disabled state, e.g. because the
   * organization is suspended and nothing can be created until it's reinstated.
   */
  readonly disabled = input(false);

  /** Set to `false` on all but one menu when several render the same page. */
  readonly coachmarkEnabled = input(true);

  folderAdded = output();
  collectionAdded = output();
  cipherAdded = output<CipherType>();
  onAddItemDialog = output();

  private readonly terminology = inject(Vfo1TerminologyService);
  protected readonly coachmark = inject(CoachmarkService);

  protected readonly coachmarkActive = computed(
    () => this.coachmarkEnabled() && this.coachmark.isStepActive("addItem"),
  );

  protected readonly useNewItemDialog = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    { initialValue: false },
  );

  /** The new item types coachmark anchors only to the dialog button, and never over the tour */
  protected readonly newItemTypesCoachmarkEnabled = computed(
    () =>
      this.coachmarkEnabled() &&
      this.useNewItemDialog() &&
      this.canCreateCipher() &&
      !this.disabled() &&
      !this.coachmarkActive(),
  );

  private readonly addItemCoachmark = viewChild.required(CoachmarkComponent);
  private readonly newItemTypesCoachmark = viewChild.required(NewItemTypesCoachmarkComponent);

  /** The tour's add item step takes the dialog button over from the new item types coachmark */
  protected readonly activePopover = computed(() =>
    this.coachmarkActive()
      ? this.addItemCoachmark().popover()
      : this.newItemTypesCoachmark().popover(),
  );

  protected readonly popoverOpen = computed(
    () => this.coachmarkActive() || this.newItemTypesCoachmark().open(),
  );

  protected readonly popoverPosition = computed<PositionIdentifier | undefined>(() =>
    this.coachmarkActive() ? this.coachmark.getStepPosition("addItem") : "below-end",
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
  protected onPopoverOpenChange(open: boolean): void {
    this.newItemTypesCoachmark().openChange(open);
  }

  protected getButtonLabel(): string {
    const canCreateCipher = this.canCreateCipher();
    const canCreateFolder = this.canCreateFolder();
    const canCreateCollection = this.canCreateCollection();

    // If only collections can be created, be specific
    if (!canCreateCipher && !canCreateFolder && canCreateCollection) {
      const sharedFolderTerminology = this.terminology.enabled();
      return sharedFolderTerminology ? "addSharedFolder" : "addCollection";
    }

    return this.buttonType() === "secondary" ? "addItem" : "add";
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

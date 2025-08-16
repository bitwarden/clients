import { Component, EventEmitter, Input, Output } from "@angular/core";

import { RestrictedView } from "@bitwarden/assets/svg";
import { ButtonModule, NoItemsModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { CollectionDialogTabType } from "../shared/components/collection-dialog";

@Component({
  selector: "collection-access-restricted",
  imports: [SharedModule, ButtonModule, NoItemsModule],
  template: `<bit-no-items [icon]="icon" class="tw-mt-2 tw-block">
    <span slot="title" class="tw-mt-4 tw-block">{{ "youDoNotHavePermissions" | i18n }}</span>
    <button
      *ngIf="canEditCollection"
      slot="button"
      bitButton
      (click)="viewCollectionClicked.emit({ readonly: false, tab: collectionDialogTabType.Info })"
      buttonType="secondary"
      type="button"
    >
      <i aria-hidden="true" class="bwi bwi-pencil-square"></i> {{ "editCollection" | i18n }}
    </button>
    <button
      *ngIf="!canEditCollection && canViewCollectionInfo"
      slot="button"
      bitButton
      (click)="viewCollectionClicked.emit({ readonly: true, tab: collectionDialogTabType.Access })"
      buttonType="secondary"
      type="button"
    >
      <i aria-hidden="true" class="bwi bwi-users"></i> {{ "viewAccess" | i18n }}
    </button>
  </bit-no-items>`,
})
export class CollectionAccessRestrictedComponent {
  protected icon = RestrictedView;
  protected collectionDialogTabType = CollectionDialogTabType;

  @Input() canEditCollection = false;
  @Input() canViewCollectionInfo = false;

  @Output() viewCollectionClicked = new EventEmitter<{
    readonly: boolean;
    tab: CollectionDialogTabType;
  }>();
}

import { Component, EventEmitter, Input, Output } from "@angular/core";

import { RestrictedView } from "@bitwarden/assets/svg";
import { ButtonModule, NoItemsModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { CollectionDialogTabType } from "../shared/components/collection-dialog";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canEditCollection = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() canViewCollectionInfo = false;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() viewCollectionClicked = new EventEmitter<{
    readonly: boolean;
    tab: CollectionDialogTabType;
  }>();
}

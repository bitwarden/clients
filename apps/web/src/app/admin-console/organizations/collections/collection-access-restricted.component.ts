import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ButtonModule, NoItemsModule, svgIcon } from "@bitwarden/components";

import { SharedModule } from "../../../shared";
import { CollectionDialogTabType } from "../shared/components/collection-dialog";

const icon = svgIcon`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="10 -10 120 140" fill="none">
  <rect class="tw-stroke-secondary-600" width="134" height="86" x="3" y="31.485" stroke-width="6" rx="11"/>
  <path class="tw-fill-secondary-600" d="M123.987 20.15H14.779a3.114 3.114 0 0 1-2.083-.95 3.036 3.036 0 0 1 0-4.208 3.125 3.125 0 0 1 2.083-.951h109.208c.792.043 1.536.38 2.083.95a3.035 3.035 0 0 1 0 4.208 3.115 3.115 0 0 1-2.083.95Zm-6.649-14.041h-95.91a3.114 3.114 0 0 1-2.082-.95 3.036 3.036 0 0 1-.848-2.105c0-.782.306-1.538.848-2.104A3.125 3.125 0 0 1 21.43 0h95.909c.791.043 1.535.38 2.082.95.547.57.849 1.322.849 2.104a3.05 3.05 0 0 1-.849 2.104 3.115 3.115 0 0 1-2.082.95ZM95.132 74.407A42.317 42.317 0 0 0 83.59 65.43l8.799-8.657a1.59 1.59 0 0 0 .004-2.27 1.641 1.641 0 0 0-2.298-.004l-9.64 9.479a28.017 28.017 0 0 0-10.483-2.13c-14.323 0-24.814 12.342-25.298 12.89a2.431 2.431 0 0 0-.675 1.64c-.01.612.215 1.203.626 1.66a43.981 43.981 0 0 0 11.873 9.485l-8.806 8.658a1.601 1.601 0 0 0-.499 1.138 1.602 1.602 0 0 0 1.008 1.5 1.651 1.651 0 0 0 1.255-.009c.199-.085.379-.205.528-.359l9.634-9.443a27.16 27.16 0 0 0 10.359 2.158c14.323 0 24.753-12.086 25.23-12.63a2.983 2.983 0 0 0-.078-4.128h.002ZM49.204 77.82a1.82 1.82 0 0 1-.43-.6 1.767 1.767 0 0 1-.152-.72 1.778 1.778 0 0 1 .582-1.32c3.857-3.564 11.782-9.686 20.77-9.676 2.564.037 5.105.508 7.508 1.395l-3.291 3.235a7.793 7.793 0 0 0-5.02-1.226 7.746 7.746 0 0 0-4.676 2.18 7.528 7.528 0 0 0-1 9.563l-4.199 4.143a43.135 43.135 0 0 1-10.092-6.974Zm26.059-1.318a5.19 5.19 0 0 1-1.557 3.68 5.326 5.326 0 0 1-3.733 1.521c-.82-.005-1.63-.2-2.359-.57l7.067-6.952c.377.718.575 1.513.582 2.321Zm-10.58 0a5.136 5.136 0 0 1 .673-2.555 5.204 5.204 0 0 1 1.862-1.897 5.302 5.302 0 0 1 5.172-.146l-7.096 6.977a5.06 5.06 0 0 1-.61-2.379Zm26.053 1.331c-3.857 3.56-11.779 9.677-20.763 9.677a22.723 22.723 0 0 1-7.454-1.369l3.292-3.226a7.793 7.793 0 0 0 4.995 1.192 7.734 7.734 0 0 0 4.642-2.176 7.524 7.524 0 0 0 1.033-9.506l4.224-4.168a43.258 43.258 0 0 1 10.02 6.945 1.788 1.788 0 0 1 .585 1.313 1.788 1.788 0 0 1-.577 1.318h.003Z"/>
</svg>`;

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
  protected icon = icon;
  protected collectionDialogTabType = CollectionDialogTabType;

  @Input() canEditCollection = false;
  @Input() canViewCollectionInfo = false;

  @Output() viewCollectionClicked = new EventEmitter<{
    readonly: boolean;
    tab: CollectionDialogTabType;
  }>();
}

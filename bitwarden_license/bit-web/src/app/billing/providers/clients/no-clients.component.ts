import { Component, EventEmitter, Input, Output } from "@angular/core";

import { GearIcon } from "@bitwarden/assets/svg";
import { NoItemsModule } from "@bitwarden/components";
import { SharedOrganizationModule } from "@bitwarden/web-vault/app/admin-console/organizations/shared";

@Component({
  selector: "app-no-clients",
  imports: [SharedOrganizationModule, NoItemsModule],
  template: `
    <bit-no-items [icon]="icon">
      <div slot="title">{{ "noClients" | i18n }}</div>
      <a
        *ngIf="showAddOrganizationButton"
        [disabled]="disableAddOrganizationButton"
        type="button"
        bitButton
        buttonType="primary"
        (click)="addNewOrganization()"
        slot="button"
      >
        <i class="bwi bwi-plus bwi-fw" aria-hidden="true"></i>
        {{ "addNewOrganization" | i18n }}
      </a>
    </bit-no-items>
  `,
})
export class NoClientsComponent {
  icon = GearIcon;
  @Input() showAddOrganizationButton = true;
  @Input() disableAddOrganizationButton = false;
  @Output() addNewOrganizationClicked = new EventEmitter();

  addNewOrganization = () => this.addNewOrganizationClicked.emit();
}

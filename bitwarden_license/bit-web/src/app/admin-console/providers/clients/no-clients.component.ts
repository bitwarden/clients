import { Component, EventEmitter, Input, Output } from "@angular/core";

import { GearIcon } from "@bitwarden/assets/svg";
import { NoItemsModule } from "@bitwarden/components";
import { SharedOrganizationModule } from "@bitwarden/web-vault/app/admin-console/organizations/shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() showAddOrganizationButton = true;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() disableAddOrganizationButton = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() addNewOrganizationClicked = new EventEmitter();

  addNewOrganization = () => this.addNewOrganizationClicked.emit();
}

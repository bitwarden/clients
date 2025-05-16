import { Component } from "@angular/core";

import { AddEditCustomFieldsComponent as BaseAddEditCustomFieldsComponent } from "@bitwarden/angular/vault/components/add-edit-custom-fields.component";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Component({
  selector: "app-vault-add-edit-custom-fields",
  templateUrl: "add-edit-custom-fields.component.html",
  standalone: false,
})
export class AddEditCustomFieldsComponent extends BaseAddEditCustomFieldsComponent {
  constructor(i18nService: I18nService, eventCollectionService: EventCollectionService) {
    super(i18nService, eventCollectionService);
  }
}

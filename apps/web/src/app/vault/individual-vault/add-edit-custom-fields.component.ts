// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { AddEditCustomFieldsComponent as BaseAddEditCustomFieldsComponent } from "@bitwarden/angular/vault/components/add-edit-custom-fields.component";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

@Component({
  selector: "app-vault-add-edit-custom-fields",
  templateUrl: "add-edit-custom-fields.component.html",
})
export class AddEditCustomFieldsComponent extends BaseAddEditCustomFieldsComponent {
  @Input() viewOnly: boolean;
  @Input() copy: (value: string, typeI18nKey: string, aType: string) => void;

  constructor(i18nService: I18nService, eventCollectionService: EventCollectionService) {
    super(i18nService, eventCollectionService);
  }
}

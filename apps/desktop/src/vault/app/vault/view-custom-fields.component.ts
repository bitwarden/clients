import { Component } from "@angular/core";

import { ViewCustomFieldsComponent as BaseViewCustomFieldsComponent } from "@bitwarden/angular/vault/components/view-custom-fields.component";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";

@Component({
  selector: "app-vault-view-custom-fields",
  templateUrl: "view-custom-fields.component.html",
  standalone: false,
})
export class ViewCustomFieldsComponent extends BaseViewCustomFieldsComponent {
  constructor(eventCollectionService: EventCollectionService) {
    super(eventCollectionService);
  }
}

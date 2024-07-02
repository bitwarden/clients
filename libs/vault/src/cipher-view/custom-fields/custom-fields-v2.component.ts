import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FieldType, LinkedIdType, LoginLinkedId } from "@bitwarden/common/vault/enums";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";
import {
  CardComponent,
  IconButtonModule,
  FormFieldModule,
  InputModule,
  SectionComponent,
  SectionHeaderComponent,
} from "@bitwarden/components";

@Component({
  selector: "app-custom-fields-v2",
  templateUrl: "custom-fields-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    CardComponent,
    IconButtonModule,
    FormFieldModule,
    InputModule,
    SectionComponent,
    SectionHeaderComponent,
  ],
})
export class CustomFieldV2Component {
  @Input() fields: FieldView[];
  fieldType = FieldType;

  constructor(private i18nService: I18nService) {}

  getLinkedType(linkedId: LinkedIdType) {
    if (linkedId === LoginLinkedId.Username) {
      return this.i18nService.t("username");
    }

    if (linkedId === LoginLinkedId.Password) {
      return this.i18nService.t("password");
    }
  }
}

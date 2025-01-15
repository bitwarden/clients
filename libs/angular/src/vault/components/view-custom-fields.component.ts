// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, Input } from "@angular/core";

import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { FieldType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FieldView } from "@bitwarden/common/vault/models/view/field.view";

@Directive()
export class ViewCustomFieldsComponent {
  @Input() cipher: CipherView;
  @Input() promptPassword: () => Promise<boolean>;
  @Input() copy: (value: string, typeI18nKey: string, aType: string) => void;

  fieldType = FieldType;

  constructor(private eventCollectionService: EventCollectionService) {}

  async toggleFieldValue(field: FieldView) {
    if (!(await this.promptPassword())) {
      return;
    }

    const f = field as any;
    f.showValue = !f.showValue;
    f.showCount = false;
    if (f.showValue) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledHiddenFieldVisible,
        this.cipher.id,
      );
    }
  }

  async toggleFieldCount(field: FieldView) {
    if (!field.showValue) {
      return;
    }

    field.showCount = !field.showCount;
  }

  setTextDataOnDrag(event: DragEvent, data: string) {
    event.dataTransfer.setData("text", data);
  }
}

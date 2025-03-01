// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { EventType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType, FieldType, LinkedIdType } from "@bitwarden/common/vault/enums";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  CardComponent,
  IconButtonModule,
  FormFieldModule,
  InputModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  CheckboxModule,
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
    TypographyModule,
    CheckboxModule,
  ],
})
export class CustomFieldV2Component implements OnInit {
  @Input() cipher: CipherView;
  fieldType = FieldType;
  fieldOptions: any;

  constructor(
    private i18nService: I18nService,
    private eventCollectionService: EventCollectionService,
  ) {}

  ngOnInit(): void {
    this.fieldOptions = this.getLinkedFieldsOptionsForCipher();
  }

  getLinkedType(linkedId: LinkedIdType) {
    const linkedType = this.fieldOptions.get(linkedId);
    return this.i18nService.t(linkedType.i18nKey);
  }

  get canViewPassword() {
    return this.cipher.viewPassword;
  }

  async logHiddenEvent(hiddenFieldVisible: boolean) {
    if (hiddenFieldVisible) {
      await this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledHiddenFieldVisible,
        this.cipher.id,
        false,
        this.cipher.organizationId,
      );
    }
  }

  async logCopyEvent() {
    await this.eventCollectionService.collect(
      EventType.Cipher_ClientCopiedHiddenField,
      this.cipher.id,
      false,
      this.cipher.organizationId,
    );
  }

  private getLinkedFieldsOptionsForCipher() {
    switch (this.cipher.type) {
      case CipherType.Login:
        return LoginView.prototype.linkedFieldOptions;
      case CipherType.Card:
        return CardView.prototype.linkedFieldOptions;
      case CipherType.Identity:
        return IdentityView.prototype.linkedFieldOptions;
      default:
        return null;
    }
  }
}

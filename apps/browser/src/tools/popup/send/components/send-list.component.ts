// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

@Component({
  selector: "app-send-list",
  templateUrl: "send-list.component.html",
})
export class SendListComponent {
  @Input() sends: SendView[];
  @Input() title: string;
  @Input() disabledByPolicy = false;
  @Output() onSelected = new EventEmitter<SendView>();
  @Output() onCopySendLink = new EventEmitter<SendView>();
  @Output() onRemovePassword = new EventEmitter<SendView>();
  @Output() onDeleteSend = new EventEmitter<SendView>();

  sendType = SendType;

  selectSend(s: SendView) {
    this.onSelected.emit(s);
  }

  copySendLink(s: SendView) {
    this.onCopySendLink.emit(s);
  }

  removePassword(s: SendView) {
    this.onRemovePassword.emit(s);
  }

  delete(s: SendView) {
    this.onDeleteSend.emit(s);
  }
}

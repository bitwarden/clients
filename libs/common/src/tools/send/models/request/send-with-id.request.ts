import { Send } from "../domain/send";

import { SendRequest } from "./send.request";

export class SendWithIdRequest extends SendRequest {
  id: string;

  constructor(send: Send) {
    super(send);
    this.id = send.id;
  }
}

import { Jsonify } from "type-fest";

import { AlertDismissalId, CipherId } from "../../../types/guid";
import { AlertDismissalResponse } from "../response/alert-dismissal.response";

export class AlertDismissalData {
  id: AlertDismissalId;
  cipherId: CipherId;
  dismissedAt: Date;
  notes: string | null;

  constructor(response: AlertDismissalResponse) {
    this.id = response.id;
    this.cipherId = response.cipherId;
    this.dismissedAt = new Date(response.dismissedAt);
    this.notes = response.notes;
  }

  static fromJSON(obj: Jsonify<AlertDismissalData>): AlertDismissalData {
    return Object.assign(new AlertDismissalData({} as AlertDismissalResponse), obj, {
      dismissedAt: new Date(obj.dismissedAt),
    });
  }
}

import { Jsonify } from "type-fest";

import { AlertExclusionId, CipherId } from "../../../types/guid";
import { AlertExclusionResponse } from "../response/alert-exclusion.response";

export class AlertExclusionData {
  id: AlertExclusionId;
  cipherId: CipherId;
  excludedAt: Date;
  notes: string | null;
  riskTypes: number;

  constructor(response: AlertExclusionResponse) {
    this.id = response.id;
    this.cipherId = response.cipherId;
    this.excludedAt = new Date(response.excludedAt);
    this.notes = response.notes;
    this.riskTypes = response.riskTypes ?? 0;
  }

  static fromJSON(obj: Jsonify<AlertExclusionData>): AlertExclusionData {
    return Object.assign(new AlertExclusionData({} as AlertExclusionResponse), obj, {
      excludedAt: new Date(obj.excludedAt),
    });
  }
}

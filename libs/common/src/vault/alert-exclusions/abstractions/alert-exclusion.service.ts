import { Observable } from "rxjs";

import { AlertExclusionId, CipherId, UserId } from "../../../types/guid";
import { AlertExclusionData } from "../../models/data/alert-exclusion.data";
import { AlertExclusionResponse } from "../../models/response/alert-exclusion.response";

export abstract class AlertExclusionService {
  abstract exclusions$(userId: UserId): Observable<AlertExclusionData[]>;
  abstract isExcluded$(cipherId: CipherId, userId: UserId): Observable<boolean>;
  abstract exclude(cipherId: CipherId, userId: UserId, riskTypes: number): Promise<void>;
  abstract removeExclusion(exclusionId: AlertExclusionId, userId: UserId): Promise<void>;
  abstract syncExclusions(exclusions: AlertExclusionResponse[], userId: UserId): Promise<void>;
}

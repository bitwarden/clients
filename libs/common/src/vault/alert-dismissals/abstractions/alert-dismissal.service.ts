import { Observable } from "rxjs";

import { AlertDismissalId, CipherId, UserId } from "../../../types/guid";
import { AlertDismissalData } from "../../models/data/alert-dismissal.data";
import { AlertDismissalResponse } from "../../models/response/alert-dismissal.response";

export abstract class AlertDismissalService {
  abstract dismissals$(userId: UserId): Observable<AlertDismissalData[]>;
  abstract isDismissed$(cipherId: CipherId, userId: UserId): Observable<boolean>;
  abstract dismiss(cipherId: CipherId, userId: UserId, notes?: string): Promise<void>;
  abstract undismiss(dismissalId: AlertDismissalId, userId: UserId): Promise<void>;
  abstract syncDismissals(dismissals: AlertDismissalResponse[], userId: UserId): Promise<void>;
}

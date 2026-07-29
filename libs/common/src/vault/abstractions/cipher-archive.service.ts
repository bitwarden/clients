import { Observable } from "rxjs";

import { CipherId, UserId } from "../../types/guid";
import { CipherData } from "../models/data/cipher.data";
import { CipherViewLike } from "../utils/cipher-view-like-utils";

export abstract class CipherArchiveService {
  abstract archivedCiphers$(userId: UserId): Observable<CipherViewLike[]>;
  abstract userCanArchive$(userId: UserId): Observable<boolean>;
  abstract userHasPremium$(userId: UserId): Observable<boolean>;
  abstract archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<CipherData>;
  abstract unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<CipherData>;
  abstract showSubscriptionEndedMessaging$(userId: UserId): Observable<boolean>;
}

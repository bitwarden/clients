import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

export abstract class SharedUnlockFollowerService {
  abstract start(): Promise<void>;
  abstract externalUnlock$: Observable<UserId>;
}

import { Observable } from "rxjs";

import { Account } from "../../auth/abstractions/account.service";
import { UserActionEvent } from "../achievements/types";

import { UserEventMonitor } from "./user-event-monitor";

export abstract class UserEventCollector {
  abstract monitor: (account: Account) => UserEventMonitor;
  abstract events$: (account: Account) => Observable<UserActionEvent>;
}

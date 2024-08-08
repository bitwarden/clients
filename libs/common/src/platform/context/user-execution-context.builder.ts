import { map } from "rxjs";

import { AccountService } from "../../auth/abstractions/account.service";
import { UserId } from "../../types/guid";

import { ExecutionContextBuilder } from "./execution-context.builder";

export class UserExecutionContextBuilder extends ExecutionContextBuilder<{
  userId: UserId;
}> {
  constructor(private readonly accountService: AccountService) {
    super();

    this.contextMap.push({
      name: "userId",
      factory: () => this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    });
  }
}

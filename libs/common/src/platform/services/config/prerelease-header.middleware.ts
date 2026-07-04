import { firstValueFrom } from "rxjs";

import { AccountService } from "../../../auth/abstractions/account.service";
import { FetchFn, FetchMiddleware } from "../../misc/fetch-middleware";
import { EarlyAccessService } from "../early-access/early-access.service";

export function prereleaseHeaderMiddleware(
  earlyAccessService: EarlyAccessService,
  accountService: AccountService,
): FetchMiddleware {
  return async (request: Request, next: FetchFn): Promise<Response> => {
    const activeAccount = await firstValueFrom(accountService.activeAccount$);
    if (activeAccount == null) {
      return next(request);
    }
    const enabled = await firstValueFrom(earlyAccessService.earlyAccess$(activeAccount.id));
    if (enabled) {
      request.headers.set("Is-Prerelease", "1");
    }
    return next(request);
  };
}

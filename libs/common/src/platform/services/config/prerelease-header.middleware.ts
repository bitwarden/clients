import { firstValueFrom } from "rxjs";

import { AccountService } from "../../../auth/abstractions/account.service";
import { ConfigService } from "../../abstractions/config/config.service";
import { FetchFn, FetchMiddleware } from "../../misc/fetch-middleware";

export function prereleaseHeaderMiddleware(
  configService: ConfigService,
  accountService: AccountService,
): FetchMiddleware {
  return async (request: Request, next: FetchFn): Promise<Response> => {
    const activeAccount = await firstValueFrom(accountService.activeAccount$);
    if (activeAccount == null) {
      return next(request);
    }
    const enabled = await firstValueFrom(configService.earlyAccess$(activeAccount.id));
    if (enabled) {
      request.headers.set("Is-Prerelease", "1");
    }
    return next(request);
  };
}

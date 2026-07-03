import { firstValueFrom } from "rxjs";

import { ConfigService } from "../../abstractions/config/config.service";
import { FetchFn, FetchMiddleware } from "../../misc/fetch-middleware";

export function prereleaseHeaderMiddleware(configService: ConfigService): FetchMiddleware {
  return async (request: Request, next: FetchFn): Promise<Response> => {
    const enabled = await firstValueFrom(configService.earlyAccess$);
    if (enabled) {
      request.headers.set("Is-Prerelease", "1");
    }
    return next(request);
  };
}

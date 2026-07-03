import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { ConfigService } from "../../abstractions/config/config.service";
import { FetchFn } from "../../misc/fetch-middleware";

import { prereleaseHeaderMiddleware } from "./prerelease-header.middleware";

describe("prereleaseHeaderMiddleware", () => {
  const userId = "user-1" as UserId;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let accountService: ReturnType<typeof mock<AccountService>>;
  let next: jest.Mock<Promise<Response>, [Request]>;
  let response: Response;

  beforeEach(() => {
    configService = mock<ConfigService>();
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: userId } as any);
    response = { ok: true, status: 200 } as unknown as Response;
    next = jest.fn<Promise<Response>, [Request]>().mockResolvedValue(response);
  });

  function makeRequest(): Request {
    return { headers: new Headers() } as unknown as Request;
  }

  it("sets Is-Prerelease header when early access is enabled for the active user", async () => {
    configService.earlyAccess$.mockReturnValue(of(true));
    const middleware = prereleaseHeaderMiddleware(configService, accountService);
    const request = makeRequest();

    await middleware(request, next as FetchFn);

    expect(configService.earlyAccess$).toHaveBeenCalledWith(userId);
    expect(request.headers.get("Is-Prerelease")).toBe("1");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(request);
  });

  it("does not set the header when early access is disabled for the active user", async () => {
    configService.earlyAccess$.mockReturnValue(of(false));
    const middleware = prereleaseHeaderMiddleware(configService, accountService);
    const request = makeRequest();

    await middleware(request, next as FetchFn);

    expect(request.headers.has("Is-Prerelease")).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("skips the check when there is no active user", async () => {
    accountService.activeAccount$ = of(null);
    const middleware = prereleaseHeaderMiddleware(configService, accountService);

    await middleware(makeRequest(), next as FetchFn);

    expect(configService.earlyAccess$).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns the response produced by next", async () => {
    configService.earlyAccess$.mockReturnValue(of(true));
    const middleware = prereleaseHeaderMiddleware(configService, accountService);

    const result = await middleware(makeRequest(), next as FetchFn);

    expect(result).toBe(response);
  });
});

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ConfigService } from "../../abstractions/config/config.service";
import { FetchFn } from "../../misc/fetch-middleware";

import { prereleaseHeaderMiddleware } from "./prerelease-header.middleware";

describe("prereleaseHeaderMiddleware", () => {
  let configService: ReturnType<typeof mock<ConfigService>>;
  let next: jest.Mock<Promise<Response>, [Request]>;
  let response: Response;

  beforeEach(() => {
    configService = mock<ConfigService>();
    response = { ok: true, status: 200 } as unknown as Response;
    next = jest.fn<Promise<Response>, [Request]>().mockResolvedValue(response);
  });

  function makeRequest(): Request {
    return { headers: new Headers() } as unknown as Request;
  }

  it("sets Is-Prerelease header when beta mode is enabled", async () => {
    configService.betaMode$ = of(true);
    const middleware = prereleaseHeaderMiddleware(configService);
    const request = makeRequest();

    await middleware(request, next as FetchFn);

    expect(request.headers.get("Is-Prerelease")).toBe("1");
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(request);
  });

  it("does not set the header when beta mode is disabled", async () => {
    configService.betaMode$ = of(false);
    const middleware = prereleaseHeaderMiddleware(configService);
    const request = makeRequest();

    await middleware(request, next as FetchFn);

    expect(request.headers.has("Is-Prerelease")).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns the response produced by next", async () => {
    configService.betaMode$ = of(true);
    const middleware = prereleaseHeaderMiddleware(configService);

    const result = await middleware(makeRequest(), next as FetchFn);

    expect(result).toBe(response);
  });
});

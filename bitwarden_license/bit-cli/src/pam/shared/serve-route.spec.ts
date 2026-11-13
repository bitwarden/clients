import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  PAM_TEST_USER_ID,
  pamTestAccountService,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { PamServeRoute, registerPamServeRoute, writePamServeResponse } from "./serve-route";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;

describe("registerPamServeRoute", () => {
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  const accountService = pamTestAccountService();
  const container = mock<ServiceContainer>();
  const router = mock<Router>();
  let enabled: Set<FeatureFlag>;
  const next = jest.fn(async (): Promise<void> => undefined);

  const register = (route: PamServeRoute): Handler => {
    registerPamServeRoute(router, container, route);
    const registered = (route.method === "GET" ? router.get : router.post).mock.calls[0];
    return registered[1] as unknown as Handler;
  };

  const context = (overrides: Record<string, unknown> = {}) => ({
    response: {} as { status?: number; body?: unknown },
    params: { id: "1" },
    query: { a: "b" },
    request: { body: { x: 1 } },
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    enabled = new Set([FeatureFlag.Pam]);
    Object.assign(container, { configService, keyService, accountService });
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(enabled.has(flag))) as never);
    keyService.hasUserKey.mockResolvedValue(true);
  });

  it("mounts the route under /pam with the right verb", () => {
    registerPamServeRoute(router, container, {
      method: "GET",
      path: "/lease",
      handler: async () => Response.success(),
    });
    registerPamServeRoute(router, container, {
      method: "POST",
      path: "/lease/:id/extend",
      handler: async () => Response.success(),
    });

    expect(router.get).toHaveBeenCalledWith("/pam/lease", expect.any(Function));
    expect(router.post).toHaveBeenCalledWith("/pam/lease/:id/extend", expect.any(Function));
  });

  it("runs the handler with the user, params and query, and sends its response", async () => {
    const response = Response.success(new MessageResponse("ok", null));
    const handler = jest.fn(async () => response);
    const ctx = context();

    await register({ method: "GET", path: "/x", handler })(ctx, next);

    expect(handler).toHaveBeenCalledWith({
      userId: PAM_TEST_USER_ID,
      params: { id: "1" },
      query: { a: "b" },
      body: undefined,
    });
    expect(ctx.response.body).toBe(response);
    expect(ctx.response.status).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it("passes the body of a POST and only a POST", async () => {
    const handler = jest.fn(async () => Response.success());

    await register({ method: "POST", path: "/x", handler })(context(), next);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ body: { x: 1 } }));
  });

  it("answers 400 when the feature flag is off, without running the handler", async () => {
    enabled.clear();
    const handler = jest.fn(async () => Response.success());
    const ctx = context();

    await register({ method: "GET", path: "/x", handler })(ctx, next);

    expect(handler).not.toHaveBeenCalled();
    expect(ctx.response.status).toBe(400);
    expect((ctx.response.body as Response).message).toContain("temporarily unavailable");
  });

  it("also requires the route's extra flags", async () => {
    const handler = jest.fn(async () => Response.success());
    const ctx = context();

    await register({
      method: "GET",
      path: "/x",
      flags: [FeatureFlag.PamAccessConnector],
      handler,
    })(ctx, next);

    expect(handler).not.toHaveBeenCalled();
    expect(ctx.response.status).toBe(400);
  });

  it("answers 400 when the vault is locked", async () => {
    keyService.hasUserKey.mockResolvedValue(false);
    const handler = jest.fn(async () => Response.success());
    const ctx = context();

    await register({ method: "GET", path: "/x", handler })(ctx, next);

    expect(handler).not.toHaveBeenCalled();
    expect((ctx.response.body as Response).message).toBe("Vault is locked.");
  });

  it("answers 400 when no one is logged in", async () => {
    accountService.activeAccountSubject.next(null);
    const handler = jest.fn(async () => Response.success());
    const ctx = context();

    await register({ method: "GET", path: "/x", handler })(ctx, next);

    expect((ctx.response.body as Response).message).toBe("You are not logged in.");
  });

  it("turns an error the handler throws into a failed response without its text", async () => {
    const ctx = context();

    await register({
      method: "GET",
      path: "/x",
      handler: async () => {
        throw new Error("token=abc123");
      },
    })(ctx, next);

    expect(ctx.response.status).toBe(400);
    expect(JSON.stringify(ctx.response.body)).not.toContain("abc123");
  });
});

describe("writePamServeResponse", () => {
  it("leaves the status alone for a success", () => {
    const res = {} as { status?: number; body?: unknown };

    writePamServeResponse(res as never, Response.success());

    expect(res.status).toBeUndefined();
  });

  it("sets 400 for a failure, as the OSS routes do", () => {
    const res = {} as { status?: number; body?: unknown };

    writePamServeResponse(res as never, Response.error("x"));

    expect(res.status).toBe(400);
  });
});

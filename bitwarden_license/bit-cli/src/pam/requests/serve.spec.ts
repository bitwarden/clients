import { Router } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { KeyService } from "@bitwarden/key-management";

import type { ServiceContainer } from "../../service-container";

import { RequestOperations } from "./request.operations";
import { registerServeRoutes } from "./serve";

type Handler = (ctx: unknown, next: () => Promise<void>) => Promise<void>;

describe("requests serve routes", () => {
  const router = mock<Router>();
  const container = mock<ServiceContainer>();
  const organizationService = mock<OrganizationService>();
  const configService = mock<ConfigService>();
  const keyService = mock<KeyService>();
  let operations: ReturnType<typeof mock<RequestOperations>>;
  let seat: boolean;

  const handlerFor = (method: "get" | "post", path: string): Handler => {
    const call = (router[method].mock.calls as unknown as [string, Handler][]).find(
      (c) => c[0] === `/pam${path}`,
    );
    if (call == null) {
      throw new Error(`no route ${path}`);
    }
    return call[1];
  };

  const call = async (
    method: "get" | "post",
    path: string,
    ctx: { params?: Record<string, string>; query?: object; body?: unknown } = {},
  ) => {
    const response: { status?: number; body?: unknown } = {};
    await handlerFor(method, path)(
      {
        response,
        params: ctx.params ?? {},
        query: ctx.query ?? {},
        request: { body: ctx.body },
      },
      async () => undefined,
    );
    return response as { status?: number; body: Response };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    seat = true;
    operations = mock<RequestOperations>();
    Object.assign(container, {
      configService,
      keyService,
      organizationService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    keyService.hasUserKey.mockResolvedValue(true);
    organizationService.organizations$.mockImplementation((() =>
      of([pamTestOrganization({ accessPam: seat })])) as never);
    const ok = Response.success(new MessageResponse("ok", null));
    for (const fn of [
      operations.status,
      operations.create,
      operations.list,
      operations.get,
      operations.activate,
      operations.cancel,
    ]) {
      fn.mockResolvedValue(ok);
    }
    registerServeRoutes(router, container, operations);
  });

  it("registers GET status, list and get and POST create, activate and cancel", () => {
    const paths = (m: "get" | "post") =>
      (router[m].mock.calls as unknown as [string][]).map((c) => c[0]);

    expect(paths("get")).toEqual([
      "/pam/request/status/:cipherId",
      "/pam/request",
      "/pam/request/:requestId",
    ]);
    expect(paths("post")).toEqual([
      "/pam/request/create",
      "/pam/request/:requestId/activate",
      "/pam/request/:requestId/cancel",
    ]);
  });

  it("reads status with the precheck query", async () => {
    const res = await call("get", "/request/status/:cipherId", {
      params: { cipherId: "c" },
      query: { precheck: "true" },
    });

    expect(res.status).toBeUndefined();
    expect(operations.status).toHaveBeenCalledWith(PAM_TEST_USER_ID, "c", { precheck: true });
  });

  it("lists with a status filter", async () => {
    await call("get", "/request", { query: { status: "pending" } });

    expect(operations.list).toHaveBeenCalledWith(PAM_TEST_USER_ID, { status: "pending" });
  });

  it("creates from the body, with the reason only in the body", async () => {
    await call("post", "/request/create", {
      body: { cipherId: "c", duration: 3600, reason: " why " },
    });

    expect(operations.create).toHaveBeenCalledWith(PAM_TEST_USER_ID, {
      cipherId: "c",
      duration: "3600",
      start: undefined,
      end: undefined,
      reason: "why",
    });
  });

  it("refuses a malformed body with status 400", async () => {
    const res = await call("post", "/request/create", { body: { cipherId: 5 } });

    expect(res.status).toBe(400);
    expect(operations.create).not.toHaveBeenCalled();
    const none = await call("post", "/request/create", { body: undefined });
    expect(none.status).toBe(400);
  });

  it("requires a seat for create and activate but not cancel", async () => {
    seat = false;

    const create = await call("post", "/request/create", { body: { cipherId: "c" } });
    const activate = await call("post", "/request/:requestId/activate", {
      params: { requestId: "r" },
    });
    const cancel = await call("post", "/request/:requestId/cancel", { params: { requestId: "r" } });

    expect(create.status).toBe(400);
    expect(activate.status).toBe(400);
    expect(cancel.status).toBeUndefined();
    expect(operations.create).not.toHaveBeenCalled();
    expect(operations.activate).not.toHaveBeenCalled();
    expect(operations.cancel).toHaveBeenCalled();
  });
});

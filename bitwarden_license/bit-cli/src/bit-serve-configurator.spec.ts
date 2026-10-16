import { Router, RouterContext } from "@koa/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { Response } from "@bitwarden/cli/models/response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { BitServeConfigurator } from "./bit-serve-configurator";
import { AccessGrantCommand } from "./secrets-manager/access/access-grant.command";
import { AccessTokenCreateCommand } from "./secrets-manager/access-tokens/access-token-create.command";
import { SmExportCommand } from "./secrets-manager/porting/sm-export.command";
import { SmImportCommand } from "./secrets-manager/porting/sm-import.command";
import { ProjectGetCommand } from "./secrets-manager/projects/project-get.command";
import { TrashRestoreCommand } from "./secrets-manager/trash/trash-restore.command";
import { ServiceContainer } from "./service-container";

describe("BitServeConfigurator", () => {
  const orgId = "11111111-1111-1111-1111-111111111111";
  const id = "22222222-2222-2222-2222-222222222222";
  let configurator: BitServeConfigurator;
  let router: Router;
  let errorIfLocked: jest.SpyInstance;
  const configService = mock<ConfigService>();

  const findRoute = (method: string, path: string) => {
    const layer = router.stack.find((l) => l.path === path && l.methods.includes(method));
    if (layer == null) {
      throw new Error(method + " " + path + " is not registered");
    }
    return layer.stack[layer.stack.length - 1];
  };

  const call = async (
    method: string,
    path: string,
    params: Record<string, string>,
    request: { body?: unknown; query?: Record<string, string> } = {},
  ) => {
    const ctx = {
      params,
      request: { body: request.body, query: request.query ?? {} },
      response: {} as { status?: number; body?: unknown },
    };
    const next = jest.fn().mockResolvedValue(undefined);
    await findRoute(method, path)(ctx as unknown as RouterContext, next);
    expect(next).toHaveBeenCalled();
    return ctx.response;
  };

  beforeEach(async () => {
    jest.restoreAllMocks();
    configService.getFeatureFlag$.mockReturnValue(of(true));
    configurator = new BitServeConfigurator(mock<ServiceContainer>({ configService }));
    router = new Router();
    (configurator as unknown as { serveSecretsManager(r: Router): void }).serveSecretsManager(
      router,
    );
    errorIfLocked = jest
      .spyOn(configurator as unknown as { errorIfLocked(): Promise<boolean> }, "errorIfLocked")
      .mockResolvedValue(false);
  });

  it.each([
    ["GET", "/sm/template/:object"],
    ["GET", "/sm/:organizationId/projects"],
    ["POST", "/sm/:organizationId/projects"],
    ["GET", "/sm/:organizationId/projects/:projectId"],
    ["PUT", "/sm/:organizationId/projects/:projectId"],
    ["DELETE", "/sm/:organizationId/projects/:projectId"],
    ["GET", "/sm/:organizationId/secrets"],
    ["POST", "/sm/:organizationId/secrets"],
    ["GET", "/sm/:organizationId/secrets/:secretId"],
    ["PUT", "/sm/:organizationId/secrets/:secretId"],
    ["DELETE", "/sm/:organizationId/secrets/:secretId"],
    ["GET", "/sm/:organizationId/secrets/:secretId/versions"],
    ["POST", "/sm/:organizationId/secrets/:secretId/versions/:versionId/restore"],
    ["GET", "/sm/:organizationId/trash"],
    ["POST", "/sm/:organizationId/trash/restore"],
    ["POST", "/sm/:organizationId/trash/empty"],
    ["GET", "/sm/:organizationId/machine-accounts"],
    ["POST", "/sm/:organizationId/machine-accounts"],
    ["GET", "/sm/:organizationId/machine-accounts/:machineAccountId"],
    ["PUT", "/sm/:organizationId/machine-accounts/:machineAccountId"],
    ["DELETE", "/sm/:organizationId/machine-accounts/:machineAccountId"],
    ["GET", "/sm/:organizationId/machine-accounts/:machineAccountId/events"],
    ["GET", "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens"],
    ["POST", "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens"],
    [
      "DELETE",
      "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens/:accessTokenId",
    ],
    ["GET", "/sm/:organizationId/access/:target/:id"],
    ["PUT", "/sm/:organizationId/access/:target/:id"],
    ["POST", "/sm/:organizationId/access/:target/:id/grant"],
    ["POST", "/sm/:organizationId/access/:target/:id/revoke"],
    ["GET", "/sm/:organizationId/grantees/:type"],
    ["GET", "/sm/:organizationId/counts"],
    ["POST", "/sm/:organizationId/export"],
    ["POST", "/sm/:organizationId/import"],
  ])("registers %s %s", (method, path) => {
    expect(() => findRoute(method, path)).not.toThrow();
  });

  it("does not run the command when the SmCli flag is off", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(false));
    const run = jest.fn();
    jest
      .spyOn(ProjectGetCommand, "create")
      .mockReturnValue({ run } as unknown as ProjectGetCommand);

    const res = await call("GET", "/sm/:organizationId/projects/:projectId", {
      organizationId: orgId,
      projectId: id,
    });

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.SmCli);
    expect(run).not.toHaveBeenCalled();
    expect(errorIfLocked).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: false,
      message: "This command is temporarily unavailable.",
    });
  });

  it("does not run the command when the vault is locked", async () => {
    errorIfLocked.mockResolvedValue(true);
    const run = jest.fn();
    jest
      .spyOn(ProjectGetCommand, "create")
      .mockReturnValue({ run } as unknown as ProjectGetCommand);

    await call("GET", "/sm/:organizationId/projects/:projectId", {
      organizationId: orgId,
      projectId: id,
    });

    expect(run).not.toHaveBeenCalled();
  });

  it("passes path parameters to the command and returns its response", async () => {
    const run = jest.fn().mockResolvedValue(Response.error("Nope."));
    jest
      .spyOn(ProjectGetCommand, "create")
      .mockReturnValue({ run } as unknown as ProjectGetCommand);

    const res = await call("GET", "/sm/:organizationId/projects/:projectId", {
      organizationId: orgId,
      projectId: id,
    });

    expect(run).toHaveBeenCalledWith(orgId, id);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, message: "Nope." });
  });

  it("reads grant options from the body, ignoring non-string values", async () => {
    const run = jest.fn().mockResolvedValue(Response.success());
    jest
      .spyOn(AccessGrantCommand, "create")
      .mockReturnValue({ run } as unknown as AccessGrantCommand);

    await call(
      "POST",
      "/sm/:organizationId/access/:target/:id/grant",
      { organizationId: orgId, target: "project", id },
      { body: { grantee: "alice@example.com", permission: 5 } },
    );

    expect(run).toHaveBeenCalledWith(orgId, "project", id, "alice@example.com", undefined);
  });

  it.each([
    [{ name: "CI", expires: "never" }, "never"],
    [{ name: "CI", expires: "none" }, "none"],
    [{ name: "CI", expires: "2099-12-31" }, "2099-12-31"],
  ])("passes the access token body %j to the create command", async (body, expires) => {
    const run = jest.fn().mockResolvedValue(Response.success());
    jest
      .spyOn(AccessTokenCreateCommand, "create")
      .mockReturnValue({ run } as unknown as AccessTokenCreateCommand);

    await call(
      "POST",
      "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens",
      { organizationId: orgId, machineAccountId: id },
      { body },
    );

    expect(run).toHaveBeenCalledWith(orgId, id, { name: "CI", expires });
  });

  it.each([
    [{ name: "CI" }],
    [{ name: "CI", expires: "" }],
    [{ name: "CI", expires: "  " }],
    [{ name: "CI", expires: null }],
    [{ name: "CI", expires: 1767225600 }],
    [{ name: "CI", expiresAt: "2099-12-31" }],
  ])("rejects the access token body %j without an explicit expiry", async (body) => {
    const run = jest.fn().mockResolvedValue(Response.success());
    jest
      .spyOn(AccessTokenCreateCommand, "create")
      .mockReturnValue({ run } as unknown as AccessTokenCreateCommand);

    const res = await call(
      "POST",
      "/sm/:organizationId/machine-accounts/:machineAccountId/access-tokens",
      { organizationId: orgId, machineAccountId: id },
      { body },
    );

    expect(run).not.toHaveBeenCalled();
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message:
        "`expires` is required. Use `never` for an access token that does not expire, or an ISO 8601 date.",
    });
  });

  it("reads the trash selection from the body", async () => {
    const run = jest.fn().mockResolvedValue(Response.success());
    jest
      .spyOn(TrashRestoreCommand, "create")
      .mockReturnValue({ run } as unknown as TrashRestoreCommand);

    await call(
      "POST",
      "/sm/:organizationId/trash/restore",
      { organizationId: orgId },
      { body: { secretIds: [id, 7] } },
    );

    expect(run).toHaveBeenCalledWith(orgId, { secretIds: [id], all: false });
  });

  it("imports the request body", async () => {
    const run = jest.fn().mockResolvedValue(Response.success());
    jest.spyOn(SmImportCommand, "create").mockReturnValue({ run } as unknown as SmImportCommand);
    const body = { projects: [] as unknown[], secrets: [] as unknown[] };

    await call("POST", "/sm/:organizationId/import", { organizationId: orgId }, { body });

    expect(run).toHaveBeenCalledWith(orgId, { data: body });
  });
  it("passes the master password from the export body to the command", async () => {
    const run = jest.fn().mockResolvedValue(Response.success());
    jest.spyOn(SmExportCommand, "create").mockReturnValue({ run } as unknown as SmExportCommand);

    await call(
      "POST",
      "/sm/:organizationId/export",
      { organizationId: orgId },
      { body: { password: "master-password" }, query: { passwordFile: "/etc/passwd" } },
    );

    expect(run).toHaveBeenCalledWith(orgId, { password: "master-password" });
  });

  it("does not register a GET export route", () => {
    expect(() => findRoute("GET", "/sm/:organizationId/export")).toThrow();
  });
});

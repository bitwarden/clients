import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  PAM_TEST_USER_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import type { ServiceContainer } from "../../service-container";

import { RequestOperations } from "./request.operations";
import { RequestsProgram } from "./requests.program";

class ExitError extends Error {}

describe("RequestsProgram", () => {
  const CIPHER = "44444444-4444-4444-8444-444444444444";
  const REQUEST = "55555555-5555-4555-8555-555555555555";
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  let operations: ReturnType<typeof mock<RequestOperations>>;
  let seat: boolean;
  let stdout: jest.SpyInstance;

  const run = async (...args: string[]) => {
    await new RequestsProgram(container, operations).command().parseAsync(args, { from: "user" });
  };

  beforeEach(() => {
    jest.resetAllMocks();
    for (const key of ["BW_RESPONSE", "BW_QUIET", "BW_RAW", "BW_CLEANEXIT", "BW_PRETTY"]) {
      delete process.env[key];
    }
    seat = true;
    operations = mock<RequestOperations>();
    Object.assign(container, {
      configService,
      organizationService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.organizations$.mockImplementation((() =>
      of([pamTestOrganization({ accessPam: seat })])) as never);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue(undefined);
    jest.spyOn(process, "exit").mockImplementation((() => {
      throw new ExitError();
    }) as never);
    stdout = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    jest.spyOn(process.stderr, "write").mockReturnValue(true);
    operations.status.mockResolvedValue(Response.success(new MessageResponse("ok", null)));
    operations.create.mockResolvedValue(Response.success(new MessageResponse("ok", null)));
    operations.activate.mockResolvedValue(Response.success(new MessageResponse("ok", null)));
    operations.cancel.mockResolvedValue(Response.success(new MessageResponse("ok", null)));
    operations.list.mockResolvedValue(Response.success(new MessageResponse("ok", null)));
    operations.get.mockResolvedValue(Response.success(new MessageResponse("ok", null)));
  });

  it("defines the six verbs", () => {
    const names = new RequestsProgram(container, operations)
      .command()
      .commands.map((c) => c.name());

    expect(names).toEqual(["status", "create", "list", "get", "activate", "cancel"]);
  });

  it("passes --precheck and --names to status", async () => {
    await run("status", CIPHER, "--precheck", "--names");

    expect(operations.status).toHaveBeenCalledWith(
      PAM_TEST_USER_ID,
      CIPHER,
      expect.objectContaining({ precheck: true, names: true }),
    );
  });

  it("passes the create flags and the reason text", async () => {
    await run("create", CIPHER, "--duration", "1h", "--reason", "  because  ");

    expect(operations.create).toHaveBeenCalledWith(PAM_TEST_USER_ID, {
      cipherId: CIPHER,
      duration: "1h",
      start: undefined,
      end: undefined,
      reason: "because",
    });
  });

  it("refuses two reason sources without echoing either", async () => {
    await run("create", CIPHER, "--reason", "secret-reason", "--reasonstdin");

    expect(operations.create).not.toHaveBeenCalled();
    const printed = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(printed).not.toContain("secret-reason");
  });

  it("needs a seat for create and activate but not for cancel", async () => {
    seat = false;

    await expect(run("create", CIPHER, "--duration", "1h")).rejects.toThrow(ExitError);
    await expect(run("activate", REQUEST)).rejects.toThrow(ExitError);
    expect(operations.create).not.toHaveBeenCalled();
    expect(operations.activate).not.toHaveBeenCalled();

    await run("cancel", REQUEST);
    expect(operations.cancel).toHaveBeenCalledWith(PAM_TEST_USER_ID, REQUEST);
  });

  it("does not need a seat for status, list or get", async () => {
    seat = false;

    await run("status", CIPHER);
    await run("list", "--status", "pending");
    await run("get", REQUEST);

    expect(operations.status).toHaveBeenCalled();
    expect(operations.list).toHaveBeenCalledWith(
      PAM_TEST_USER_ID,
      expect.objectContaining({ status: "pending" }),
    );
    expect(operations.get).toHaveBeenCalled();
  });

  it("is unavailable when the PAM flag is off", async () => {
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(flag !== FeatureFlag.Pam)) as never);

    await expect(run("list")).rejects.toThrow(ExitError);
    expect(operations.list).not.toHaveBeenCalled();
  });

  it("turns a thrown error into a failed response", async () => {
    operations.activate.mockRejectedValue(new Error("boom"));

    await run("activate", REQUEST);

    const printed = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(printed).not.toContain("boom");
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
  });
});

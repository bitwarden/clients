import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ConnectorService } from "@bitwarden/bit-common/pam/connectors";
import {
  PAM_TEST_ORGANIZATION_ID,
  pamTestAccountService,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import type { ServiceContainer } from "../../service-container";

import { ConnectorsProgram } from "./connectors.program";

const CONNECTOR_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_ID = "44444444-4444-4444-8444-444444444444";
const TOKEN = "one-time-token-value-9f8e7d";

class ExitError extends Error {}

describe("ConnectorsProgram", () => {
  const service = mock<ConnectorService>();
  const configService = mock<ConfigService>();
  const organizationService = mock<OrganizationService>();
  const container = mock<ServiceContainer>();
  let enabledFlags: Set<FeatureFlag>;
  let organization = pamTestOrganization({ type: OrganizationUserType.Admin });
  let stdout: string[];
  let stderr: string[];
  let tmp: string;

  const run = async (...args: string[]) => {
    const program = new ConnectorsProgram(container, service).command();
    program.exitOverride();
    program.configureOutput({ writeOut: () => undefined, writeErr: () => undefined });
    await program.parseAsync(["node", "bw", ...args]);
  };
  const org = ["--organizationid", PAM_TEST_ORGANIZATION_ID];

  beforeEach(() => {
    jest.resetAllMocks();
    for (const key of ["BW_RESPONSE", "BW_QUIET", "BW_RAW", "BW_CLEANEXIT"]) {
      delete process.env[key];
    }
    process.exitCode = undefined;
    enabledFlags = new Set([FeatureFlag.Pam, FeatureFlag.PamAccessConnector]);
    organization = pamTestOrganization({ type: OrganizationUserType.Admin });
    Object.assign(container, {
      configService,
      organizationService,
      accountService: pamTestAccountService(),
    });
    configService.getFeatureFlag$.mockImplementation(((flag: FeatureFlag) =>
      of(enabledFlags.has(flag))) as never);
    organizationService.organizations$.mockImplementation((() => of([organization])) as never);
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue(undefined);
    jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(`exit ${code}`);
    }) as never);
    stdout = [];
    stderr = [];
    jest.spyOn(process.stdout, "write").mockImplementation(((s: string) => {
      stdout.push(s);
      return true;
    }) as never);
    jest.spyOn(process.stderr, "write").mockImplementation(((s: string) => {
      stderr.push(s);
      return true;
    }) as never);
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pam-connector-spec-"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  const registration = () => ({
    id: CONNECTOR_ID,
    organizationId: PAM_TEST_ORGANIZATION_ID,
    name: "edge-1",
    status: "enabled" as const,
    creationDate: "2026-01-01T00:00:00Z",
    token: TOKEN,
  });

  describe("gates", () => {
    it("exits when PamAccessConnector is off", async () => {
      enabledFlags.delete(FeatureFlag.PamAccessConnector);

      await expect(run("list", ...org)).rejects.toBeInstanceOf(ExitError);

      expect(service.list).not.toHaveBeenCalled();
      expect(stderr.join("")).toContain("temporarily unavailable");
    });

    it("exits when FeatureFlag.Pam is off", async () => {
      enabledFlags.delete(FeatureFlag.Pam);
      await expect(run("list", ...org)).rejects.toBeInstanceOf(ExitError);
      expect(service.list).not.toHaveBeenCalled();
    });

    it("lets a member with no rotation rights read but not write", async () => {
      organization = pamTestOrganization({ type: OrganizationUserType.User });
      service.list.mockResolvedValue([]);

      await run("list", ...org);
      expect(service.list).toHaveBeenCalled();

      await expect(run("enable", CONNECTOR_ID, ...org)).rejects.toBeInstanceOf(ExitError);
      expect(service.enable).not.toHaveBeenCalled();
      expect(stderr.join("")).toContain("credential rotation");
    });

    it("lets a custom role with manageRotation write", async () => {
      organization = pamTestOrganization({
        type: OrganizationUserType.Custom,
        permissions: Object.assign(new PermissionsApi(), { manageRotation: true }),
      });
      await run("enable", CONNECTOR_ID, ...org);
      expect(service.enable).toHaveBeenCalled();
    });

    it("refuses provider users even for reads", async () => {
      organization = pamTestOrganization({ isProviderUser: true });
      await expect(run("list", ...org)).rejects.toBeInstanceOf(ExitError);
      expect(service.list).not.toHaveBeenCalled();
    });

    it("refuses a read when the organization does not use PAM, before any service call", async () => {
      organization = pamTestOrganization({ type: OrganizationUserType.Owner, usePam: false });

      await expect(run("list", ...org)).rejects.toBeInstanceOf(ExitError);
      await expect(run("get", CONNECTOR_ID, ...org)).rejects.toBeInstanceOf(ExitError);

      expect(service.list).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
      expect(stderr.join("")).toContain("This organization does not use Privileged Controls.");
    });

    it("refuses an organization the user is not in, before any service call", async () => {
      await expect(
        run("list", "--organizationid", "99999999-9999-4999-8999-999999999999"),
      ).rejects.toBeInstanceOf(ExitError);

      expect(service.list).not.toHaveBeenCalled();
      expect(stderr.join("")).toContain("Organization not found, or you are not a member of it.");
    });

    it("refuses an organization id that is not a GUID", async () => {
      await expect(run("list", "--organizationid", "nope")).rejects.toBeInstanceOf(ExitError);
      expect(service.list).not.toHaveBeenCalled();
    });
  });

  describe("reads", () => {
    it("lists connectors as JSON-friendly objects", async () => {
      service.list.mockResolvedValue([
        {
          id: CONNECTOR_ID,
          organizationId: PAM_TEST_ORGANIZATION_ID,
          name: "edge-1",
          status: "enabled",
          isConnected: false,
          assignedTargetSystemIds: [TARGET_ID],
          creationDate: "2026-01-01T00:00:00Z",
          revisionDate: "2026-01-01T00:00:00Z",
        },
      ]);

      await run("list", ...org);

      const out = JSON.parse(stdout.join(""));
      expect(out[0]).toMatchObject({
        object: "pam-connector",
        id: CONNECTOR_ID,
        creationDate: "2026-01-01T00:00:00.000Z",
        assignedTargetSystemIds: [TARGET_ID],
      });
    });

    it("prints the sanitized failure reason from get", async () => {
      service.get.mockResolvedValue({
        id: CONNECTOR_ID,
        organizationId: PAM_TEST_ORGANIZATION_ID,
        name: "edge-1",
        status: "enabled",
        isConnected: true,
        assignedTargetSystemIds: [],
        creationDate: "2026-01-01T00:00:00Z",
        revisionDate: "2026-01-01T00:00:00Z",
        jobs: [
          {
            id: CONNECTOR_ID,
            rotationConfigId: TARGET_ID,
            source: "scheduled",
            status: "failed",
            createdAt: "2026-01-01T00:00:00Z",
            attemptCount: 1,
            latestFailureReason: "cleaned reason",
          },
        ],
      });

      await run("get", CONNECTOR_ID, ...org);

      expect(JSON.parse(stdout.join("")).jobs[0].latestFailureReason).toBe("cleaned reason");
    });

    it("refuses a connector id that is not a GUID before calling the service", async () => {
      await run("get", "nope", ...org);
      expect(process.exitCode).toBe(1);
      expect(service.get).not.toHaveBeenCalled();
    });
  });

  describe("register", () => {
    it("prints the token once to stdout with the one-time warning on stderr", async () => {
      service.register.mockResolvedValue(registration());

      await run("register", "edge-1", ...org);

      expect(JSON.parse(stdout.join("")).token).toBe(TOKEN);
      expect(stdout.join("").split(TOKEN)).toHaveLength(2);
      expect(stderr.join("")).toContain("cannot be recovered");
      expect(stderr.join("")).not.toContain(TOKEN);
    });

    it("prints only the token under BW_RAW", async () => {
      process.env.BW_RAW = "true";
      service.register.mockResolvedValue(registration());

      await run("register", "edge-1", ...org);

      expect(stdout.join("").trim()).toBe(TOKEN);
    });

    it("prints the token once under BW_RESPONSE", async () => {
      process.env.BW_RESPONSE = "true";
      service.register.mockResolvedValue(registration());

      await run("register", "edge-1", ...org);

      expect(stdout.join("").split(TOKEN)).toHaveLength(2);
      expect(JSON.parse(stdout.join("")).data.token).toBe(TOKEN);
    });

    it("writes a 0600 file and keeps the token out of stdout and stderr", async () => {
      service.register.mockResolvedValue(registration());
      const file = path.join(tmp, "edge.token");

      await run("register", "edge-1", ...org, "--token-file", file);

      expect(fs.readFileSync(file, "utf8")).toBe(TOKEN);
      if (process.platform !== "win32") {
        expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      }
      expect(stdout.join("")).not.toContain(TOKEN);
      expect(stderr.join("")).not.toContain(TOKEN);
      expect(JSON.parse(stdout.join("")).tokenFile).toBe(file);
    });

    it("refuses an existing token file before registering anything", async () => {
      const file = path.join(tmp, "edge.token");
      fs.writeFileSync(file, "keep");

      await run("register", "edge-1", ...org, "--token-file", file);

      expect(service.register).not.toHaveBeenCalled();
      expect(fs.readFileSync(file, "utf8")).toBe("keep");
      expect(process.exitCode).toBe(1);
    });

    it("removes the reserved file when registration fails, and never prints the token", async () => {
      service.register.mockRejectedValue(new Error("boom"));
      const file = path.join(tmp, "edge.token");

      await run("register", "edge-1", ...org, "--token-file", file);

      expect(fs.existsSync(file)).toBe(false);
      expect(process.exitCode).toBe(1);
      expect(stdout.join("") + stderr.join("")).not.toContain(TOKEN);
    });

    it("removes the token file when the write fails and prints the token instead", async () => {
      service.register.mockResolvedValue(registration());
      const file = path.join(tmp, "edge.token");
      const spy = jest.spyOn(fs, "writeSync").mockImplementation(() => {
        throw new Error("ENOSPC");
      });

      await run("register", "edge-1", ...org, "--token-file", file);
      spy.mockRestore();

      expect(fs.existsSync(file)).toBe(false);
      expect(stdout.join("")).toContain(TOKEN);
      expect(stderr.join("")).not.toContain(TOKEN);
    });

    it("refuses to register under BW_QUIET without a token file, so the token is not lost", async () => {
      process.env.BW_QUIET = "true";

      await run("register", "edge-1", ...org);

      expect(service.register).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("refuses an empty name", async () => {
      await run("register", "   ", ...org);
      expect(service.register).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("needs rotation rights", async () => {
      organization = pamTestOrganization({ type: OrganizationUserType.User });
      await expect(run("register", "edge-1", ...org)).rejects.toBeInstanceOf(ExitError);
      expect(service.register).not.toHaveBeenCalled();
    });

    it("documents that the token cannot be recovered", () => {
      const register = new ConnectorsProgram(container, service)
        .command()
        .commands.find((c) => c.name() === "register");
      let help = "";
      register?.configureOutput({ writeOut: (s) => (help += s) });
      register?.outputHelp();
      // The Notes block is written through CliUtils, which writes to process.stdout.
      expect(help + stdout.join("")).toContain("cannot be recovered");
    });
  });

  describe("state changes", () => {
    it("enables, disables, assigns and unassigns", async () => {
      await run("enable", CONNECTOR_ID, ...org);
      await run("disable", CONNECTOR_ID, ...org);
      await run("assign", CONNECTOR_ID, TARGET_ID, ...org);
      await run("unassign", CONNECTOR_ID, TARGET_ID, ...org);

      expect(service.enable).toHaveBeenCalledWith(
        expect.anything(),
        PAM_TEST_ORGANIZATION_ID,
        CONNECTOR_ID,
      );
      expect(service.disable).toHaveBeenCalled();
      expect(service.assign).toHaveBeenCalledWith(
        expect.anything(),
        PAM_TEST_ORGANIZATION_ID,
        CONNECTOR_ID,
        TARGET_ID,
      );
      expect(service.unassign).toHaveBeenCalled();
    });

    it("validates the target system id as a GUID and calls nothing else", async () => {
      await run("assign", CONNECTOR_ID, "x", ...org);
      expect(process.exitCode).toBe(1);
      expect(service.assign).not.toHaveBeenCalled();
    });

    it("refuses delete without --yes", async () => {
      await run("delete", CONNECTOR_ID, ...org);

      expect(service.delete).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(stderr.join("")).toContain("--yes");
    });

    it("deletes with --yes", async () => {
      await run("delete", CONNECTOR_ID, ...org, "--yes");

      expect(service.delete).toHaveBeenCalledWith(
        expect.anything(),
        PAM_TEST_ORGANIZATION_ID,
        CONNECTOR_ID,
      );
      expect(JSON.parse(stdout.join("")).action).toBe("deleted");
    });

    it("turns a service failure into a failed response without a payload", async () => {
      service.disable.mockRejectedValue(new Error("secret /etc/path detail"));

      await run("disable", CONNECTOR_ID, ...org);

      expect(process.exitCode).toBe(1);
      expect(stderr.join("") + stdout.join("")).not.toContain("/etc/path");
    });
  });
});

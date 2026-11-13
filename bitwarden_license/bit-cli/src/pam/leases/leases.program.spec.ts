import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  createPamSdkTestKit,
  pamTestOrganization,
} from "@bitwarden/bit-common/pam/shared/testing/pam-test-helpers";
import { BaseProgram } from "@bitwarden/cli/base-program";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import type { AccessRequestsClient, CipherView, LeasesClient } from "@bitwarden/sdk-internal";

import type { ServiceContainer } from "../../service-container";

import { LeasesProgram } from "./leases.program";

const LEASE_ID = "33333333-3333-4333-8333-333333333333";
const CIPHER_ID = "44444444-4444-4444-8444-444444444444";

const liveLease = () => ({
  id: LEASE_ID,
  requestId: "55555555-5555-4555-8555-555555555555",
  cipherId: CIPHER_ID,
  collectionId: "66666666-6666-4666-8666-666666666666",
  status: "active",
  notBefore: "2020-01-01T00:00:00Z",
  notAfter: "2999-01-01T00:00:00Z",
});

describe("LeasesProgram", () => {
  let kit: ReturnType<typeof createPamSdkTestKit>;
  let leases: ReturnType<typeof mock<LeasesClient>>;
  let accessRequests: ReturnType<typeof mock<AccessRequestsClient>>;
  let organizations: ReturnType<typeof mock<OrganizationService>>;
  let program: LeasesProgram;
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;
  let organization = pamTestOrganization();

  const run = async (...args: string[]) =>
    await program.command().parseAsync(["node", "lease", ...args]);
  const printed = () => stdout.mock.calls.map((c) => String(c[0])).join("");

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    for (const key of ["BW_RESPONSE", "BW_QUIET", "BW_RAW", "BW_CLEANEXIT", "BW_PRETTY"]) {
      delete process.env[key];
    }
    process.env.BW_RESPONSE = "true";
    kit = createPamSdkTestKit();
    leases = mock<LeasesClient>();
    accessRequests = mock<AccessRequestsClient>();
    kit.pam.leases.mockReturnValue(leases);
    kit.pam.access_requests.mockReturnValue(accessRequests);
    organization = pamTestOrganization();
    organizations = mock<OrganizationService>();
    organizations.organizations$.mockReturnValue(of([organization]));
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(of(true));
    expect(FeatureFlag.Pam).toBeDefined();

    const container = mock<ServiceContainer>();
    Object.assign(container, {
      sdkService: kit.sdkService,
      accountService: kit.accountService,
      logService: kit.logService,
      organizationService: organizations,
      configService,
    });
    jest
      .spyOn(
        BaseProgram.prototype as unknown as { exitIfLocked: () => Promise<void> },
        "exitIfLocked",
      )
      .mockResolvedValue(undefined);
    jest.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    stdout = jest.spyOn(process.stdout, "write").mockReturnValue(true);
    stderr = jest.spyOn(process.stderr, "write").mockReturnValue(true);
    program = new LeasesProgram(container);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("lists leases as flat pam-lease objects with ids and states only", async () => {
    leases.list_mine.mockResolvedValue([liveLease()] as never);

    await run("list");

    const out = JSON.parse(printed());
    expect(out.data.data[0]).toMatchObject({ object: "pam-lease", id: LEASE_ID, status: "active" });
    expect(Object.keys(out.data.data[0])).not.toContain("termination");
  });

  it("refuses to end a lease without --yes and sends nothing", async () => {
    await run("end", LEASE_ID);

    expect(leases.end).not.toHaveBeenCalled();
    expect(process.exitCode ?? 0).not.toBe(0);
  });

  it("ends a lease with --yes", async () => {
    leases.end.mockResolvedValue(undefined);

    await run("end", LEASE_ID, "--yes");

    expect(leases.end).toHaveBeenCalledWith(LEASE_ID, { reason: undefined });
    expect(printed()).toContain(LEASE_ID);
  });

  it("refuses extend for a member without a PAM seat", async () => {
    organization.accessPam = false;

    await expect(run("extend", LEASE_ID, "--duration", "1h", "--reason", "why")).rejects.toThrow(
      "exit 1",
    );

    expect(leases.extend).not.toHaveBeenCalled();
  });

  it("fails with a lease ended message when the server resolves denied", async () => {
    leases.list_mine.mockResolvedValue([liveLease()] as never);
    accessRequests.cipher_access_state.mockResolvedValue({
      cipherId: CIPHER_ID,
      activeLease: liveLease(),
      extensionsAllowed: true,
      maxExtensionDurationSeconds: 7200,
    } as never);
    leases.extend.mockResolvedValue({ id: LEASE_ID, status: "denied" } as never);

    await run("extend", LEASE_ID, "--duration", "1h", "--reason", "why");

    expect(printed() + stderr.mock.calls.map((c) => String(c[0])).join("")).toContain(
      "The lease has ended",
    );
    expect(process.exitCode ?? 0).not.toBe(0);
  });

  it("requires --field for reveal", async () => {
    await expect(run("reveal", CIPHER_ID)).rejects.toBeDefined();
  });

  it("reveals only the requested field to stdout", async () => {
    accessRequests.cipher_access_state.mockResolvedValue({
      cipherId: CIPHER_ID,
      activeLease: liveLease(),
    } as never);
    leases.leased_cipher.mockResolvedValue({
      id: CIPHER_ID,
      partial: false,
      type: 1,
      login: { username: "root", password: "hunter2" },
    } as unknown as CipherView);

    await run("reveal", CIPHER_ID, "--field", "password");

    expect(printed()).toContain("hunter2");
    expect(printed()).not.toContain("root");
    expect(kit.logService.error).not.toHaveBeenCalled();
  });

  it("fails closed with access not available and prints no secret", async () => {
    accessRequests.cipher_access_state.mockResolvedValue({
      cipherId: CIPHER_ID,
      activeLease: liveLease(),
    } as never);
    leases.leased_cipher.mockResolvedValue(undefined);

    await run("reveal", CIPHER_ID, "--field", "password");

    expect(printed() + stderr.mock.calls.map((c) => String(c[0])).join("")).toContain(
      "access not available",
    );
    expect(process.exitCode ?? 0).not.toBe(0);
  });
});

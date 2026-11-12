import { mock } from "jest-mock-extended";

import type {
  RotationClient,
  TargetSystemId,
  TargetSystemsClient,
  TargetSystemView,
} from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import {
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
  createPamSdkTestKit,
} from "../shared/testing/pam-test-helpers";

import { TargetSystemPendingSealError, TargetSystemService } from "./target-system.service";

const TARGET_ID = "33333333-3333-4333-8333-333333333333";
const policy = {
  minLength: 16,
  maxLength: 32,
  includeUppercase: true,
  includeLowercase: true,
  includeDigits: true,
  includeSymbols: true,
};

function view(overrides: Partial<TargetSystemView> = {}): TargetSystemView {
  return {
    id: TARGET_ID as unknown as TargetSystemId,
    organizationId: PAM_TEST_ORGANIZATION_ID,
    name: "Vendor\u001b[31m",
    method: "manual",
    status: "active",
    sealed: { kind: undefined, passwordPolicy: policy, supportsSessionTermination: undefined },
    creationDate: "2026-01-01T00:00:00Z",
    revisionDate: "2026-01-02T00:00:00Z",
    ...overrides,
  } as unknown as TargetSystemView;
}

describe("TargetSystemService", () => {
  let kit: ReturnType<typeof createPamSdkTestKit>;
  const targets = mock<TargetSystemsClient>();
  const rotation = mock<RotationClient>();
  let service: TargetSystemService;

  beforeEach(() => {
    jest.resetAllMocks();
    kit = createPamSdkTestKit();
    rotation.target_systems.mockReturnValue(targets);
    kit.pam.rotation.mockReturnValue(rotation);
    kit.sdkService.userClient$.mockClear();
    service = new TargetSystemService(kit.pamSdkService);
  });

  it("lists flat summaries without sealed fields and with a sanitized name", async () => {
    targets.list.mockResolvedValue([view(), view({ sealed: undefined, status: "pending_seal" })]);

    const result = await service.list(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID);

    expect(result[0]).toEqual({
      id: TARGET_ID,
      organizationId: PAM_TEST_ORGANIZATION_ID,
      name: "Vendor[31m",
      method: "manual",
      status: "active",
      sealed: true,
      creationDate: "2026-01-01T00:00:00Z",
      revisionDate: "2026-01-02T00:00:00Z",
    });
    expect(result[1].sealed).toBe(false);
    expect(JSON.stringify(result)).not.toContain("passwordPolicy");
  });

  it("refuses a bad organization id before calling the SDK", async () => {
    await expect(service.list(PAM_TEST_USER_ID, "nope")).rejects.toBeInstanceOf(PamInputError);
    expect(targets.list).not.toHaveBeenCalled();
  });

  it("creates and returns a summary", async () => {
    targets.create.mockResolvedValue(view());
    const request = { method: "manual", name: "Vendor", passwordPolicy: policy } as const;

    const created = await service.create(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, request);

    expect(targets.create).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, request);
    expect(created.id).toBe(TARGET_ID);
  });

  it("surfaces the pending id when the seal step fails", async () => {
    targets.create.mockRejectedValue({ id: TARGET_ID, message: "seal failed" });

    const failure = await service
      .create(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, {
        method: "manual",
        name: "Vendor",
        passwordPolicy: policy,
      })
      .catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(TargetSystemPendingSealError);
    expect((failure as TargetSystemPendingSealError).id).toBe(TARGET_ID);
  });

  it("rethrows a create failure that created nothing", async () => {
    const error = { id: undefined as string | undefined, message: "nothing created" };
    targets.create.mockRejectedValue(error);

    await expect(
      service.create(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, {
        method: "manual",
        name: "Vendor",
        passwordPolicy: policy,
      }),
    ).rejects.toBe(error);
  });

  it("update merges name and method from the list but nothing sealed", async () => {
    targets.list.mockResolvedValue([view({ name: "Existing" })]);
    targets.update.mockResolvedValue();

    await service.update(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, TARGET_ID, {
      passwordPolicy: policy,
    });

    expect(targets.update).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, TARGET_ID, {
      method: "manual",
      name: "Existing",
      passwordPolicy: policy,
    });
  });

  it("update does not list when name and method are given", async () => {
    targets.update.mockResolvedValue();

    await service.update(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, TARGET_ID, {
      method: "manual",
      name: "Renamed",
      passwordPolicy: policy,
    });

    expect(targets.list).not.toHaveBeenCalled();
  });

  it("update refuses an unlisted target and a missing sealed field", async () => {
    targets.list.mockResolvedValue([]);
    await expect(
      service.update(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, TARGET_ID, {
        passwordPolicy: policy,
      }),
    ).rejects.toThrow(/not found/);

    targets.list.mockResolvedValue([view()]);
    await expect(
      service.update(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, TARGET_ID, {}),
    ).rejects.toThrow(/passwordPolicy/);
    expect(targets.update).not.toHaveBeenCalled();
  });

  it.each(["enable", "disable", "delete"] as const)(
    "%s calls the SDK with branded ids",
    async (verb) => {
      targets[verb].mockResolvedValue();

      await service[verb](PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, TARGET_ID.toUpperCase());

      expect(targets[verb]).toHaveBeenCalledWith(PAM_TEST_ORGANIZATION_ID, TARGET_ID);
    },
  );

  it("refuses a bad target id", async () => {
    await expect(
      service.delete(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, "x"),
    ).rejects.toBeInstanceOf(PamInputError);
    expect(targets.delete).not.toHaveBeenCalled();
  });
});

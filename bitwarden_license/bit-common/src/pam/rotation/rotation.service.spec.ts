import { mock, MockProxy } from "jest-mock-extended";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import type {
  RotationConfigActions,
  RotationConfigsClient,
  RotationConfigView,
  RotationScheduleClient,
} from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import {
  createPamSdkTestKit,
  PAM_TEST_ORGANIZATION_ID,
  PAM_TEST_USER_ID,
} from "../shared/testing/pam-test-helpers";

import { refusalReason, RotationService } from "./rotation.service";

const CONFIG_ID = "55555555-5555-4555-8555-555555555555";
const CIPHER = "33333333-3333-4333-8333-333333333333";
const TARGET = "44444444-4444-4444-8444-444444444444";

function view(overrides: Partial<RotationConfigView> = {}): RotationConfigView {
  return {
    id: CONFIG_ID,
    organizationId: PAM_TEST_ORGANIZATION_ID,
    cipherId: CIPHER,
    targetSystemId: TARGET,
    targetSystemName: "Target",
    targetSystemMethod: "automatic",
    sealed: { accountIdentity: "svc", terminateSessions: false },
    scheduleCron: undefined,
    rotateOnAccessEnd: false,
    enabled: true,
    hasActiveJob: false,
    awaitingManualRotation: false,
    ...overrides,
  } as unknown as RotationConfigView;
}

function actions(overrides: Partial<RotationConfigActions> = {}): RotationConfigActions {
  return {
    canRotateNow: true,
    canRecordManual: false,
    mutationsLocked: false,
    canPause: true,
    canResume: false,
    ...overrides,
  };
}

describe("RotationService", () => {
  let kit: ReturnType<typeof createPamSdkTestKit>;
  let configs: MockProxy<RotationConfigsClient>;
  let schedule: MockProxy<RotationScheduleClient>;
  let service: RotationService;

  beforeEach(() => {
    kit = createPamSdkTestKit();
    configs = mock<RotationConfigsClient>();
    schedule = mock<RotationScheduleClient>();
    kit.pam.rotation.mockReturnValue({ configs: () => configs, schedule: () => schedule } as never);
    service = new RotationService(kit.pamSdkService);
    configs.get.mockResolvedValue({ config: view(), jobs: [] });
    configs.actions.mockReturnValue(actions());
  });

  it("lists configs with their actions", async () => {
    configs.list.mockResolvedValue([view()]);
    const items = await service.list(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID);
    expect(items).toHaveLength(1);
    expect(items[0].actions.canRotateNow).toBe(true);
  });

  it("limits the jobs of get", async () => {
    const jobs = [{ id: "a" }, { id: "b" }, { id: "c" }] as never;
    configs.get.mockResolvedValue({ config: view(), jobs });
    const detail = await service.get(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONFIG_ID, 2);
    expect(detail.jobs).toHaveLength(2);
  });

  it("applies --schedule over the request cron on create", async () => {
    schedule.cron_for_preset.mockReturnValue("0 0 0 ? * 1");
    schedule.preset_for_cron.mockReturnValue("custom");
    configs.create.mockResolvedValue({ config: view(), jobs: [] });
    await service.create(
      PAM_TEST_USER_ID,
      PAM_TEST_ORGANIZATION_ID,
      JSON.stringify({ cipherId: CIPHER, targetSystemId: TARGET, accountIdentity: "svc" }),
      "weekly",
    );
    expect(configs.create.mock.calls[0][1].scheduleCron).toBe("0 0 0 ? * 1");
  });

  describe("update", () => {
    it("refuses a different cipher or target", async () => {
      const other = "66666666-6666-4666-8666-666666666666";
      await expect(
        service.update(
          PAM_TEST_USER_ID,
          PAM_TEST_ORGANIZATION_ID,
          CONFIG_ID,
          JSON.stringify({ cipherId: other }),
        ),
      ).rejects.toThrow(PamInputError);
      expect(configs.update).not.toHaveBeenCalled();
    });

    it("blocks account changes while mutations are locked but allows the schedule", async () => {
      configs.actions.mockReturnValue(actions({ mutationsLocked: true }));
      configs.update.mockResolvedValue({ config: view(), jobs: [] });
      await expect(
        service.update(
          PAM_TEST_USER_ID,
          PAM_TEST_ORGANIZATION_ID,
          CONFIG_ID,
          JSON.stringify({ accountIdentity: "other" }),
        ),
      ).rejects.toThrow("active");
      await service.update(
        PAM_TEST_USER_ID,
        PAM_TEST_ORGANIZATION_ID,
        CONFIG_ID,
        JSON.stringify({ scheduleCron: "0 0 1 * * ?" }),
      );
      expect(configs.update).toHaveBeenCalledTimes(1);
      expect(configs.update.mock.calls[0][2].accountIdentity).toBe("svc");
    });
  });

  it("refuses delete while mutations are locked", async () => {
    configs.actions.mockReturnValue(actions({ mutationsLocked: true }));
    await expect(
      service.delete(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONFIG_ID),
    ).rejects.toThrow(PamInputError);
    expect(configs.delete).not.toHaveBeenCalled();
  });

  describe("perform", () => {
    it("calls the SDK when the action is offered", async () => {
      await service.perform(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONFIG_ID, "rotate");
      expect(configs.rotate_now).toHaveBeenCalled();
    });

    it("surfaces the refusal reason and does not call the SDK", async () => {
      configs.get.mockResolvedValue({ config: view({ enabled: false }), jobs: [] });
      configs.actions.mockReturnValue(actions({ canRotateNow: false, canPause: false }));
      await expect(
        service.perform(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONFIG_ID, "rotate"),
      ).rejects.toThrow("paused");
      expect(configs.rotate_now).not.toHaveBeenCalled();
    });

    it("maps a cooldown refusal of rotate", async () => {
      configs.rotate_now.mockRejectedValue(new ErrorResponse({ Message: "slow down" }, 429));
      await expect(
        service.perform(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONFIG_ID, "rotate"),
      ).rejects.toThrow("cooldown");
    });

    it("records a manual rotation for a manual target", async () => {
      configs.get.mockResolvedValue({
        config: view({ targetSystemMethod: "manual", awaitingManualRotation: true }),
        jobs: [],
      });
      configs.actions.mockReturnValue(actions({ canRecordManual: true, canRotateNow: false }));
      await service.perform(PAM_TEST_USER_ID, PAM_TEST_ORGANIZATION_ID, CONFIG_ID, "record-manual");
      expect(configs.record_manual_rotation).toHaveBeenCalled();
    });
  });
});

describe("refusalReason", () => {
  it("explains each refusal", () => {
    const none = actions({
      canRotateNow: false,
      canPause: false,
      canResume: false,
      canRecordManual: false,
    });
    expect(refusalReason("rotate", view({ targetSystemMethod: "manual" }), none)).toContain(
      "record-manual",
    );
    expect(refusalReason("rotate", view({ hasActiveJob: true }), none)).toContain("active");
    expect(refusalReason("pause", view({ enabled: false }), none)).toContain("already paused");
    expect(refusalReason("resume", view(), none)).toContain("not paused");
    expect(refusalReason("record-manual", view(), none)).toContain("manual-method");
    expect(refusalReason("rotate", view(), actions())).toBeUndefined();
  });
});

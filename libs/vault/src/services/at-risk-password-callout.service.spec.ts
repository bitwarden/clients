import { TestBed } from "@angular/core/testing";
import { firstValueFrom, of } from "rxjs";

import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  SecurityTask,
  SecurityTaskStatus,
  SecurityTaskType,
  TaskService,
} from "@bitwarden/common/vault/tasks";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { FakeSingleUserState } from "../../../common/spec/fake-state";

import {
  AtRiskPasswordCalloutData,
  AtRiskPasswordCalloutService,
} from "./at-risk-password-callout.service";

const fakeUserState = () =>
  ({
    update: jest.fn().mockResolvedValue(undefined),
    state$: of(null),
  }) as unknown as FakeSingleUserState<AtRiskPasswordCalloutData>;

class MockCipherView {
  constructor(
    public id: string,
    private deleted: boolean,
  ) {}
  get isDeleted() {
    return this.deleted;
  }
}

describe("AtRiskPasswordCalloutService", () => {
  let service: AtRiskPasswordCalloutService;
  const mockTaskService = {
    pendingTasks$: jest.fn(),
    completedTasks$: jest.fn(),
  };
  const mockCipherService = { cipherViews$: jest.fn() };
  const mockStateProvider = { getUser: jest.fn().mockReturnValue(fakeUserState()) };
  const userId: UserId = "user1" as UserId;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AtRiskPasswordCalloutService,
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: CipherService,
          useValue: mockCipherService,
        },
        {
          provide: StateProvider,
          useValue: mockStateProvider,
        },
      ],
    });

    service = TestBed.inject(AtRiskPasswordCalloutService);
  });

  describe("completedTasks$", () => {
    it(" should return true if completed tasks exist", async () => {
      const tasks: SecurityTask[] = [
        {
          id: "t1",
          cipherId: "c1",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Completed,
        } as any,
        {
          id: "t2",
          cipherId: "c2",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Pending,
        } as any,
        {
          id: "t3",
          cipherId: "nope",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Completed,
        } as any,
        {
          id: "t4",
          cipherId: "c3",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Completed,
        } as any,
      ];

      jest.spyOn(mockTaskService, "completedTasks$").mockReturnValue(of(tasks));

      const result = await firstValueFrom(service.completedTasks$(userId));

      expect(result).toEqual(tasks[0]);
      expect(result?.id).toBe("t1");
    });
  });

  describe("showCompletedTasksBanner$", () => {
    beforeEach(() => {
      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of([]));
      jest.spyOn(mockTaskService, "completedTasks$").mockReturnValue(of([]));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of([]));
    });

    it("should return false if banner has been dismissed", async () => {
      const state: AtRiskPasswordCalloutData = {
        hasInteractedWithTasks: true,
        tasksBannerDismissed: true,
      };
      const mockState = { ...fakeUserState(), state$: of(state) };
      mockStateProvider.getUser.mockReturnValue(mockState);

      const result = await firstValueFrom(service.showCompletedTasksBanner$(userId));

      expect(result).toBe(false);
    });

    it("should return true when has completed tasks, no pending tasks, and banner not dismissed", async () => {
      const completedTasks = [
        {
          id: "t1",
          cipherId: "c1",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Completed,
        },
      ];
      const ciphers = [new MockCipherView("c1", false)];
      const state: AtRiskPasswordCalloutData = {
        hasInteractedWithTasks: true,
        tasksBannerDismissed: false,
      };

      jest.spyOn(mockTaskService, "completedTasks$").mockReturnValue(of(completedTasks));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of(ciphers));
      mockStateProvider.getUser.mockReturnValue({ state$: of(state) });

      const result = await firstValueFrom(service.showCompletedTasksBanner$(userId));

      expect(result).toBe(true);
    });

    it("returns false when no completed tasks", async () => {
      const state: AtRiskPasswordCalloutData = {
        hasInteractedWithTasks: true,
        tasksBannerDismissed: false,
      };
      mockStateProvider.getUser.mockReturnValue({ state$: of(state) });

      const result = await firstValueFrom(service.showCompletedTasksBanner$(userId));

      expect(result).toBe(false);
    });
  });
});

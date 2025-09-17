import { TestBed } from "@angular/core/testing";
import { firstValueFrom, of } from "rxjs";

import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { FakeSingleUserState } from "../../../common/spec/fake-state";

import {
  AT_RISK_PASSWORD_CALLOUT_KEY,
  AtRiskPasswordCalloutData,
  AtRiskPasswordCalloutService,
} from "./at-risk-password-callout.service";

const fakeUserState = () =>
  ({
    update: jest.fn().mockResolvedValue(undefined),
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
  const mockTaskService = { pendingTasks$: jest.fn() };
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

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("pendingTasks$", () => {
    it("filters tasks to only items with UpdateAtRiskCredential types and not deleted cipher", async () => {
      const tasks: SecurityTask[] = [
        { id: "t1", cipherId: "c1", type: SecurityTaskType.UpdateAtRiskCredential } as any,
        { id: "t2", cipherId: "c2", type: null } as any,
        { id: "t3", cipherId: "nope", type: SecurityTaskType.UpdateAtRiskCredential } as any,
        { id: "t4", cipherId: "c3", type: SecurityTaskType.UpdateAtRiskCredential } as any,
      ];
      const ciphers = [
        new MockCipherView("c1", false),
        new MockCipherView("c2", false),
        new MockCipherView("c3", true),
      ];

      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of(tasks));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of(ciphers));

      const result = await firstValueFrom(service.pendingTasks$(userId));

      expect(result.map((t) => t.id)).toEqual(["t1"]);
    });
  });

  describe("atRiskPasswordState", () => {
    it("calls stateProvider.getUser with proper values", () => {
      service.atRiskPasswordState(userId);
      expect(mockStateProvider.getUser).toHaveBeenCalledWith(userId, AT_RISK_PASSWORD_CALLOUT_KEY);
    });
  });

  describe("updateAtRiskPasswordState", () => {
    it("calls update on the returned SingleUserState", () => {
      const returnedState = fakeUserState();
      mockStateProvider.getUser.mockReturnValue(returnedState);

      const updateObj: AtRiskPasswordCalloutData = {
        hadPendingTasks: true,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      };

      service.updateAtRiskPasswordState(userId, updateObj);

      expect(returnedState.update).toHaveBeenCalledWith(expect.any(Function));
      const updater = (returnedState.update as jest.Mock).mock.calls[0][0];
      expect(updater({})).toEqual(updateObj);
    });
  });

  describe("shouldShowCompletionBanner$", () => {
    beforeEach(() => {
      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of([]));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of([]));
    });

    it("should return false when user has pending tasks", async () => {
      const tasks = [{ id: "t1", cipherId: "c1", type: SecurityTaskType.UpdateAtRiskCredential }];
      const ciphers = [new MockCipherView("c1", false)];
      const state: AtRiskPasswordCalloutData = {
        hadPendingTasks: true,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      };

      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of(tasks));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of(ciphers));
      mockStateProvider.getUser.mockReturnValue({ state$: of(state) });

      const result = await firstValueFrom(service.shouldShowCompletionBanner$(userId));

      expect(result).toBe(false);
    });

    it("should return true when no pending tasks and showTasksCompleteBanner is true", async () => {
      const state: AtRiskPasswordCalloutData = {
        hadPendingTasks: false,
        showTasksCompleteBanner: true,
        tasksBannerDismissed: false,
      };

      mockStateProvider.getUser.mockReturnValue({ state$: of(state) });

      const result = await firstValueFrom(service.shouldShowCompletionBanner$(userId));

      expect(result).toBe(true);
    });

    it("should return true when no pending tasks and hadPendingTasks is true", async () => {
      const state: AtRiskPasswordCalloutData = {
        hadPendingTasks: true,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      };

      mockStateProvider.getUser.mockReturnValue({ state$: of(state) });

      const result = await firstValueFrom(service.shouldShowCompletionBanner$(userId));

      expect(result).toBe(true);
    });

    it("should return false when banner has been dismissed", async () => {
      const state: AtRiskPasswordCalloutData = {
        hadPendingTasks: false,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: true,
      };

      mockStateProvider.getUser.mockReturnValue({ state$: of(state) });

      const result = await firstValueFrom(service.shouldShowCompletionBanner$(userId));

      expect(result).toBe(false);
    });

    it("should return false when state is null", async () => {
      mockStateProvider.getUser.mockReturnValue({ state$: of(null) });

      const result = await firstValueFrom(service.shouldShowCompletionBanner$(userId));

      expect(result).toBe(false);
    });
  });

  describe("updatePendingTasksState", () => {
    it("should set showTasksCompleteBanner to true when user had tasks and resolved all of them", () => {
      const currentState: AtRiskPasswordCalloutData = {
        hadPendingTasks: true,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      };
      const returnedState = {
        state$: of(currentState),
        update: jest.fn().mockResolvedValue(undefined),
      };
      mockStateProvider.getUser.mockReturnValue(returnedState);

      service.updatePendingTasksState(userId, 0);

      expect(returnedState.update).toHaveBeenCalledWith(expect.any(Function));
      const updater = (returnedState.update as jest.Mock).mock.calls[0][0];
      expect(updater(currentState)).toEqual({
        hadPendingTasks: false,
        showTasksCompleteBanner: true,
        tasksBannerDismissed: false,
      });
    });

    it("should set hadPendingTasks to true when user has tasks", () => {
      const currentState: AtRiskPasswordCalloutData = {
        hadPendingTasks: false,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      };
      const returnedState = {
        state$: of(currentState),
        update: jest.fn().mockResolvedValue(undefined),
      };
      mockStateProvider.getUser.mockReturnValue(returnedState);

      service.updatePendingTasksState(userId, 2);

      expect(returnedState.update).toHaveBeenCalledWith(expect.any(Function));
      const updater = (returnedState.update as jest.Mock).mock.calls[0][0];
      expect(updater()).toEqual({
        hadPendingTasks: true,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      });
    });

    it("should return currentState when no changes are needed", () => {
      const currentState: AtRiskPasswordCalloutData = {
        hadPendingTasks: false,
        showTasksCompleteBanner: false,
        tasksBannerDismissed: false,
      };
      const returnedState = {
        state$: of(currentState),
        update: jest.fn().mockResolvedValue(undefined),
      };
      mockStateProvider.getUser.mockReturnValue(returnedState);

      service.updatePendingTasksState(userId, 0);

      expect(returnedState.update).toHaveBeenCalledWith(expect.any(Function));
      const updater = (returnedState.update as jest.Mock).mock.calls[0][0];
      expect(updater(currentState)).toBe(currentState);
    });
  });
});

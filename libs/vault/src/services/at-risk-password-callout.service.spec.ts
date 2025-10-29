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
    public edit: boolean = true,
    public viewPassword: boolean = true,
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

  describe("pendingTasks$", () => {
    it.each([
      {
        description:
          "should return tasks filtered by UpdateAtRiskCredential type with valid cipher permissions",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
          {
            id: "t2",
            cipherId: "c2",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [
          new MockCipherView("c1", false, true, true),
          new MockCipherView("c2", false, true, true),
        ],
        expectedLength: 2,
        expectedFirstId: "t1",
      },
      {
        description: "should filter out tasks with wrong task type",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
          {
            id: "t2",
            cipherId: "c2",
            type: "SomeOtherType" as any,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [
          new MockCipherView("c1", false, true, true),
          new MockCipherView("c2", false, true, true),
        ],
        expectedLength: 1,
        expectedFirstId: "t1",
      },
      {
        description: "should filter out tasks with missing associated cipher",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
          {
            id: "t2",
            cipherId: "c-nonexistent",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [new MockCipherView("c1", false, true, true)],
        expectedLength: 1,
        expectedFirstId: "t1",
      },
      {
        description: "should filter out tasks when cipher edit permission is false",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
          {
            id: "t2",
            cipherId: "c2",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [
          new MockCipherView("c1", false, true, true),
          new MockCipherView("c2", false, false, true),
        ],
        expectedLength: 1,
        expectedFirstId: "t1",
      },
      {
        description: "should filter out tasks when cipher viewPassword permission is false",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
          {
            id: "t2",
            cipherId: "c2",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [
          new MockCipherView("c1", false, true, true),
          new MockCipherView("c2", false, true, false),
        ],
        expectedLength: 1,
        expectedFirstId: "t1",
      },
      {
        description: "should filter out tasks when cipher is deleted",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
          {
            id: "t2",
            cipherId: "c2",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [
          new MockCipherView("c1", false, true, true),
          new MockCipherView("c2", true, true, true),
        ],
        expectedLength: 1,
        expectedFirstId: "t1",
      },
    ])("$description", async ({ tasks, ciphers, expectedLength, expectedFirstId }) => {
      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of(tasks));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of(ciphers));

      const result = await firstValueFrom(service.pendingTasks$(userId));

      expect(result).toHaveLength(expectedLength);
      if (expectedFirstId) {
        expect(result[0].id).toBe(expectedFirstId);
      }
    });

    it("should correctly filter mixed valid and invalid tasks", async () => {
      const tasks: SecurityTask[] = [
        {
          id: "t1",
          cipherId: "c1",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Pending,
        } as any,
        {
          id: "t2",
          cipherId: "c2",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Pending,
        } as any,
        {
          id: "t3",
          cipherId: "c3",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Pending,
        } as any,
        {
          id: "t4",
          cipherId: "c4",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Pending,
        } as any,
        {
          id: "t5",
          cipherId: "c5",
          type: SecurityTaskType.UpdateAtRiskCredential,
          status: SecurityTaskStatus.Pending,
        } as any,
      ];
      const ciphers = [
        new MockCipherView("c1", false, true, true), // valid
        new MockCipherView("c2", false, false, true), // no edit
        new MockCipherView("c3", true, true, true), // deleted
        new MockCipherView("c4", false, true, false), // no viewPassword
        // c5 missing
      ];

      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of(tasks));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of(ciphers));

      const result = await firstValueFrom(service.pendingTasks$(userId));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("t1");
    });

    it.each([
      {
        description: "should return empty array when no tasks match filter criteria",
        tasks: [
          {
            id: "t1",
            cipherId: "c1",
            type: SecurityTaskType.UpdateAtRiskCredential,
            status: SecurityTaskStatus.Pending,
          } as any,
        ],
        ciphers: [new MockCipherView("c1", true, true, true)], // deleted
      },
      {
        description: "should return empty array when no pending tasks exist",
        tasks: [],
        ciphers: [new MockCipherView("c1", false, true, true)],
      },
    ])("$description", async ({ tasks, ciphers }) => {
      jest.spyOn(mockTaskService, "pendingTasks$").mockReturnValue(of(tasks));
      jest.spyOn(mockCipherService, "cipherViews$").mockReturnValue(of(ciphers));

      const result = await firstValueFrom(service.pendingTasks$(userId));

      expect(result).toHaveLength(0);
    });
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

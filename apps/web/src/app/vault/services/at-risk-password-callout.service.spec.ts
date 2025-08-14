import { TestBed } from "@angular/core/testing";
import { FakeSingleUserState } from "@bitwarden/common/../spec/fake-state";
import { firstValueFrom, of } from "rxjs";

import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";
import {
  AT_RISK_PASSWORD_CALLOUT_KEY,
  AtRiskPasswordCalloutData,
  AtRiskPasswordCalloutService,
} from "@bitwarden/web-vault/app/vault/services/at-risk-password-callout.service";

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
  const userId: UserId = "user-123" as UserId;
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
    it("filters tasks to only UpdateAtRiskCredential with a non-deleted cipher", async () => {
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
    it("calls stateProvider.getUser and returns its value", () => {
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
});

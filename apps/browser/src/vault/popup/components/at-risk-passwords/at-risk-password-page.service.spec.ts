import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTask, SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";

import { AtRiskPasswordPageService } from "./at-risk-password-page.service";

describe("AtRiskPasswordPageService", () => {
  let service: AtRiskPasswordPageService;
  let mockStateProvider: MockProxy<StateProvider>;
  let mockAccountService: FakeAccountService;
  let mockTaskService: MockProxy<TaskService>;
  let mockCipherService: MockProxy<CipherService>;

  const userId = "mock-user-id" as UserId;

  const task = {
    id: "task",
    organizationId: "org",
    cipherId: "cipher",
    type: SecurityTaskType.UpdateAtRiskCredential,
  } as SecurityTask;

  const ciphers = [
    {
      id: "cipher",
      organizationId: "org",
      name: "Item 1",
      edit: true,
      viewPassword: true,
    } as CipherView,
    {
      id: "cipher2",
      organizationId: "org",
      name: "Item 2",
    } as CipherView,
  ];

  const mockTasks$ = new BehaviorSubject<SecurityTask[]>([task]);
  const mockCiphers$ = new BehaviorSubject<CipherView[]>(ciphers);

  beforeEach(() => {
    mockStateProvider = mock<StateProvider>();
    mockAccountService = mockAccountServiceWith(userId);
    mockTaskService = mock<TaskService>({
      pendingTasks$: () => mockTasks$.asObservable(),
    });
    mockCipherService = mock<CipherService>({
      cipherViews$: () => mockCiphers$.asObservable(),
    });

    TestBed.configureTestingModule({
      providers: [
        AtRiskPasswordPageService,
        { provide: StateProvider, useValue: mockStateProvider },
        { provide: AccountService, useValue: mockAccountService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: CipherService, useValue: mockCipherService },
      ],
    });

    service = TestBed.inject(AtRiskPasswordPageService);
  });

  describe("activeUserData$", () => {
    it("passes through pending tasks", (done) => {
      service.activeUserData$.subscribe(({ tasks }) => {
        expect(tasks).toEqual([task]);
        done();
      });
    });

    it("maps ciphers to id objects", (done) => {
      service.activeUserData$.subscribe(({ ciphers: mappedCiphers }) => {
        expect(mappedCiphers).toEqual({
          cipher: ciphers[0],
          cipher2: ciphers[1],
        });
        done();
      });
    });

    it("passes through the user id", (done) => {
      service.activeUserData$.subscribe(({ userId: id }) => {
        expect(id).toEqual(userId);
        done();
      });
    });
  });

  describe("atRiskItems$", () => {
    it("filters tasks to only include available ciphers", (done) => {
      service.atRiskItems$.subscribe((items) => {
        expect(items).toEqual([ciphers[0]]);
        done();
      });
    });

    it("filters out ciphers that the user cannot edit the password", (done) => {
      const taskWithNoEditPermission = {
        ...task,
        cipherId: "cipher3",
      } as SecurityTask;

      const taskWithEditPermission = {
        ...task,
        cipherId: "cipher4",
      } as SecurityTask;

      const cipher3 = {
        id: "cipher3",
        organizationId: "org",
        name: "Item 3",
        edit: true,
        viewPassword: false,
      } as CipherView;

      const cipher4 = {
        id: "cipher4",
        organizationId: "org",
        name: "Item 4",
        edit: true,
        viewPassword: true,
      } as CipherView;

      mockTasks$.next([task, taskWithNoEditPermission, taskWithEditPermission]);
      mockCiphers$.next([...ciphers, cipher3, cipher4]);

      service.atRiskItems$.subscribe((items) => {
        expect(items).toEqual([ciphers[0], cipher4]);
        done();
      });
    });
  });
});

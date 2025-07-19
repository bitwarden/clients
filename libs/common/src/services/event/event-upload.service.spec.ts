import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { EventType } from "../../enums";
import { EventData } from "../../models/data/event.data";
import { LogService } from "../../platform/abstractions/log.service";
import { TaskSchedulerService } from "../../platform/scheduling";
import { UserId } from "../../types/guid";
import { ApiService } from "../api.service";

import { EventUploadService } from "./event-upload.service";
import { EVENT_COLLECTION } from "./key-definitions";

describe("event upload service", () => {
  let eventUploadService: EventUploadService;
  let apiService: MockProxy<ApiService>;
  let stateProvider: FakeStateProvider;
  let logService: MockProxy<LogService>;
  let authService: MockProxy<AuthService>;
  let taskSchedulerService: MockProxy<TaskSchedulerService>;
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;
  let accountService: FakeAccountService;

  beforeEach(() => {
    apiService = mock();
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    logService = mock();
    authService = mock();
    taskSchedulerService = mock();

    eventUploadService = new EventUploadService(
      apiService,
      stateProvider,
      logService,
      authService,
      taskSchedulerService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("uploadEvents", () => {
    describe("unlocked user", () => {
      beforeEach(() => {
        authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
      });

      it("attempts upload of all existing events", async () => {
        const events = makeEventData(3);
        await stateProvider.setUserState(EVENT_COLLECTION, events, userId);

        await eventUploadService.uploadEvents(userId);

        expect(apiService.postEventsCollect).toHaveBeenCalledWith(
          events.map((e) => eventUploadService.eventDataToEventRequest(e)),
          userId,
        );
      });

      it("re-stores events returned from api upload", async () => {
        const events = makeEventData(3);
        await stateProvider.setUserState(EVENT_COLLECTION, events, userId);

        const response = events.slice(1);
        apiService.postEventsCollect.mockResolvedValueOnce(response);

        await eventUploadService.uploadEvents(userId);

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          EVENT_COLLECTION,
          response,
          userId,
        );
      });

      it("re-stores all events if api upload throws", async () => {
        const events = makeEventData(3);
        await stateProvider.setUserState(EVENT_COLLECTION, events, userId);

        apiService.postEventsCollect.mockRejectedValueOnce(new Error("API error"));

        await eventUploadService.uploadEvents(userId);

        expect(stateProvider.mock.setUserState).toHaveBeenCalledWith(
          EVENT_COLLECTION,
          events,
          userId,
        );
      });

      it("does not store events if api upload is successful and no events are returned", async () => {
        const events = makeEventData(3);
        await stateProvider.setUserState(EVENT_COLLECTION, events, userId);
        // remove the above call to the mock
        stateProvider.mock.setUserState.mockClear();

        apiService.postEventsCollect.mockResolvedValueOnce([]);

        await eventUploadService.uploadEvents(userId);

        expect(stateProvider.mock.setUserState).not.toHaveBeenCalled();
      });
    });
  });
});

function makeEventData(count: number): EventData[] {
  const events: EventData[] = [];
  for (let i = 0; i < count; i++) {
    events.push(
      EventData.fromJSON({
        type: EventType.Cipher_ClientViewed,
        date: new Date().toISOString(),
        cipherId: "00000000-0000-0000-0000-000000000001",
        organizationId: null!,
      }),
    );
  }
  return events;
}

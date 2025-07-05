// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { EventUploadService as EventUploadServiceAbstraction } from "../../abstractions/event/event-upload.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { EventData } from "../../models/data/event.data";
import { EventRequest } from "../../models/request/event.request";
import { LogService } from "../../platform/abstractions/log.service";
import { ScheduledTaskNames } from "../../platform/scheduling/scheduled-task-name.enum";
import { TaskSchedulerService } from "../../platform/scheduling/task-scheduler.service";
import { StateProvider } from "../../platform/state";
import { UserId } from "../../types/guid";

import { EVENT_COLLECTION } from "./key-definitions";

export class EventUploadService implements EventUploadServiceAbstraction {
  private inited = false;
  constructor(
    private apiService: ApiService,
    private stateProvider: StateProvider,
    private logService: LogService,
    private authService: AuthService,
    private taskSchedulerService: TaskSchedulerService,
  ) {
    this.taskSchedulerService.registerTaskHandler(ScheduledTaskNames.eventUploadsInterval, () =>
      this.uploadEvents(),
    );
  }

  init(checkOnInterval: boolean) {
    if (this.inited) {
      return;
    }

    this.inited = true;
    if (checkOnInterval) {
      void this.uploadEvents();
      this.taskSchedulerService.setInterval(
        ScheduledTaskNames.eventUploadsInterval,
        60 * 1000, // check every 60 seconds
      );
    }
  }

  /** Upload the event collection from state.
   *  @param userId upload events for provided user. If not active user will be used.
   */
  async uploadEvents(userId?: UserId): Promise<void> {
    if (!userId) {
      userId = await firstValueFrom(this.stateProvider.activeUserId$);
    }

    if (!userId) {
      return;
    }

    const isUnlocked = await firstValueFrom(
      this.authService
        .authStatusFor$(userId)
        .pipe(map((status) => status === AuthenticationStatus.Unlocked)),
    );
    if (!isUnlocked) {
      return;
    }

    const eventCollection = await this.takeEvents(userId);

    if (eventCollection == null || eventCollection.length === 0) {
      return;
    }
    const eventRequests = eventCollection.map((e) => {
      return this.eventDataToEventRequest(e);
    });

    let failedEvents: EventRequest[];
    try {
      failedEvents = await this.apiService.postEventsCollect(eventRequests, userId);
    } catch (e) {
      this.logService.error(e);
      failedEvents = eventRequests;
    }

    // Add any events that failed to upload back to state.
    if (failedEvents && failedEvents.length > 0) {
      const failedEventData = failedEvents.map((e) => {
        const eventData = new EventData();
        eventData.type = e.type;
        eventData.cipherId = e.cipherId;
        eventData.date = e.date;
        eventData.organizationId = e.organizationId;
        return eventData;
      });
      await this.stateProvider.setUserState(EVENT_COLLECTION, failedEventData, userId);
    }
  }

  eventDataToEventRequest(event: EventData): EventRequest {
    const req = new EventRequest();
    req.type = event.type;
    req.cipherId = event.cipherId;
    req.date = event.date;
    req.organizationId = event.organizationId;
    return req;
  }

  /** Return user's events and then clear them from state
   *  @param userId the user to grab and clear events for
   */
  private async takeEvents(userId: UserId): Promise<EventData[]> {
    let taken = null;
    await this.stateProvider.getUser(userId, EVENT_COLLECTION).update((current) => {
      taken = current ?? [];
      return [];
    });

    return taken;
  }
}

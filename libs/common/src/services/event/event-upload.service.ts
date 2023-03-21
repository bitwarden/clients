import { ApiService } from "../../abstractions/api.service";
import { EventUploadService as EventUploadServiceAbstraction } from "../../abstractions/event/event-upload.service";
import { LogService } from "../../abstractions/log.service";
import { StateService } from "../../abstractions/state.service";
import { EventRequest } from "../../models/request/event.request";
import { Guid } from "../../types/guid";

export class EventUploadService implements EventUploadServiceAbstraction {
  private inited = false;
  constructor(
    private apiService: ApiService,
    private stateService: StateService,
    private logService: LogService
  ) {}

  init(checkOnInterval: boolean) {
    if (this.inited) {
      return;
    }

    this.inited = true;
    if (checkOnInterval) {
      this.uploadEvents();
      setInterval(() => this.uploadEvents(), 60 * 1000); // check every 60 seconds
    }
  }

  async uploadEvents(userId?: Guid): Promise<void> {
    const authed = await this.stateService.getIsAuthenticated({ userId: userId });
    if (!authed) {
      return;
    }
    const eventCollection = await this.stateService.getEventCollection({ userId: userId });
    if (eventCollection == null || eventCollection.length === 0) {
      return;
    }
    const request = eventCollection.map((e) => {
      const req = new EventRequest();
      req.type = e.type;
      req.cipherId = e.cipherId;
      req.date = e.date;
      req.organizationId = e.organizationId;
      return req;
    });
    try {
      await this.apiService.postEventsCollect(request);
      this.clearEvents(userId);
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async clearEvents(userId?: Guid): Promise<any> {
    await this.stateService.setEventCollection(null, { userId: userId });
  }
}

import { EventCollectionService as EventCollectionServiceAbstraction } from "../../abstractions/event/event-collection.service";
import { EventUploadService } from "../../abstractions/event/event-upload.service";
import { OrganizationService } from "../../abstractions/organization/organization.service.abstraction";
import { StateService } from "../../abstractions/state.service";
import { EventType } from "../../enums/eventType";
import { EventData } from "../../models/data/event.data";
import { Guid } from "../../types/guid";
import { CipherService } from "../../vault/abstractions/cipher.service";

export class EventCollectionService implements EventCollectionServiceAbstraction {
  constructor(
    private cipherService: CipherService,
    private stateService: StateService,
    private organizationService: OrganizationService,
    private eventUploadService: EventUploadService
  ) {}

  async collect(
    eventType: EventType,
    cipherId: Guid = null,
    uploadImmediately = false,
    organizationId: Guid = null
  ): Promise<any> {
    const authed = await this.stateService.getIsAuthenticated();
    if (!authed) {
      return;
    }
    const organizations = await this.organizationService.getAll();
    if (organizations == null) {
      return;
    }
    const orgIds = new Set<Guid>(organizations.filter((o) => o.useEvents).map((o) => o.id));
    if (orgIds.size === 0) {
      return;
    }
    if (cipherId != null) {
      const cipher = await this.cipherService.get(cipherId);
      if (cipher == null || cipher.organizationId == null || !orgIds.has(cipher.organizationId)) {
        return;
      }
    }
    if (organizationId != null) {
      if (!orgIds.has(organizationId)) {
        return;
      }
    }
    let eventCollection = await this.stateService.getEventCollection();
    if (eventCollection == null) {
      eventCollection = [];
    }
    const event = new EventData();
    event.type = eventType;
    event.cipherId = cipherId;
    event.date = new Date().toISOString();
    event.organizationId = organizationId;
    eventCollection.push(event);
    await this.stateService.setEventCollection(eventCollection);
    if (uploadImmediately) {
      await this.eventUploadService.uploadEvents();
    }
  }
}

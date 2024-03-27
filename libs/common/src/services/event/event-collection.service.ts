import { firstValueFrom, map, from, zip } from "rxjs";

import { EventCollectionService as EventCollectionServiceAbstraction } from "../../abstractions/event/event-collection.service";
import { EventUploadService } from "../../abstractions/event/event-upload.service";
import { OrganizationService } from "../../admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "../../auth/abstractions/account.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { EventType } from "../../enums";
import { EventData } from "../../models/data/event.data";
import { StateProvider } from "../../platform/state";
import { CipherService } from "../../vault/abstractions/cipher.service";

import { EVENT_COLLECTION } from "./key-definitions";

export class EventCollectionService implements EventCollectionServiceAbstraction {
  constructor(
    private cipherService: CipherService,
    private stateProvider: StateProvider,
    private organizationService: OrganizationService,
    private eventUploadService: EventUploadService,
    private accountService: AccountService,
  ) {}

  /** Adds an event to the active user's event collection
   *  @param eventType the event type to be added
   *  @param cipherId if provided the id of the cipher involved in the event
   *  @param uploadImmediately in some cases the recorded events should be uploaded right after being added
   *  @param organizationId the organizationId involved in the event. If the cipherId is not provided an organizationId is required
   */
  async collect(
    eventType: EventType,
    cipherId: string = null,
    uploadImmediately = false,
    organizationId: string = null,
  ): Promise<any> {
    const userId = await firstValueFrom(this.stateProvider.activeUserId$);
    const eventStore = this.stateProvider.getUser(userId, EVENT_COLLECTION);

    if (!(await this.shouldUpdate(cipherId, organizationId))) {
      return;
    }

    const event = new EventData();
    event.type = eventType;
    event.cipherId = cipherId;
    event.date = new Date().toISOString();
    event.organizationId = organizationId;

    await eventStore.update((events) => {
      events = events ?? [];
      events.push(event);
      return events;
    });

    if (uploadImmediately) {
      await this.eventUploadService.uploadEvents();
    }
  }

  /** Verifies if the event collection should be updated for the provided information
   *  @param cipherId the cipher for the event
   *  @param organizationId the organization for the event
   */
  private async shouldUpdate(
    cipherId: string = null,
    organizationId: string = null,
  ): Promise<boolean> {
    const orgIds$ = this.organizationService.organizations$.pipe(
      map((orgs) => orgs?.filter((o) => o.useEvents)?.map((x) => x.id) ?? []),
    );

    const cipher$ = from(this.cipherService.get(cipherId));

    const [accountInfo, orgIds, cipher] = await firstValueFrom(
      zip(this.accountService.activeAccount$, orgIds$, cipher$),
    );

    // The user must be authorized
    if (accountInfo.status != AuthenticationStatus.Unlocked) {
      return false;
    }

    // User must have organizations assigned to them
    if (orgIds == null || orgIds.length == 0) {
      return false;
    }

    // If the cipher is null there must be an organization id provided
    if (cipher == null && organizationId == null) {
      return false;
    }

    // If the cipher is present it must be in the user's org list
    if (cipher != null && !orgIds.includes(cipher?.organizationId)) {
      return false;
    }

    // If the organization id is provided it must be in the user's org list
    if (organizationId != null && !orgIds.includes(organizationId)) {
      return false;
    }

    return true;
  }
}

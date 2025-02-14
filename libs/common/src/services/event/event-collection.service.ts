// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, map, from, zip } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { EventCollectionService as EventCollectionServiceAbstraction } from "../../abstractions/event/event-collection.service";
import { EventUploadService } from "../../abstractions/event/event-upload.service";
import { AuthService } from "../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../auth/enums/authentication-status";
import { EventType } from "../../enums";
import { EventData } from "../../models/data/event.data";
import { StateProvider } from "../../platform/state";
import { CipherService } from "../../vault/abstractions/cipher.service";
import { CipherView } from "../../vault/models/view/cipher.view";

import { EVENT_COLLECTION } from "./key-definitions";

export class EventCollectionService implements EventCollectionServiceAbstraction {
  constructor(
    private cipherService: CipherService,
    private stateProvider: StateProvider,
    private organizationService: OrganizationService,
    private eventUploadService: EventUploadService,
    private authService: AuthService,
    private accountService: AccountService,
  ) {}

  private getOrgIds = (orgs: Organization[]): string[] => {
    return orgs?.filter((o) => o.useEvents)?.map((x) => x.id) ?? [];
  };

  /** Adds an event to the active user's event collection
   *  @param eventType the event type to be added
   *  @param ciphers The collection of ciphers to log events for
   *  @param uploadImmediately in some cases the recorded events should be uploaded right after being added
   */
  async collectMany(
    eventType: EventType,
    ciphers: CipherView[],
    uploadImmediately = false,
  ): Promise<any> {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const eventStore = this.stateProvider.getUser(userId, EVENT_COLLECTION);

    if (!(await this.shouldUpdate(userId, null, eventType, ciphers))) {
      return;
    }

    const events$ = this.organizationService.organizations$(userId).pipe(
      map((orgs) => this.getOrgIds(orgs)),
      map((orgs) =>
        ciphers
          .filter((c) => orgs.includes(c.organizationId))
          .map((c) => ({
            type: eventType,
            cipherId: c.id,
            date: new Date().toISOString(),
            organizationId: c.organizationId,
          })),
      ),
    );

    await eventStore.update(
      (currentEvents, newEvents) => [...(currentEvents ?? []), ...newEvents],
      {
        combineLatestWith: events$,
      },
    );

    if (uploadImmediately) {
      await this.eventUploadService.uploadEvents();
    }
  }

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
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const eventStore = this.stateProvider.getUser(userId, EVENT_COLLECTION);

    if (!(await this.shouldUpdate(userId, organizationId, eventType, undefined, cipherId))) {
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
   *  @param userId the active user's id
   *  @param cipherId the cipher for the event
   *  @param organizationId the organization for the event
   */
  private async shouldUpdate(
    userId: UserId,
    organizationId: string = null,
    eventType: EventType = null,
    ciphers: CipherView[] = [],
    cipherId?: string,
  ): Promise<boolean> {
    const cipher$ = from(this.cipherService.get(cipherId, userId));

    const orgIds$ = this.organizationService
      .organizations$(userId)
      .pipe(map((orgs) => this.getOrgIds(orgs)));

    const [authStatus, orgIds, cipher] = await firstValueFrom(
      zip(this.authService.activeAccountStatus$, orgIds$, cipher$),
    );

    // The user must be authorized
    if (authStatus != AuthenticationStatus.Unlocked) {
      return false;
    }

    // User must have organizations assigned to them
    if (orgIds == null || orgIds.length == 0) {
      return false;
    }

    // Individual vault export doesn't need cipher id or organization id.
    if (eventType == EventType.User_ClientExportedVault) {
      return true;
    }

    // If the cipherId was provided and a cipher exists, add it to the collection
    if (cipher != null) {
      ciphers.push(new CipherView(cipher));
    }

    // If no ciphers there must be an organization id provided
    if ((ciphers == null || ciphers.length == 0) && organizationId == null) {
      return false;
    }

    // If the input list of ciphers is provided. Check the ciphers to see if any
    // are in the user's org list
    if (ciphers != null && ciphers.length > 0) {
      const filtered = ciphers.filter((c) => orgIds.includes(c.organizationId));
      return filtered.length > 0;
    }

    // If the organization id is provided it must be in the user's org list
    if (organizationId != null && !orgIds.includes(organizationId)) {
      return false;
    }

    return true;
  }
}

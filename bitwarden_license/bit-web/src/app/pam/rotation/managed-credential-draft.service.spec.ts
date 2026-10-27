import { TestBed } from "@angular/core/testing";
import { NavigationEnd, Router } from "@angular/router";
import { Subject } from "rxjs";

import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  ManagedCredentialDraft,
  ManagedCredentialDraftService,
} from "./managed-credential-draft.service";

const ORG = "org-1" as OrganizationId;

const DRAFT: ManagedCredentialDraft = {
  organizationId: ORG,
  cipherId: "cipher-1",
  targetSystemId: "",
  accountIdentity: "svc",
  scheduleCron: null,
  rotateOnAccessEnd: false,
  terminateSessions: false,
};

describe("ManagedCredentialDraftService", () => {
  let events: Subject<NavigationEnd>;
  let service: ManagedCredentialDraftService;

  beforeEach(() => {
    events = new Subject<NavigationEnd>();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });
    service = TestBed.inject(ManagedCredentialDraftService);
  });

  const navigatedTo = (url: string) => events.next(new NavigationEnd(1, url, url));

  it("hands the draft back once", () => {
    service.save(DRAFT);

    expect(service.take(ORG)).toEqual(DRAFT);
    expect(service.take(ORG)).toBeNull();
  });

  it("does not hand a draft to another organization", () => {
    service.save(DRAFT);

    expect(service.take("org-2" as OrganizationId)).toBeNull();
  });

  it("keeps the draft while the admin moves between the two create pages", () => {
    service.save(DRAFT);

    navigatedTo("/organizations/org-1/pam/rotation/target-systems/new?then=managed-credential");
    navigatedTo("/organizations/org-1/pam/rotation/managed-credentials/new?targetSystemId=a");

    expect(service.take(ORG)).toEqual(DRAFT);
  });

  it("drops the draft once the admin leaves for any other page", () => {
    service.save(DRAFT);

    navigatedTo("/organizations/org-1/pam/rotation/managed-credentials");

    expect(service.take(ORG)).toBeNull();
  });
});

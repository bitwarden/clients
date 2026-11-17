import { TestBed } from "@angular/core/testing";
import { DefaultUrlSerializer, NavigationEnd, NavigationStart, Router } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { ShareItemDrawerComponent } from "./share-item-drawer.component";

describe("ShareItemDrawerComponent", () => {
  let routerEvents: Subject<unknown>;
  let dialogRef: MockProxy<DialogRef>;

  const navigateTo = (url: string) => routerEvents.next(new NavigationEnd(1, url, url));

  beforeEach(async () => {
    routerEvents = new Subject();
    dialogRef = mock<DialogRef>();

    const serializer = new DefaultUrlSerializer();
    const router = {
      events: routerEvents.asObservable(),
      parseUrl: (url: string) => serializer.parse(url),
    };

    await TestBed.configureTestingModule({
      imports: [ShareItemDrawerComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_DATA, useValue: { cipher: new CipherView() } },
      ],
    })
      // Only the component's navigation handling is under test; the form is not needed.
      .overrideComponent(ShareItemDrawerComponent, { set: { template: "", imports: [] } })
      .compileComponents();

    TestBed.createComponent(ShareItemDrawerComponent);
  });

  it("closes when another item is selected by `itemId`", () => {
    navigateTo("/vault?itemId=other-item&action=view");

    expect(dialogRef.close).toHaveBeenCalled();
  });

  it("closes when another item is selected by `cipherId`", () => {
    navigateTo("/vault?cipherId=other-item");

    expect(dialogRef.close).toHaveBeenCalled();
  });

  it("stays open when the URL changes without selecting an item", () => {
    // e.g. the item dialog it was opened from closing, which clears the item params
    navigateTo("/vault?folderId=folder");

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it("ignores navigations that have not completed", () => {
    routerEvents.next(new NavigationStart(1, "/vault?itemId=other-item"));

    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});

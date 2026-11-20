import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import {
  NewItemTypesAnnouncementService,
  NewItemTypesCoachmarkCopy,
} from "../../services/new-item-types-announcement.service";

import { NewItemTypesCoachmarkComponent } from "./new-item-types-coachmark.component";

describe("NewItemTypesCoachmarkComponent", () => {
  let fixture: ComponentFixture<NewItemTypesCoachmarkComponent>;
  let component: NewItemTypesCoachmarkComponent;
  let coachmarkCopy$: BehaviorSubject<NewItemTypesCoachmarkCopy | null>;
  const dismissCoachmark = jest.fn();
  const copy: NewItemTypesCoachmarkCopy = {
    titleKey: "newItemTypesAvailable",
    descriptionKey: "addBankAccountsLicensesAndPassports",
  };

  beforeEach(async () => {
    coachmarkCopy$ = new BehaviorSubject<NewItemTypesCoachmarkCopy | null>(null);
    dismissCoachmark.mockClear();

    await TestBed.configureTestingModule({
      imports: [NewItemTypesCoachmarkComponent],
      providers: [
        {
          provide: NewItemTypesAnnouncementService,
          useValue: { coachmarkCopy$, dismissCoachmark },
        },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewItemTypesCoachmarkComponent);
    component = fixture.componentInstance;
  });

  it("stays closed while there is nothing to announce", () => {
    fixture.detectChanges();

    expect(component.open()).toBe(false);
    expect(dismissCoachmark).not.toHaveBeenCalled();
  });

  it("opens and marks the coachmark seen when it should show", () => {
    coachmarkCopy$.next(copy);
    fixture.detectChanges();

    expect(component.open()).toBe(true);
    expect(dismissCoachmark).toHaveBeenCalledTimes(1);
  });

  it("stays open after being marked seen", () => {
    coachmarkCopy$.next(copy);
    fixture.detectChanges();

    coachmarkCopy$.next(null);
    fixture.detectChanges();

    expect(component.open()).toBe(true);
    expect(dismissCoachmark).toHaveBeenCalledTimes(1);
  });

  it("closes for good when the popover closes", () => {
    coachmarkCopy$.next(copy);
    fixture.detectChanges();

    component.openChange(false);

    expect(component.open()).toBe(false);
  });

  it("does not open or mark seen while disabled", () => {
    fixture.componentRef.setInput("enabled", false);
    coachmarkCopy$.next(copy);
    fixture.detectChanges();

    expect(component.open()).toBe(false);
    expect(dismissCoachmark).not.toHaveBeenCalled();
  });
});

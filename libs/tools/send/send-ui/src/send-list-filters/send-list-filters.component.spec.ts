import { CommonModule } from "@angular/common";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";
import { ChipFilterComponent } from "@bitwarden/components";

import { SendListFiltersService } from "../services/send-list-filters.service";
import { SendPolicyService } from "../services/send-policy.service";

import { SendListFiltersComponent } from "./send-list-filters.component";

describe("SendListFiltersComponent", () => {
  let component: SendListFiltersComponent;
  let fixture: ComponentFixture<SendListFiltersComponent>;
  let sendListFiltersService: SendListFiltersService;
  let sendPolicyService: Partial<SendPolicyService>;
  const allowedSendTypes = new BehaviorSubject<SendType[]>([SendType.Text, SendType.File]);

  beforeEach(async () => {
    sendListFiltersService = new SendListFiltersService(mock(), new FormBuilder());
    sendListFiltersService.resetFilterForm = jest.fn();

    sendPolicyService = {
      allowedSendTypes$: allowedSendTypes,
    };

    await TestBed.configureTestingModule({
      imports: [CommonModule, ChipFilterComponent, ReactiveFormsModule, SendListFiltersComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: SendListFiltersService, useValue: sendListFiltersService },
        { provide: SendPolicyService, useValue: sendPolicyService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SendListFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should call resetFilterForm on ngOnDestroy", () => {
    component.ngOnDestroy();
    expect(sendListFiltersService.resetFilterForm).toHaveBeenCalled();
  });

  it("should hide Send filters when the Send type is restricted by policy", () => {
    expect(fixture.debugElement.children.length).toEqual(1);
    allowedSendTypes.next([SendType.Text]);
    fixture.detectChanges();
    expect(fixture.debugElement.children.length).toEqual(0);
  });
});

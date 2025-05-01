import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { SendListFiltersService } from "./send-list-filters.service";

describe("SendListFiltersService", () => {
  let service: SendListFiltersService;
  const policyAppliesToActiveUser$ = new BehaviorSubject<boolean>(false);

  const i18nService = {
    t: (key: string) => key,
  } as I18nService;

  const policyService = {
    policyAppliesToActiveUser$: jest.fn(() => policyAppliesToActiveUser$),
  };

  beforeEach(() => {
    policyAppliesToActiveUser$.next(false);
    policyService.policyAppliesToActiveUser$.mockClear();

    TestBed.configureTestingModule({
      providers: [
        {
          provide: I18nService,
          useValue: i18nService,
        },
        {
          provide: PolicyService,
          useValue: policyService,
        },
        { provide: FormBuilder, useClass: FormBuilder },
      ],
    });

    service = TestBed.inject(SendListFiltersService);
  });

  it("returns all send types", () => {
    expect(service.sendTypes.map((c) => c.value)).toEqual([SendType.File, SendType.Text]);
  });

  it("resets the filter form", () => {
    service.filterForm.patchValue({ sendType: SendType.Text });
    service.resetFilterForm();
    expect(service.filterForm.value).toEqual({ sendType: null });
  });

  it("filters by sendType", (done) => {
    const sends = [
      { type: SendType.File },
      { type: SendType.Text },
      { type: SendType.File },
    ] as SendView[];
    service.filterFunction$.subscribe((filterFunction) => {
      expect(filterFunction(sends)).toEqual([sends[1]]);
      done();
    });

    service.filterForm.patchValue({ sendType: SendType.Text });
  });
});

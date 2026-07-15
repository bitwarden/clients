import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";

import { ProblemDetailsErrorResponse } from "@bitwarden/common/models/response/problem-details-error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ProblemDetailsService } from "./problem-details.service";

function makeEmailError(type: string) {
  return new ProblemDetailsErrorResponse(
    { errors: { email: [{ type, detail: "server detail" }] } },
    400,
  );
}

const EMAIL_FIELD_MAP = {
  email: {
    new_email_domain_not_claimed: "emailErrorNotClaimedDomain",
    email_already_in_use: "emailErrorAlreadyInUse",
  },
};

describe("ProblemDetailsService", () => {
  let service: ProblemDetailsService;
  let i18nService: jest.Mocked<I18nService>;
  let fb: FormBuilder;

  beforeEach(() => {
    i18nService = { t: jest.fn((key: string) => key) } as any;

    TestBed.configureTestingModule({
      providers: [ProblemDetailsService, { provide: I18nService, useValue: i18nService }],
    });

    service = TestBed.inject(ProblemDetailsService);
    fb = new FormBuilder();
  });

  it("sets serverError on email control for known error type", () => {
    const formGroup = fb.group({ email: [""] });
    const error = makeEmailError("new_email_domain_not_claimed");

    service.applyErrors(error, formGroup, EMAIL_FIELD_MAP);

    expect(formGroup.controls.email.errors?.serverError?.message).toBeDefined();
  });

  it("does not set errors for unknown problem-detail type", () => {
    const formGroup = fb.group({ email: [""] });
    const error = makeEmailError("unknown_error_type");

    service.applyErrors(error, formGroup, EMAIL_FIELD_MAP);

    expect(formGroup.controls.email.errors).toBeNull();
  });

  it("does not set errors when response has no matching fields", () => {
    const formGroup = fb.group({ email: [""] });
    const err = new ProblemDetailsErrorResponse({ errors: {} }, 400);

    service.applyErrors(err, formGroup, EMAIL_FIELD_MAP);

    expect(formGroup.controls.email.errors).toBeNull();
  });

  it("does not set errors when field in rawErrors has no matching form control", () => {
    const formGroup = fb.group({ email: [""] });
    const err = new ProblemDetailsErrorResponse(
      { errors: { unknownField: [{ type: "new_email_domain_not_claimed", detail: "" }] } },
      400,
    );

    service.applyErrors(err, formGroup, EMAIL_FIELD_MAP);

    expect(formGroup.controls.email.errors).toBeNull();
  });
});

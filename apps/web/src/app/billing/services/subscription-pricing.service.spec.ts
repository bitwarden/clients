import { TestBed } from "@angular/core/testing";

import { SubscriptionPricingService } from "./subscription-pricing.service";

describe("SubscriptionPricingService", () => {
  let service: SubscriptionPricingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SubscriptionPricingService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});

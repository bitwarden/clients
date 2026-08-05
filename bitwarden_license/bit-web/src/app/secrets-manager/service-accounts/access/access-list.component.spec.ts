import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { AccessTokenView } from "../models/view/access-token.view";

import { AccessListComponent } from "./access-list.component";

class TestAccessListComponent extends AccessListComponent {
  testGetTokenStatus(token: AccessTokenView) {
    return this.getTokenStatus(token);
  }
  get testSortByStatus() {
    return this.sortByStatus;
  }
  get testSortByExpireAt() {
    return this.sortByExpireAt;
  }
}

function makeToken(expireAt: Date | null | undefined): AccessTokenView {
  const token = new AccessTokenView();
  token.expireAt = expireAt ?? undefined;
  return token;
}

describe("AccessListComponent", () => {
  let component: TestAccessListComponent;

  const NOW = new Date("2025-06-01T12:00:00Z");
  const DAYS = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);

    await TestBed.configureTestingModule({
      declarations: [TestAccessListComponent],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideTemplate(TestAccessListComponent, "")
      .compileComponents();

    component = TestBed.createComponent(TestAccessListComponent).componentInstance;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("getTokenStatus", () => {
    it("returns active when expireAt is null", () => {
      expect(component.testGetTokenStatus(makeToken(null))).toBe("active");
    });

    it("returns active when expireAt is undefined", () => {
      expect(component.testGetTokenStatus(makeToken(undefined))).toBe("active");
    });

    it("returns expired when expireAt is in the past", () => {
      expect(component.testGetTokenStatus(makeToken(DAYS(-1)))).toBe("expired");
    });

    it("returns expired when expireAt is well in the past", () => {
      expect(component.testGetTokenStatus(makeToken(DAYS(-30)))).toBe("expired");
    });

    it("returns expiringSoon when expireAt is within the 7-day threshold", () => {
      expect(component.testGetTokenStatus(makeToken(DAYS(3)))).toBe("expiringSoon");
    });

    it("returns expiringSoon when expireAt is exactly 1 ms before the threshold boundary", () => {
      const justBeforeBoundary = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      expect(component.testGetTokenStatus(makeToken(justBeforeBoundary))).toBe("expiringSoon");
    });

    it("returns active when expireAt is beyond the 7-day threshold", () => {
      expect(component.testGetTokenStatus(makeToken(DAYS(8)))).toBe("active");
    });

    it("returns active when expireAt is well in the future", () => {
      expect(component.testGetTokenStatus(makeToken(DAYS(365)))).toBe("active");
    });
  });

  describe("sortByExpireAt", () => {
    it("returns 0 when both tokens never expire", () => {
      expect(component.testSortByExpireAt(makeToken(null), makeToken(null))).toBe(0);
    });

    it("places never-expiring token after dated token ascending (returns > 0)", () => {
      expect(component.testSortByExpireAt(makeToken(null), makeToken(DAYS(10)))).toBeGreaterThan(0);
    });

    it("places dated token before never-expiring token ascending (returns < 0)", () => {
      expect(component.testSortByExpireAt(makeToken(DAYS(10)), makeToken(null))).toBeLessThan(0);
    });

    it("null placement is direction-neutral so sortData can flip it correctly for desc", () => {
      // sortData multiplies by -1 for desc; fn must return >0 for null-a so -1 * >0 puts a first
      expect(component.testSortByExpireAt(makeToken(null), makeToken(DAYS(10)))).toBeGreaterThan(0);
    });

    it("orders two dated tokens earlier-first ascending", () => {
      expect(component.testSortByExpireAt(makeToken(DAYS(1)), makeToken(DAYS(5)))).toBeLessThan(0);
    });

    it("returns positive for (later, earlier) so sortData flips it correctly for desc", () => {
      expect(component.testSortByExpireAt(makeToken(DAYS(5)), makeToken(DAYS(1)))).toBeGreaterThan(
        0,
      );
    });

    it("returns 0 for two identical dates", () => {
      const date = DAYS(3);
      expect(
        component.testSortByExpireAt(makeToken(date), makeToken(new Date(date.getTime()))),
      ).toBe(0);
    });
  });

  describe("sortByStatus", () => {
    it("orders active before expiringSoon", () => {
      expect(component.testSortByStatus(makeToken(null), makeToken(DAYS(3)))).toBeLessThan(0);
    });

    it("orders active before expired", () => {
      expect(component.testSortByStatus(makeToken(null), makeToken(DAYS(-1)))).toBeLessThan(0);
    });

    it("orders expiringSoon before expired", () => {
      expect(component.testSortByStatus(makeToken(DAYS(3)), makeToken(DAYS(-1)))).toBeLessThan(0);
    });

    it("returns 0 for two tokens with the same status", () => {
      expect(component.testSortByStatus(makeToken(DAYS(3)), makeToken(DAYS(5)))).toBe(0);
    });

    it("returns positive when expired is compared against active", () => {
      expect(component.testSortByStatus(makeToken(DAYS(-1)), makeToken(null))).toBeGreaterThan(0);
    });
  });
});

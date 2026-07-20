import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { Vfo1TerminologyService } from "./vfo1-terminology.service";

describe("Vfo1TerminologyService", () => {
  let configService: MockProxy<ConfigService>;
  let flagSubject: BehaviorSubject<boolean>;

  beforeEach(() => {
    flagSubject = new BehaviorSubject<boolean>(false);
    configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockReturnValue(flagSubject as any);

    TestBed.configureTestingModule({
      providers: [{ provide: ConfigService, useValue: configService }],
    });
  });

  it("defaults to false", () => {
    const service = TestBed.inject(Vfo1TerminologyService);
    expect(service.enabled()).toBe(false);
  });

  it("reflects true when the flag resolves", () => {
    flagSubject.next(true);

    const service = TestBed.inject(Vfo1TerminologyService);

    expect(service.enabled()).toBe(true);
  });

  it("updates as the flag changes", () => {
    const service = TestBed.inject(Vfo1TerminologyService);

    flagSubject.next(true);

    expect(service.enabled()).toBe(true);

    flagSubject.next(false);

    expect(service.enabled()).toBe(false);
  });

  it("subscribes to the VFO1Foundation flag", () => {
    TestBed.inject(Vfo1TerminologyService);

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
  });

  describe("iconClass", () => {
    it("returns the icon class unchanged when the flag is off", () => {
      const service = TestBed.inject(Vfo1TerminologyService);

      expect(service.iconClass("bwi-collection-shared")).toBe("bwi-collection-shared");
    });

    it("returns the mapped icon class when the flag is on", () => {
      flagSubject.next(true);

      const service = TestBed.inject(Vfo1TerminologyService);

      expect(service.iconClass("bwi-collection-shared")).toBe("bwi-shared-folder");
    });

    it("passes through an unmapped icon class when the flag is on", () => {
      flagSubject.next(true);

      const service = TestBed.inject(Vfo1TerminologyService);

      expect(service.iconClass("bwi-user")).toBe("bwi-user");
    });

    it("updates as the flag changes", () => {
      const service = TestBed.inject(Vfo1TerminologyService);

      flagSubject.next(true);
      expect(service.iconClass("bwi-collection-shared")).toBe("bwi-shared-folder");

      flagSubject.next(false);
      expect(service.iconClass("bwi-collection-shared")).toBe("bwi-collection-shared");
    });
  });
});

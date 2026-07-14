import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultTerminologyService } from "./vault-terminology.service";

describe("VaultTerminologyService", () => {
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
    const service = TestBed.inject(VaultTerminologyService);
    expect(service.enabled()).toBe(false);
  });

  it("reflects true when the flag resolves", () => {
    flagSubject.next(true);

    const service = TestBed.inject(VaultTerminologyService);

    expect(service.enabled()).toBe(true);
  });

  it("updates as the flag changes", () => {
    const service = TestBed.inject(VaultTerminologyService);

    flagSubject.next(true);

    expect(service.enabled()).toBe(true);

    flagSubject.next(false);

    expect(service.enabled()).toBe(false);
  });

  it("subscribes to the VFO1Foundation flag", () => {
    TestBed.inject(VaultTerminologyService);

    expect(configService.getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
  });
});

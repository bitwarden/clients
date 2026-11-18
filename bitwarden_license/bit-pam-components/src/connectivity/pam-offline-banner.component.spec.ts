import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { PamConnectivityService } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { PamOfflineBannerComponent } from "./pam-offline-banner.component";

describe("PamOfflineBannerComponent", () => {
  let fixture: ComponentFixture<PamOfflineBannerComponent>;

  function configure(connectivity?: PamConnectivityService): void {
    TestBed.configureTestingModule({
      imports: [PamOfflineBannerComponent],
      providers: [
        { provide: I18nService, useValue: { t: (key: string) => key } },
        ...(connectivity == null
          ? []
          : [{ provide: PamConnectivityService, useValue: connectivity }]),
      ],
    });
    fixture = TestBed.createComponent(PamOfflineBannerComponent);
    fixture.detectChanges();
  }

  function banner(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="pam-offline-banner"]');
  }

  it("renders nothing on a client that reports no connectivity", () => {
    configure();

    expect(banner()).toBeNull();
  });

  it("renders nothing while online", () => {
    configure({ offline$: of(false), reconnected$: of() });

    expect(banner()).toBeNull();
  });

  it("shows the offline notice while offline, and hides it on reconnect", () => {
    const offline$ = new BehaviorSubject(true);
    configure({ offline$, reconnected$: of() });

    expect(banner()?.textContent).toContain("pamOfflineBanner");

    offline$.next(false);
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });
});

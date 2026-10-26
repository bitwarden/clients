import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { RotationConfigsService } from "./managed-credentials/rotation-configs.service";
import { RotationShellComponent } from "./rotation-shell.component";

// JSDOM has no ResizeObserver; the tab nav bar's overflow list constructs one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

describe("RotationShellComponent", () => {
  let fixture: ComponentFixture<RotationShellComponent>;
  let loadMock: jest.Mock;

  const ORG_ID = "org-abc-123";

  beforeEach(async () => {
    loadMock = jest.fn().mockResolvedValue(undefined);

    const i18nService = { t: (key: string) => key };

    await TestBed.configureTestingModule({
      imports: [RotationShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            params: new BehaviorSubject({ organizationId: ORG_ID }),
            snapshot: { params: { organizationId: ORG_ID } },
          },
        },
        {
          provide: RotationConfigsService,
          useValue: { load: loadMock },
        },
        { provide: I18nService, useValue: i18nService },
      ],
    })
      .overrideComponent(RotationShellComponent, {
        remove: { imports: [HeaderModule] },
        add: { schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RotationShellComponent);
  });

  const init = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it("renders the page description in the header's subtitle slot", async () => {
    await init();
    const subtitle = (fixture.nativeElement as HTMLElement).querySelector('[slot="subtitle"]');
    expect(subtitle?.textContent?.trim()).toBe("pamRotationSubtitle");
  });

  it("calls load on RotationConfigsService with the organization id on init", async () => {
    await init();
    expect(loadMock).toHaveBeenCalledWith(ORG_ID);
  });
});

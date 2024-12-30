import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { RiskInsightsReportService } from "@bitwarden/bit-common/tools/reports/risk-insights";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { TableModule } from "@bitwarden/components";
import { LooseComponentsModule } from "@bitwarden/web-vault/app/shared";
import { PipesModule } from "@bitwarden/web-vault/app/vault/individual-vault/pipes/pipes.module";

import { PasswordHealthComponent } from "./password-health.component";

describe("PasswordHealthComponent", () => {
  let component: PasswordHealthComponent;
  let fixture: ComponentFixture<PasswordHealthComponent>;
  const activeRouteParams = convertToParamMap({ organizationId: "orgId" });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasswordHealthComponent, PipesModule, TableModule, LooseComponentsModule],
      declarations: [],
      providers: [
        { provide: RiskInsightsReportService, useValue: mock<RiskInsightsReportService>() },
        { provide: I18nService, useValue: mock<I18nService>() },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(activeRouteParams),
            url: of([]),
          },
        },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PasswordHealthComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should call generateReport on init", () => {});
});

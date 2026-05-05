import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ExportHelper } from "@bitwarden/vault-export-core";

import { ChartExportService } from "../../../shared/chart-export.service";
import { LineChartComponent } from "../../../shared/line-chart.component";
import { TimePeriod } from "../period-selector/period-selector.types";

import {
  TrendWidgetComponent,
  TrendWidgetData,
  TrendWidgetViewType,
} from "./trend-widget.component";

describe("TrendWidgetComponent", () => {
  let component: TrendWidgetComponent;
  let fixture: ComponentFixture<TrendWidgetComponent>;
  let mockI18nService: MockProxy<I18nService>;
  let mockThemeStateService: MockProxy<ThemeStateService>;
  let mockSystemTheme$: BehaviorSubject<ThemeType>;
  let mockFileDownloadService: MockProxy<FileDownloadService>;
  let mockChartExportService: MockProxy<ChartExportService>;

  const mockData: TrendWidgetData = {
    timeframe: TimePeriod.PastMonth,
    dataView: TrendWidgetViewType.Applications,
    dataPoints: [
      { timestamp: "2024-01-01", atRisk: 5, total: 10 },
      { timestamp: "2024-01-02", atRisk: 7, total: 12 },
      { timestamp: "2024-01-03", atRisk: 6, total: 11 },
    ],
  };

  beforeEach(async () => {
    mockI18nService = mock<I18nService>();
    mockThemeStateService = mock<ThemeStateService>();
    mockSystemTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);
    mockFileDownloadService = mock<FileDownloadService>();
    mockChartExportService = mock<ChartExportService>();

    mockI18nService.t.mockImplementation((key: string) => key);
    mockThemeStateService.selectedTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);

    // Mock getComputedStyle for CSS variable access
    global.getComputedStyle = jest.fn(() => ({
      getPropertyValue: jest.fn((prop: string) => {
        return "";
      }),
    })) as any;

    // Mock canvas context for Chart.js
    // ResizeObserver is not available in JSDOM; Chart.js uses it in bindResponsiveEvents
    // when a real canvas context is acquired.
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // Use a regular function (not arrow) so `this` refers to the canvas element.
    // Chart.js's DomPlatform.acquireContext checks `context.canvas === canvas`,
    // so the mock context must include `canvas: this` for the chart to initialize correctly.
    HTMLCanvasElement.prototype.getContext = jest.fn(function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        getImageData: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn(),
        setTransform: jest.fn(),
        resetTransform: jest.fn(),
        drawImage: jest.fn(),
        save: jest.fn(),
        fillText: jest.fn(),
        strokeText: jest.fn(),
        restore: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        bezierCurveTo: jest.fn(),
        quadraticCurveTo: jest.fn(),
        closePath: jest.fn(),
        stroke: jest.fn(),
        strokeRect: jest.fn(),
        translate: jest.fn(),
        scale: jest.fn(),
        rotate: jest.fn(),
        arc: jest.fn(),
        ellipse: jest.fn(),
        fill: jest.fn(),
        measureText: jest.fn(() => ({ width: 0 })),
        transform: jest.fn(),
        rect: jest.fn(),
        clip: jest.fn(),
        setLineDash: jest.fn(),
        getLineDash: jest.fn((): number[] => []),
        createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
        createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
      };
    }) as any;

    await TestBed.configureTestingModule({
      imports: [TrendWidgetComponent, NoopAnimationsModule],
      providers: [
        { provide: I18nService, useValue: mockI18nService },
        { provide: ThemeStateService, useValue: mockThemeStateService },
        { provide: SYSTEM_THEME_OBSERVABLE, useValue: mockSystemTheme$ },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
        { provide: ChartExportService, useValue: mockChartExportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TrendWidgetComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  describe("chart display with data", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("data", mockData);
      fixture.componentRef.setInput("loading", false);
      fixture.componentRef.setInput("error", null);
      fixture.detectChanges();
    });

    it("should display the chart when data is provided", () => {
      const lineChart = fixture.debugElement.query(By.directive(LineChartComponent));
      expect(lineChart).toBeTruthy();
    });

    it("should not display loading state", () => {
      const spinnerIcon = fixture.debugElement.query(By.css('bit-icon[name="bwi-spinner"]'));
      expect(spinnerIcon).toBeNull();
    });

    it("should not display error state", () => {
      const errorIcon = fixture.debugElement.query(By.css('bit-icon[name="bwi-error"]'));
      expect(errorIcon).toBeNull();
    });

    it("should pass correct data to line chart", () => {
      const lineChart = fixture.debugElement.query(By.directive(LineChartComponent));
      const lineChartComponent = lineChart.componentInstance as LineChartComponent;

      expect(lineChartComponent.lines()).toHaveLength(2);
      expect(lineChartComponent.lines()[0].pointData).toHaveLength(3);
      expect(lineChartComponent.lines()[1].pointData).toHaveLength(3);
    });

    it("should display translated title", () => {
      const title = fixture.debugElement.query(By.css("h2"));
      expect(title.nativeElement.textContent.trim()).toBe("riskOverTime");
    });
  });

  describe("loading state", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("data", mockData);
      fixture.componentRef.setInput("loading", true);
      fixture.componentRef.setInput("error", null);
      fixture.detectChanges();
    });

    it("should display loading spinner", () => {
      const spinnerIcon = fixture.debugElement.query(By.css('bit-icon[name="bwi-spinner"]'));
      expect(spinnerIcon).toBeTruthy();
    });

    it("should not display the chart", () => {
      const lineChart = fixture.debugElement.query(By.directive(LineChartComponent));
      expect(lineChart).toBeNull();
    });

    it("should not display error state", () => {
      const errorIcon = fixture.debugElement.query(By.css('bit-icon[name="bwi-error"]'));
      expect(errorIcon).toBeNull();
    });
  });

  describe("error state", () => {
    const errorMessage = "Failed to load data";

    beforeEach(() => {
      fixture.componentRef.setInput("data", mockData);
      fixture.componentRef.setInput("loading", false);
      fixture.componentRef.setInput("error", errorMessage);
      fixture.detectChanges();
    });

    it("should display error icon", () => {
      const errorIcon = fixture.debugElement.query(By.css('bit-icon[name="bwi-error"]'));
      expect(errorIcon).toBeTruthy();
    });

    it("should display error message", () => {
      const errorText = fixture.debugElement.query(By.css(".tw-text-danger p"));
      expect(errorText.nativeElement.textContent.trim()).toBe(errorMessage);
    });

    it("should not display the chart", () => {
      const lineChart = fixture.debugElement.query(By.directive(LineChartComponent));
      expect(lineChart).toBeNull();
    });

    it("should not display loading state", () => {
      const spinnerIcon = fixture.debugElement.query(By.css('bit-icon[name="bwi-spinner"]'));
      expect(spinnerIcon).toBeNull();
    });
  });

  describe("view selector", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("data", mockData);
      fixture.componentRef.setInput("loading", false);
      fixture.componentRef.setInput("error", null);
      fixture.detectChanges();
    });

    it("should have Applications as the default selected view", () => {
      expect(component.selectedView()).toBe(TrendWidgetViewType.Applications);
    });

    it("should include toggle options for applications, passwords, and members", () => {
      const toggles = fixture.debugElement.queryAll(By.css("bit-toggle"));
      expect(toggles).toHaveLength(3);

      expect(toggles[0].nativeElement.textContent.trim()).toBe("applications");
      expect(toggles[1].nativeElement.textContent.trim()).toBe("passwords");
      expect(toggles[2].nativeElement.textContent.trim()).toBe("members");
    });

    it("should update selectedView signal and emit viewChanged event when toggle is clicked", () => {
      const viewChangedSpy = jest.fn();
      component.viewChanged.subscribe(viewChangedSpy);

      const toggles = fixture.debugElement.queryAll(By.css("bit-toggle"));
      const passwordsToggleInput = toggles[1].nativeElement.querySelector('input[type="radio"]');
      passwordsToggleInput.click();
      fixture.detectChanges();

      expect(component.selectedView()).toBe(TrendWidgetViewType.Passwords);
      expect(viewChangedSpy).toHaveBeenCalledWith(TrendWidgetViewType.Passwords);
    });
  });

  describe("download button", () => {
    beforeEach(() => {
      fixture.componentRef.setInput("data", mockData);
      fixture.componentRef.setInput("loading", false);
      fixture.componentRef.setInput("error", null);
      fixture.detectChanges();
    });

    it("should download file as CSV when CSV button is clicked", () => {
      jest.spyOn(ExportHelper, "getFileName").mockReturnValue("test-file.csv");

      // Open the download menu
      const menuTrigger = fixture.debugElement.query(
        By.css('button[bitIconButton="bwi-download"]'),
      );
      menuTrigger.nativeElement.click();
      fixture.detectChanges();

      // Click the CSV button in the menu
      const buttons = fixture.debugElement.queryAll(By.css("button[bitMenuItem]"));
      const csvMenuItem = buttons.find((btn) => btn.nativeElement.textContent.trim() === "CSV");

      expect(csvMenuItem).toBeDefined();

      csvMenuItem!.nativeElement.click();
      fixture.detectChanges();

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
      expect(mockFileDownloadService.download).toHaveBeenCalledWith({
        fileName: "test-file.csv",
        blobData: expect.any(String),
        blobOptions: { type: "text/csv" },
      });

      // Verify CSV content structure
      const callArgs = mockFileDownloadService.download.mock.calls[0][0];
      const csvContent = callArgs.blobData as string;

      // Check CSV headers are present
      expect(csvContent).toContain("date");
      expect(csvContent).toContain("criticalAppsAtRisk");
      expect(csvContent).toContain("allCriticalApps");

      // Check data points are included
      expect(csvContent).toContain("5");
      expect(csvContent).toContain("10");
      expect(csvContent).toContain("7");
      expect(csvContent).toContain("12");
    });

    it("should download chart as PNG when PNG button is clicked", () => {
      jest.spyOn(ExportHelper, "getFileName").mockReturnValue("test-chart.png");

      // Open the download menu
      const menuTrigger = fixture.debugElement.query(
        By.css('button[bitIconButton="bwi-download"]'),
      );
      menuTrigger.nativeElement.click();
      fixture.detectChanges();

      // Click the PNG button in the menu
      const buttons = fixture.debugElement.queryAll(By.css("button[bitMenuItem]"));
      const pngMenuItem = buttons.find((btn) => btn.nativeElement.textContent.trim() === "PNG");

      expect(pngMenuItem).toBeDefined();

      pngMenuItem!.nativeElement.click();
      fixture.detectChanges();

      expect(mockChartExportService.downloadAsPNG).toHaveBeenCalledTimes(1);
      expect(mockChartExportService.downloadAsPNG).toHaveBeenCalledWith(
        "line",
        expect.any(Object),
        "test-chart.png",
        {
          title: "riskOverTime",
          xAxisLabel: "date",
          yAxisLabel: "applications",
        },
      );
    });
  });
});

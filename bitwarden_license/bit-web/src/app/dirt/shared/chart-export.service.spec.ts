import { TestBed } from "@angular/core/testing";
import { Chart } from "chart.js";
import { mock, MockProxy } from "jest-mock-extended";

import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";

import { ChartExportService } from "./chart-export.service";

jest.mock("chart.js");

const mockDestroyFn = jest.fn();
(Chart as jest.MockedClass<typeof Chart>).mockImplementation(
  () => ({ destroy: mockDestroyFn }) as any,
);

const sourceChart = {
  data: {
    datasets: [],
  },
  options: {
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "center",
        labels: {
          padding: 10,
          usePointStyle: false,
        },
      },
      title: {
        text: "Test Chart Title",
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
          displayFormats: { day: "MMM d" },
        },
        grid: { display: false },
        ticks: { maxTicksLimit: 6 },
        title: { text: "X Axis Label" },
      },
      y: {
        beginAtZero: true,
        title: { text: "Y Axis Label" },
      },
    },
  },
} as unknown as Chart;

describe("ChartExportService", () => {
  let service: ChartExportService;
  let mockFileDownloadService: MockProxy<FileDownloadService>;

  beforeEach(async () => {
    mockFileDownloadService = mock<FileDownloadService>();

    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      getImageData: jest.fn(),
      putImageData: jest.fn(),
      createImageData: jest.fn(),
      setTransform: jest.fn(),
      drawImage: jest.fn(),
      save: jest.fn(),
      fillText: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      measureText: jest.fn(() => ({ width: 0 })),
      transform: jest.fn(),
      rect: jest.fn(),
      clip: jest.fn(),
    })) as any;

    HTMLCanvasElement.prototype.toBlob = jest.fn((cb) =>
      cb(new Blob([""], { type: "image/png" })),
    ) as any;

    await TestBed.configureTestingModule({
      providers: [
        ChartExportService,
        { provide: FileDownloadService, useValue: mockFileDownloadService },
      ],
    }).compileComponents();

    service = TestBed.inject(ChartExportService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("downloadAsPNG", () => {
    it("calls fileDownloadService.download with PNG blob and filename", () => {
      service.downloadAsPNG("line", sourceChart, "test-chart.png");

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
      expect(mockFileDownloadService.download).toHaveBeenCalledWith({
        fileName: "test-chart.png",
        blobData: expect.any(Blob),
        blobOptions: { type: "image/png" },
      });
    });
  });
});

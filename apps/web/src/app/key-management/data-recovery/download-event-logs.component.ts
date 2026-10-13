import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { ButtonModule, LinkModule, TypographyModule } from "@bitwarden/components";
import { buildFlightRecorderCsvExport } from "@bitwarden/logging";
import { FlightRecorderService } from "@bitwarden/logging-angular";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-download-event-logs",
  templateUrl: "download-event-logs.component.html",
  imports: [ButtonModule, LinkModule, TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DownloadEventLogsComponent {
  private readonly flightRecorder = inject(FlightRecorderService);
  private readonly fileDownloadService = inject(FileDownloadService);

  protected readonly download = async () => {
    const events = await this.flightRecorder.read();
    this.fileDownloadService.download(buildFlightRecorderCsvExport(events));
  };
}

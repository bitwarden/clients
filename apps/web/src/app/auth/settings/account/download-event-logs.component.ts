import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { ButtonModule } from "@bitwarden/components";
import { FlightRecorderService } from "@bitwarden/logging-angular";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-download-event-logs",
  templateUrl: "download-event-logs.component.html",
  imports: [ButtonModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DownloadEventLogsComponent {
  private readonly flightRecorder = inject(FlightRecorderService);
  private readonly fileDownloadService = inject(FileDownloadService);

  protected readonly download = async () => {
    const events = await this.flightRecorder.read();
    const blobData = events.map((e) => JSON.stringify(e)).join("\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    this.fileDownloadService.download({
      fileName: `bitwarden-flight-recorder-${timestamp}.txt`,
      blobData,
      blobOptions: { type: "text/plain" },
    });
  };
}

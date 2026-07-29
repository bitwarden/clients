import { AccessReportSummaryApi } from "../api/access-report-summary.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummary } from "../domain/access-report-summary"; // eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryView } from "../view/access-report-summary.view";

/**
 * Serializable data model for an access report summary's encrypted envelope.
 *
 * - See {@link AccessReportSummary} for domain model
 * - See {@link AccessReportSummaryApi} for API model
 *  * - See {@link AccessReportSummaryView} from View Model
 */
export class AccessReportSummaryData {
  organizationId?: string;
  encryptedData?: string;
  encryptionKey?: string;
  date?: string;

  constructor(data?: AccessReportSummaryApi) {
    if (data == null) {
      return;
    }

    this.organizationId = data.organizationId;
    this.encryptedData = data.encryptedData;
    this.encryptionKey = data.encryptionKey;
    this.date = data.date;
  }
}

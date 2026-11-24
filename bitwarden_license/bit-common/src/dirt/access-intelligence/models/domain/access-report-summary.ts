import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { EncString } from "@bitwarden/sdk-internal";

import { AccessReportSummaryData } from "../data/access-report-summary.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryView } from "../view/access-report-summary.view";

/**
 * Encrypted domain model for an access report summary.
 * Holds the encrypted aggregate blob and its associated encryption key.
 *
 * - See {@link AccessReportSummaryApi} for API model
 * - See {@link AccessReportSummaryData} for data model
 * - See {@link AccessReportSummaryView} from View Model
 */
export class AccessReportSummary extends Domain {
  organizationId: string = "";
  encryptedData: EncString | undefined;
  encryptionKey: EncString | undefined;
  date: Date = new Date(0);

  constructor(obj?: AccessReportSummaryData) {
    super();
    if (obj == null) {
      return;
    }

    this.organizationId = obj.organizationId ?? "";
    this.encryptedData = obj.encryptedData ? (obj.encryptedData as EncString) : undefined;
    this.encryptionKey = obj.encryptionKey ? (obj.encryptionKey as EncString) : undefined;
    this.date = obj.date ? new Date(obj.date) : new Date(0);
  }

  toData(): AccessReportSummaryData {
    const data = new AccessReportSummaryData();
    data.organizationId = this.organizationId;
    data.encryptedData = this.encryptedData ?? "";
    data.encryptionKey = this.encryptionKey ?? "";
    data.date = this.date.toISOString();
    return data;
  }
}

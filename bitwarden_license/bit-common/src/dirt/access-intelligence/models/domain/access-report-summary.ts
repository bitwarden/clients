import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSummaryApi } from "../api/access-report-summary.api";
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
    this.encryptedData = obj.encryptedData ? new EncString(obj.encryptedData) : undefined;
    this.encryptionKey = obj.encryptionKey ? new EncString(obj.encryptionKey) : undefined;
    this.date = obj.date ? new Date(obj.date) : new Date(0);
  }

  toData(): AccessReportSummaryData {
    const data = new AccessReportSummaryData();
    data.organizationId = this.organizationId;
    data.encryptedData = this.encryptedData?.encryptedString ?? "";
    data.encryptionKey = this.encryptionKey?.encryptedString ?? "";
    data.date = this.date.toISOString();
    return data;
  }
}

import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettingsApi } from "../api/access-report-settings.api";
import { AccessReportSettingsData } from "../data/access-report-settings.data";
import { AccessReportSettings } from "../domain/access-report-settings";

/**
 * View model for application settings data in Access Intelligence containing decrypted properties
 *
 * - See {@link AccessReportSettings} for domain model
 * - See {@link AccessReportSettingsData} for data model
 * - See {@link AccessReportSettingsApi} for API model
 */
export class AccessReportSettingsView implements View {
  applicationName: string = "";
  isCritical = false;
  reviewedDate?: Date;

  constructor(a?: AccessReportSettings) {
    if (a == null) {
      return;
    }

    this.applicationName = a.applicationName;
    this.isCritical = a.isCritical;
    this.reviewedDate = a.reviewedDate;
  }

  toJSON() {
    return this;
  }

  static fromData(data: AccessReportSettingsData): AccessReportSettingsView {
    const view = new AccessReportSettingsView();
    view.applicationName = data.applicationName;
    view.isCritical = data.isCritical;
    view.reviewedDate = data.reviewedDate != null ? new Date(data.reviewedDate) : undefined;
    return view;
  }

  static fromJSON(obj: Partial<DeepJsonify<AccessReportSettingsView>>): AccessReportSettingsView {
    return Object.assign(new AccessReportSettingsView(), obj);
  }

  // [TODO] SDK Mapping
  // toSdkAccessReportSettingsView(): SdkAccessReportSettingsView {}
  // static fromAccessReportSettingsView(obj?: SdkAccessReportSettingsView): AccessReportSettingsView | undefined {}
}

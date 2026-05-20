import { Observable, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

import { AccessReportView } from "../../../models";
import { ReportPersistenceService } from "../../abstractions/report-persistence.service";

import { DefaultReportPersistenceService } from "./default-report-persistence.service";
import { FileReportPersistenceService } from "./file-report-persistence.service";

export class ReportPersistenceFeatureFlagService extends ReportPersistenceService {
  constructor(
    private filePersistenceService: FileReportPersistenceService,
    private defaultPersistenceService: DefaultReportPersistenceService,
    private configService: ConfigService,
  ) {
    super();
  }

  loadLastReport$(
    organizationId: OrganizationId,
  ): Observable<{ report: AccessReportView; hadLegacyBlobs: boolean } | null> {
    return this.configService
      .getFeatureFlag$(FeatureFlag.AccessIntelligenceReportFileStorage)
      .pipe(
        switchMap((useFileStorage) =>
          useFileStorage
            ? this.filePersistenceService.loadLastReport$(organizationId)
            : this.defaultPersistenceService.loadLastReport$(organizationId),
        ),
      );
  }

  saveApplicationMetadata$(view: AccessReportView): Observable<void> {
    return this.configService
      .getFeatureFlag$(FeatureFlag.AccessIntelligenceReportFileStorage)
      .pipe(
        switchMap((useFileStorage) =>
          useFileStorage
            ? this.filePersistenceService.saveApplicationMetadata$(view)
            : this.defaultPersistenceService.saveApplicationMetadata$(view),
        ),
      );
  }

  saveReport$(
    view: AccessReportView,
    organizationId: OrganizationId,
  ): Observable<{ id: OrganizationReportId; contentEncryptionKey: EncString }> {
    return this.configService
      .getFeatureFlag$(FeatureFlag.AccessIntelligenceReportFileStorage)
      .pipe(
        switchMap((useFileStorage) =>
          useFileStorage
            ? this.filePersistenceService.saveReport$(view, organizationId)
            : this.defaultPersistenceService.saveReport$(view, organizationId),
        ),
      );
  }
}

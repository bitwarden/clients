// FIXME: Update this file to be type safe
// @ts-strict-ignore
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  ApplicationHealthReportDetail,
  ApplicationHealthReportSummary,
  RiskInsightsReport,
  GetRiskInsightsReportResponse,
} from "../models/password-health";

export class RiskInsightsEncryptionService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private keyGeneratorService: KeyGenerationService,
  ) {}

  // [FIX-ME] This method is not implemented yet.
  async encryptRiskInsightsReport(
    organizationId: OrganizationId,
    details: ApplicationHealthReportDetail[],
    summary: ApplicationHealthReportSummary,
  ): Promise<RiskInsightsReport> {
    return;
  }

  // [FIX-ME] This method is not implemented yet.
  async decryptRiskInsightsReport(
    organizationId: OrganizationId,
    riskInsightsReportResponse: GetRiskInsightsReportResponse,
  ): Promise<[ApplicationHealthReportDetail[], ApplicationHealthReportSummary]> {
    return [null, null];
  }
}

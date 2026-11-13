import { ServiceAccountService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { parseSmId, smErrorResponse, smNotFoundResponse } from "../sm-command.utils";

/**
 * Confirms the machine account exists in the organization. Access tokens are encrypted with the
 * organization key, so a machine account in another organization must be rejected up front.
 */
export async function resolveSmMachineAccountId(
  serviceAccountService: ServiceAccountService,
  organizationId: string,
  machineAccountId: string,
): Promise<
  | { machineAccountId: string; error?: undefined }
  | { machineAccountId?: undefined; error: Response }
> {
  const parsed = parseSmId(machineAccountId, "machineaccountid");
  if (parsed.error) {
    return { error: parsed.error };
  }

  try {
    const machineAccount = await serviceAccountService.getByServiceAccountId(
      parsed.id,
      organizationId,
    );
    if (machineAccount.organizationId !== organizationId) {
      return { error: smNotFoundResponse("machine account") };
    }
  } catch (e) {
    return { error: smErrorResponse(e, "machine account") };
  }
  return { machineAccountId: parsed.id };
}

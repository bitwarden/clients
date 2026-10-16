import { BulkOperationStatus } from "@bitwarden/bit-common/secrets-manager/models/bulk-operation-status";
import { SecretListView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-list.view";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmBulkStatusResponse } from "../models/sm-bulk-status.response";
import { parseSmIds, smNotFoundResponse } from "../sm-command.utils";

export type SmTrashSelection = {
  secretIds?: string[];
  all?: boolean;
};

/**
 * Resolves the trashed secrets a trash command applies to: either every trashed secret
 * (`all`) or the given ids, each of which must be in the trash.
 */
export function selectTrashedSecrets(
  trashed: SecretListView[],
  selection: SmTrashSelection,
): { secrets: SecretListView[]; error?: undefined } | { secrets?: undefined; error: Response } {
  const hasIds = selection.secretIds != null && selection.secretIds.length > 0;
  if (selection.all && hasIds) {
    return { error: Response.badRequest("Provide secret ids or `--all`, not both.") };
  }
  if (selection.all) {
    return { secrets: trashed };
  }

  const parsed = parseSmIds(selection.secretIds, "secretId");
  if (parsed.error) {
    return { error: parsed.error };
  }
  const secrets: SecretListView[] = [];
  for (const id of parsed.ids) {
    const secret = trashed.find((s) => s.id === id);
    if (secret == null) {
      return { error: smNotFoundResponse("trashed secret `" + id + "`") };
    }
    secrets.push(secret);
  }
  return { secrets };
}

export function trashResultResponse(secrets: SecretListView[]): Response {
  return Response.success(
    new ListResponse(
      secrets.map((s) => {
        const status = new BulkOperationStatus();
        status.id = s.id;
        status.name = s.name;
        return new SmBulkStatusResponse(status);
      }),
    ),
  );
}

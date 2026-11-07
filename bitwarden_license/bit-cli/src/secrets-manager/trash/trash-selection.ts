import { BulkOperationStatus, SecretListView } from "@bitwarden/bit-sm";
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
  const secretIds = selection.secretIds ?? [];
  if (selection.all && secretIds.length > 0) {
    return { error: Response.badRequest("Provide secret ids or `--all`, not both.") };
  }
  if (selection.all) {
    return { secrets: trashed };
  }

  const parsed = parseSmIds(secretIds, "secretId");
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

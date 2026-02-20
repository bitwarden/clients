// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Folder } from "../domain/folder";

import { FolderRequest } from "./folder.request";

export class FolderWithIdRequest extends FolderRequest {
  /**
   * Declared as `string` (not `string | null`) to satisfy the
   * {@link UserKeyRotationDataProvider}`<TRequest extends { id: string } | { organizationId: string }>`
   * constraint on `FolderService`.
   *
   * At runtime this is `null` for new import folders. PR #17077 enforced strict type-checking on
   * folder models, changing this assignment to `folder.id ?? ""` — causing the importer to send
   * `{"id":""}` instead of `{"id":null}`, which the server rejected.
   * The `|| null` below restores the pre-migration behavior while `@ts-strict-ignore` above
   * allows the `null` assignment against the `string` declaration.
   */
  id: string;

  constructor(folder: Folder) {
    super(folder);
    this.id = folder.id || null;
  }
}

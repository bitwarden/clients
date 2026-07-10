import { RotationJobResponse } from "./rotation-config-details.response";
import { RotationDaemonResponse } from "./rotation-daemon.response";

/**
 * Detailed view from GET /organizations/{orgId}/rotation/daemons/{id} — extends the list item
 * with the daemon's recent rotation activity (the jobs it has claimed and their attempts).
 *
 * NOTE: These fields reflect the **planned** server contract (server not yet implemented).
 * `jobs` is an ordered list (newest first, matching typical UI conventions) of
 * {@link RotationJobResponse} instances parsed as nested BaseResponses. Wire property names
 * are PascalCase.
 */
export class RotationDaemonDetailsResponse extends RotationDaemonResponse {
  /**
   * Recent rotation jobs this daemon has worked, newest first.
   * Each job carries its own attempt list (oldest first within the job).
   */
  jobs: RotationJobResponse[];

  constructor(response: unknown) {
    super(response);
    this.jobs = ((this.getResponseProperty("Jobs") as unknown[]) ?? []).map(
      (j) => new RotationJobResponse(j),
    );
  }
}

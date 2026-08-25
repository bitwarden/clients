import { RotationJobResponse } from "./rotation-config-details.response";
import { RotationDaemonResponse } from "./rotation-daemon.response";

/**
 * Detailed view from GET /organizations/{orgId}/rotation/daemons/{id} — extends the list item
 * with the daemon's recent rotation activity (the jobs it has claimed and their attempts).
 *
 * Mirrors the server's `PamDaemonDetailResponseModel`, which extends the list model: the
 * daemon's own fields arrive flattened onto this same object (hence `super(response)`),
 * alongside `Jobs`. Jobs are newest first and carry only the attempts this daemon recorded,
 * parsed as nested {@link RotationJobResponse} BaseResponses. The server caps how many it
 * returns, so this is recent activity rather than the daemon's whole history.
 */
export class RotationDaemonDetailsResponse extends RotationDaemonResponse {
  /**
   * Recent rotation jobs this daemon has worked, newest first.
   * Each job carries this daemon's attempts against it (oldest first within the job).
   */
  jobs: RotationJobResponse[];

  constructor(response: unknown) {
    super(response);
    this.jobs = ((this.getResponseProperty("Jobs") as unknown[]) ?? []).map(
      (j) => new RotationJobResponse(j),
    );
  }
}

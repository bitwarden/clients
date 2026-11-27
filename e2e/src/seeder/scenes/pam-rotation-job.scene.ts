import { SceneTemplate } from "../scene";

/** See `PamRotationJobScene.Request` in the server's util/Seeder/Scenes. */
export type PamRotationJobArgs = {
  /** The managed credential's id. */
  rotationConfigId: string;
  /** An hour when unset. Negative seeds a job that has already expired. */
  expiresInSeconds?: number;
  /** Claimable at once when unset. */
  nextClaimableInSeconds?: number;
};

/** See `PamRotationJobScene.Result` in the server's util/Seeder/Scenes. */
export type PamRotationJobResult = {
  jobId: string;
};

/**
 * An unclaimed on-demand rotation of a managed credential, as Rotate now offers one. The server
 * refuses it unless the credential is not paused, its target system is automatic and active, and
 * no rotation of it is already running.
 */
export class PamRotationJobScene extends SceneTemplate<PamRotationJobArgs, PamRotationJobResult> {
  readonly template = "PamRotationJobScene";
}

export const RENDERER_TEARDOWN_FLAG_CHANNEL = "desktop.rendererTeardownEnabled";

/**
 * Determine whether the feature flag for destroying the renderer is active. This is determined on
 * `main` once at startup.
 */
export async function rendererTeardownEnabled(): Promise<boolean> {
  return await ipc.platform.rendererTeardownEnabled();
}

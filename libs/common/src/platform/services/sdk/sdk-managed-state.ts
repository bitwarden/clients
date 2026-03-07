import { StateClient } from "@bitwarden/sdk-internal";

export async function initializeSdkManagedState(stateClient: StateClient): Promise<void> {
  await stateClient.initialize_state({
    db_name: "bitwarden",
  });
}

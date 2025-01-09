import { ExtensionPointId } from "./extension-point-id";
import { IntegrationId } from "./integration-id";

/** The capabilities and descriptive content for an integration */
export type IntegrationMetadata = {
  /** Uniquely identifies the integrator. */
  id: IntegrationId;

  /** Brand name of the integrator. */
  name: string;

  /** Features extended by the integration. */
  extends: Array<ExtensionPointId>;

  /** Common URL for the service; this should only be undefined when selfHost is "always" */
  baseUrl?: string;

  /** Determines whether the integration supports self-hosting;
   *  "maybe" allows a service's base URLs to vary from the metadata URL
   *  "never" always sets a service's baseURL from the metadata URL
   */
  selfHost: "always" | "maybe" | "never";
};

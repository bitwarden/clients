import { GenerationRequest } from "../../types";

/** Options that provide contextual information about the application state
 *  when an integration is invoked.
 */
export type IntegrationRequest = Partial<GenerationRequest>;

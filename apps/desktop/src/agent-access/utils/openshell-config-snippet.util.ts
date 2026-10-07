import { OpenShellSnippet } from "../models/openshell";

export interface OpenShellSnippetInput {
  aacPath: string;
  gatewayName: string;
  driverSocketPath: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f-\u009f]/;

/** A TOML basic string body: `\` → `\\`, `"` → `\"`. Control characters never get here. */
function tomlBasicString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Builds the copyable `gateway.toml` snippet and the two example commands (§M8.8). Pure: no I/O,
 * and desktop never writes the result anywhere — the user merges it by hand.
 *
 * Returns `null` when any input contains a control character. Showing nothing beats showing a
 * snippet that would parse differently from how it reads.
 */
export function buildOpenShellSnippet(input: OpenShellSnippetInput): OpenShellSnippet | null {
  const { aacPath, gatewayName, driverSocketPath } = input;
  if ([aacPath, gatewayName, driverSocketPath].some((value) => CONTROL_CHARACTER.test(value))) {
    return null;
  }

  const gatewayToml = [
    "[openshell.gateway]",
    'credential_drivers = ["bitwarden"]',
    "",
    "[openshell.credential_drivers.bitwarden]",
    'transport = "uds"',
    `socket_path = "${tomlBasicString(driverSocketPath)}"`,
    `command = "${tomlBasicString(aacPath)}"`,
    `args = ["openshell-driver", "--gateway", "${tomlBasicString(gatewayName)}"]`,
    "startup_timeout_secs = 10",
  ].join("\n");

  return {
    gatewayToml,
    providerExample:
      "openshell provider create --name <provider>-<sandbox> --type <profile> --credential GITHUB_TOKEN=bw://item/<item-uuid>#password",
    attachExample: "openshell sandbox provider attach <sandbox> <provider>-<sandbox>",
    gatewayName,
  };
}

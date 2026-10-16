import type * as Inquirer from "inquirer";

/**
 * Loads inquirer on first use. Only a command that prompts needs it, and loading it on startup
 * costs every command ~50 ms.
 */
export function loadInquirer(): Promise<typeof Inquirer> {
  return import("inquirer");
}

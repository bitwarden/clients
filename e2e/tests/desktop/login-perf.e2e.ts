import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect } from "@playwright/test";

import { AccountName, account, selfHostedUrl } from "../../src/credentials";
import { test } from "../../src/desktop/fixtures";
import { E2E_STATE_DIR } from "../../src/paths";

/**
 * Measures master password login on a fresh desktop profile.
 *
 *   email ──► continue ──► password page ──► log in ──► vault route ──► first vault row
 *
 * Wall-clock timings come from the test; `[perf]` lines the app logs (the renderer
 * forwards its logs to the main process stdout) are collected alongside.
 * Run several samples with `--repeat-each`; results land in
 * .debug/e2e/perf/<PERF_LABEL>-<repeat>.json.
 */

const VAULT_URL = /#\/vault/;
const PERF_TAG = "[perf]";
const LABEL = process.env.PERF_LABEL ?? "login";
const PERF_DIR = resolve(E2E_STATE_DIR, "perf");

/** Logging into a large vault syncs and decrypts every item before the vault shows. */
const VAULT_TIMEOUT_MS = 300_000;
/** Post-login work (sync, decrypts) keeps running after the vault shows; capture it too. */
const SETTLE_MS = 10_000;

const ENV_MENU_TRIGGER = 'environment-selector button[aria-haspopup="menu"]';
const BASE_URL_INPUT = "#self_hosted_env_settings_form_input_base_url";

test("measures master password login", async ({ app, window }, testInfo) => {
  test.setTimeout(600_000);

  // Renderer logs are forwarded to the main process, so its stdout carries both.
  const logs: string[] = [];
  app.process().stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.includes(PERF_TAG)) {
        logs.push(line.trim());
      }
    }
  });
  const mark = (label: string) => logs.push(`---- t=${Date.now()} ${label} ----`);

  const target = account(AccountName.Usdev);

  // Server selection is setup, not part of the measured login.
  await window.locator(ENV_MENU_TRIGGER).click();
  await window.getByRole("menuitem", { name: /self-hosted/i }).click();
  await window.locator(BASE_URL_INPUT).fill(selfHostedUrl(target));
  await window.getByRole("button", { name: "Save", exact: true }).click();
  await expect(window.locator(BASE_URL_INPUT)).toBeHidden();

  await window.getByTestId("login-email-input").fill(target.email);
  mark("continue");
  const continueStart = Date.now();
  await window.getByTestId("login-continue-button").click();
  const password = window.getByTestId("login-master-password-input");
  await expect(password).toBeVisible({ timeout: 60_000 });
  const continueMs = Date.now() - continueStart;

  await password.fill(target.password);
  mark("submit");
  const submitStart = Date.now();
  await window.getByTestId("login-submit-button").click();

  await window.waitForURL(VAULT_URL, { timeout: VAULT_TIMEOUT_MS });
  const vaultRouteMs = Date.now() - submitStart;
  mark("vault route");

  await expect(
    window.getByRole("checkbox", { name: "Select row", exact: true }).first(),
  ).toBeVisible({ timeout: VAULT_TIMEOUT_MS });
  const vaultRowsMs = Date.now() - submitStart;
  mark("vault rows");

  await window.waitForTimeout(SETTLE_MS);
  mark("settled");

  const result = { continueMs, vaultRouteMs, vaultRowsMs };
  mkdirSync(PERF_DIR, { recursive: true });
  const out = resolve(PERF_DIR, `${LABEL}-${testInfo.repeatEachIndex}.json`);
  writeFileSync(out, JSON.stringify({ label: LABEL, result, logs }, null, 2));

  // eslint-disable-next-line no-console
  console.log(`${PERF_TAG} results → ${out}\n${JSON.stringify(result)}`);
});

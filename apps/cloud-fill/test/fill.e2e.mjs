import assert from "node:assert/strict";

import { launchWithExtension, startPageServer, trigger } from "./harness.mjs";

const secrets = { username: "spike-user@example.test", password: "spike-Pa55w0rd!" };

const pages = await startPageServer();
const browser = await launchWithExtension();
let failed = false;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}\n  ${error.message}`);
  }
}

try {
  const page = await browser.context.newPage();

  await check("fills username and password on a localhost login page", async () => {
    await page.goto(`http://localhost:${pages.port}/login.html`);
    const result = await trigger(browser.worker, page);
    assert.deepEqual(result, {
      status: "ok",
      filledFields: 2,
      origin: `http://localhost:${pages.port}`,
    });
    assert.equal(await page.locator("#username").inputValue(), secrets.username);
    assert.equal(await page.locator("#password").inputValue(), secrets.password);
    assert.equal(await page.locator("#q").inputValue(), "");
    assert.equal(pages.posts.length, 0, "fill must not submit the form");
  });

  await check("trigger result and page DOM attributes do not contain the secret", async () => {
    const result = JSON.stringify(await trigger(browser.worker, page));
    assert.ok(!result.includes(secrets.password));
    const html = await page.content();
    assert.ok(!html.includes(secrets.password), "password reflected into DOM attributes");
  });

  await check("refuses when the top frame hostname has no credential (127.0.0.1)", async () => {
    await page.goto(`http://127.0.0.1:${pages.port}/login.html`);
    const result = await trigger(browser.worker, page);
    assert.equal(result.status, "not_filled");
    assert.equal(await page.locator("#password").inputValue(), "");
  });

  await check("refuses a form whose action leaves the origin", async () => {
    await page.goto(`http://localhost:${pages.port}/cross-origin-action.html`);
    const result = await trigger(browser.worker, page);
    assert.equal(result.status, "refused_form_action");
    assert.equal(await page.locator("#password").inputValue(), "");
  });

  for (const [name, file] of [
    ["a child input named action clobbering form.action", "clobbered-action.html"],
    ["a submit control with its own formaction", "formaction-override.html"],
    ["login fields outside any form", "formless.html"],
  ]) {
    await check(`refuses ${name}`, async () => {
      await page.goto(`http://localhost:${pages.port}/${file}`);
      const result = await trigger(browser.worker, page);
      assert.equal(result.status, "refused_form_action");
      assert.equal(await page.locator("#password").inputValue(), "");
    });
  }

  await check("refuses when the caller pins a different origin than the tab", async () => {
    await page.goto(`http://localhost:${pages.port}/login.html`);
    const result = await trigger(browser.worker, page, "http://localhost:1");
    assert.equal(result.status, "refused_origin");
    assert.equal(await page.locator("#password").inputValue(), "");
  });

  await check("a second fill while one is running reports busy", async () => {
    await page.goto(`http://localhost:${pages.port}/login.html`);
    await page.bringToFront();
    const [first, second] = await browser.worker.evaluate(async () => {
      const a = globalThis.cloudFill.fillActiveTab();
      const b = globalThis.cloudFill.fillActiveTab();
      return Promise.all([a, b]);
    });
    assert.equal(first.status, "ok");
    assert.equal(second.status, "busy");
  });

  await check("reports no_fields on a page without a login form", async () => {
    await page.goto(`http://localhost:${pages.port}/no-login.html`);
    const result = await trigger(browser.worker, page);
    assert.equal(result.status, "no_fields");
  });

  await check("refuses non-eligible top frame URLs", async () => {
    await page.goto("about:blank");
    const result = await trigger(browser.worker, page);
    assert.equal(result.status, "refused_origin");
  });
} finally {
  await browser.close();
  pages.close();
}

process.exit(failed ? 1 : 0);

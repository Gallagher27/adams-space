import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("emits the files required by Cloudflare Pages packaging", async () => {
  await access(new URL("../dist/index.html", import.meta.url));
  await access(new URL("../dist/_headers", import.meta.url));
  await access(new URL("../functions/api/[[path]].js", import.meta.url));
  await access(new URL("../functions/assets/photos/[[path]].js", import.meta.url));
  await access(new URL("../cron/index.js", import.meta.url));
});

test("keeps the monthly password rotation as a separate Cron Worker", async () => {
  const config = await readFile(new URL("../wrangler.cron.example.jsonc", import.meta.url), "utf8");
  assert.match(config, /\"crons\"\s*:\s*\[\"5 0 \* \* \*\"\]/);
  const worker = await readFile(new URL("../cron/index.js", import.meta.url), "utf8");
  assert.match(worker, /rotatePasswordIfDue/);
});

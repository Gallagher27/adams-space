import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";

test("emits the files required by Cloudflare Pages packaging", async () => {
  await access(new URL("../dist/index.html", import.meta.url));
  await access(new URL("../dist/_headers", import.meta.url));
  await access(new URL("../functions/api/[[path]].js", import.meta.url));
  await access(new URL("../functions/assets/photos/[[path]].js", import.meta.url));
});

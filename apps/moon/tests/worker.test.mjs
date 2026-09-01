import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import worker from "../worker/index.js";

class D1Statement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.parameters = [];
  }

  bind(...parameters) {
    this.parameters = parameters;
    return this;
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.parameters) ?? null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.parameters) };
  }

  async run() {
    return this.database.prepare(this.sql).run(...this.parameters);
  }
}

class D1Database {
  constructor() {
    this.database = new DatabaseSync(":memory:");
  }

  prepare(sql) {
    return new D1Statement(this.database, sql);
  }

  async batch(statements) {
    for (const statement of statements) await statement.run();
  }
}

function env(db) {
  return {
    DB: db,
    MOON_INITIAL_PASSWORD: "moon0825",
    MOON_ADMIN_PASSWORD: "admin-test-secret",
    MOON_ENCRYPTION_KEY: "encryption-test-secret",
    MOON_SESSION_SECRET: "session-test-secret",
  };
}

async function request(path, options = {}) {
  return worker.fetch(new Request(`https://moon.test${path}`, options), options.env);
}

function cookieFrom(response) {
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "login should issue a session cookie");
  return cookie.split(";", 1)[0];
}

test("separates viewer and administrator sessions", async () => {
  const db = new D1Database();
  const runtime = env(db);
  const viewerLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "moon0825" }) });
  assert.equal(viewerLogin.status, 200);
  const viewerCookie = cookieFrom(viewerLogin);

  const viewerAdminAttempt = await request("/api/admin/current-password", { env: runtime, headers: { cookie: viewerCookie } });
  assert.equal(viewerAdminAttempt.status, 403);

  const adminLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-secret", role: "admin" }) });
  assert.equal(adminLogin.status, 200);
  const adminCookie = cookieFrom(adminLogin);
  const currentPassword = await request("/api/admin/current-password", { env: runtime, headers: { cookie: adminCookie } });
  assert.equal(currentPassword.status, 200);
  assert.equal((await currentPassword.json()).password, "moon0825");
});

test("monthly rotation revokes old viewer sessions", async () => {
  const db = new D1Database();
  const runtime = env(db);
  const viewerLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "moon0825" }) });
  const viewerCookie = cookieFrom(viewerLogin);
  const adminLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-secret", role: "admin" }) });
  const adminCookie = cookieFrom(adminLogin);

  const { rotatePasswordIfDue } = await import("../worker/index.js");
  const rotation = await rotatePasswordIfDue(db, runtime, Date.parse("2026-10-01T00:05:00Z"));
  assert.equal(rotation.rotated, true);

  const oldSession = await request("/api/session", { env: runtime, headers: { cookie: viewerCookie } });
  assert.equal(oldSession.status, 401);
  const adminState = await request("/api/admin/current-password", { env: runtime, headers: { cookie: adminCookie } });
  assert.equal(adminState.status, 200);
  const rotated = await adminState.json();
  assert.notEqual(rotated.password, "moon0825");
  assert.equal(rotated.password.length, 16);
});

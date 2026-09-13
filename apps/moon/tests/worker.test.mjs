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

test("synchronizes a rotated administrator secret from the runtime", async () => {
  const db = new D1Database();
  const runtime = env(db);
  const firstLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-secret", role: "admin" }) });
  assert.equal(firstLogin.status, 200);

  runtime.MOON_ADMIN_PASSWORD = "xUBv6a";
  const oldLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-secret", role: "admin" }) });
  assert.equal(oldLogin.status, 401);
  const newLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "xUBv6a", role: "admin" }) });
  assert.equal(newLogin.status, 200);
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

test("lets a blessing owner revoke only their own entry and lets admin clear all", async () => {
  const db = new D1Database();
  const runtime = env(db);
  const viewerLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "moon0825" }) });
  const viewerCookie = cookieFrom(viewerLogin);
  const ownerToken = "owner-token-one";
  const first = await request("/api/blessings", { env: runtime, method: "POST", headers: { cookie: viewerCookie, "content-type": "application/json" }, body: JSON.stringify({ id: "blessing-one", name: "外婆", message: "慢慢长大", ownerToken }) });
  assert.equal(first.status, 200);
  const wrongOwner = await request("/api/blessings/blessing-one", { env: runtime, method: "DELETE", headers: { cookie: viewerCookie, "x-moon-owner-token": "wrong-token" } });
  assert.equal(wrongOwner.status, 403);
  const ownerDelete = await request("/api/blessings/blessing-one", { env: runtime, method: "DELETE", headers: { cookie: viewerCookie, "x-moon-owner-token": ownerToken } });
  assert.equal(ownerDelete.status, 200);

  for (const [id, name] of [["blessing-two", "爷爷"], ["blessing-three", "妈妈"]]) {
    const response = await request("/api/blessings", { env: runtime, method: "POST", headers: { cookie: viewerCookie, "content-type": "application/json" }, body: JSON.stringify({ id, name, message: "一直都在", ownerToken: `${id}-owner` }) });
    assert.equal(response.status, 200);
  }
  const adminLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-secret", role: "admin" }) });
  const adminCookie = cookieFrom(adminLogin);
  const clear = await request("/api/admin/blessings", { env: runtime, method: "DELETE", headers: { cookie: adminCookie } });
  assert.equal(clear.status, 200);
  assert.equal((await clear.json()).count, 2);
  const state = await request("/api/state", { env: runtime, headers: { cookie: viewerCookie } });
  assert.deepEqual((await state.json()).blessings, []);
});

test("records a public visit and exposes it only to administrators", async () => {
  const db = new D1Database();
  const runtime = env(db);
  const visitId = "visit-test-001";
  const start = await request("/api/visits/start", { env: runtime, method: "POST", headers: { "content-type": "application/json", "CF-Connecting-IP": "203.0.113.24", "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" }, body: JSON.stringify({ visitId, path: "/", language: "zh-CN" }) });
  assert.equal(start.status, 200);
  const heartbeat = await request("/api/visits/heartbeat", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId, active: true }) });
  assert.equal(heartbeat.status, 200);
  const end = await request("/api/visits/end", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitId, active: true }) });
  assert.equal(end.status, 200);

  const viewerLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "moon0825" }) });
  const viewerCookie = cookieFrom(viewerLogin);
  const viewerAttempt = await request("/api/admin/access-visits", { env: runtime, headers: { cookie: viewerCookie } });
  assert.equal(viewerAttempt.status, 403);

  const adminLogin = await request("/api/auth/login", { env: runtime, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-secret", role: "admin" }) });
  const adminCookie = cookieFrom(adminLogin);
  const log = await request("/api/admin/access-visits", { env: runtime, headers: { cookie: adminCookie } });
  assert.equal(log.status, 200);
  const visits = (await log.json()).visits;
  assert.equal(visits.length, 1);
  assert.equal(visits[0].ipAddress, "203.0.113.24");
  assert.equal(visits[0].deviceType, "mobile");
  assert.equal(visits[0].browser, "Safari");
  assert.equal(visits[0].status, "ended");
});

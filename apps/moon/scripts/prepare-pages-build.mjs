#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "index.html");
const functions = path.join(root, "functions");

if (!existsSync(index)) throw new Error("Missing Cloudflare Pages build input: dist/index.html");
if (!existsSync(functions)) throw new Error("Missing Cloudflare Pages Functions directory: functions");

const headersPath = path.join(dist, "_headers");
if (!existsSync(headersPath)) {
  writeFileSync(headersPath, `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: microphone=(self), camera=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
`);
}

console.log("Prepared Cloudflare Pages build: dist/ with Pages Functions.");

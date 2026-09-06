import crypto from "crypto";
import type { Me } from "./types";

export const SESSION_COOKIE = "rov_session";
const SESSION_DAYS = 30;

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function sessionExpirySQL(): string {
  return `datetime('now', '+${SESSION_DAYS} days')`;
}

export function sessionMaxAgeSec(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

export type SessionUser = Me;

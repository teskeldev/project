/**
 * Server-side ephemeral state store for in-flight OAuth sessions.
 *
 * Uses module-level Maps bound to `globalThis` so Next.js dev hot-reload
 * doesn't wipe state mid-flow. In multi-instance production deployments,
 * replace with Redis (ioredis is already in the stack via BullMQ).
 *
 * TTL: 10 minutes — enough for the user to complete the OAuth flow.
 * SERVER-ONLY: never import this from a client component.
 */

const TTL_MS = 10 * 60_000;

/* -------------------------------------------------------------------------- */
/* PKCE state (authorization_code_pkce flows)                                 */
/* -------------------------------------------------------------------------- */

export type PkceState = {
  codeVerifier: string;
  redirectUri: string;
  userId: string;
  workspaceId: string;
  provider: string;
  expiresAt: number;
};

declare global {
  var __oauthPkce: Map<string, PkceState> | undefined;
}

const pkceMap: Map<string, PkceState> = (globalThis.__oauthPkce ??= new Map());

export function setPkceState(
  state: string,
  data: Omit<PkceState, "expiresAt">
): void {
  purgePkce();
  pkceMap.set(state, { ...data, expiresAt: Date.now() + TTL_MS });
}

export function getPkceState(state: string): PkceState | undefined {
  const entry = pkceMap.get(state);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    pkceMap.delete(state);
    return undefined;
  }
  return entry;
}

export function deletePkceState(state: string): void {
  pkceMap.delete(state);
}

function purgePkce(): void {
  const now = Date.now();
  for (const [k, v] of pkceMap) {
    if (v.expiresAt < now) pkceMap.delete(k);
  }
}

/* -------------------------------------------------------------------------- */
/* Device code state                                                           */
/* -------------------------------------------------------------------------- */

export type DeviceState = {
  deviceCode: string;
  userId: string;
  workspaceId: string;
  provider: string;
  interval: number;
  expiresAt: number;
};

declare global {
  var __oauthDevice: Map<string, DeviceState> | undefined;
}

const deviceMap: Map<string, DeviceState> = (globalThis.__oauthDevice ??=
  new Map());

export function setDeviceState(
  key: string,
  data: Omit<DeviceState, "expiresAt">,
  ttlMs = TTL_MS
): void {
  purgeDevice();
  deviceMap.set(key, { ...data, expiresAt: Date.now() + ttlMs });
}

export function getDeviceState(key: string): DeviceState | undefined {
  const entry = deviceMap.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    deviceMap.delete(key);
    return undefined;
  }
  return entry;
}

export function deleteDeviceState(key: string): void {
  deviceMap.delete(key);
}

function purgeDevice(): void {
  const now = Date.now();
  for (const [k, v] of deviceMap) {
    if (v.expiresAt < now) deviceMap.delete(k);
  }
}

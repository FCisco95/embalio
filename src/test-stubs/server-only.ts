// No-op stand-in for the `server-only` package.
//
// `server-only` deliberately throws when it is resolved outside a React Server
// Component. Vitest runs in plain Node with no RSC condition, so importing a
// module that guards itself with it (e.g. src/server/auth.ts) would fail the
// suite. The guard is a build-time protection against server code reaching a
// client bundle, which `next build` still enforces — nothing is weakened here.
export {};

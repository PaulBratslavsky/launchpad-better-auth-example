# How the three plugins fit together

`users-permissions` did three jobs at once:

1. **Authentication** — sign-up, sign-in, password reset, JWT issuance
2. **User content type** — exposed `plugin::users-permissions.user`
3. **Authorization** — Public + Authenticated roles, per-content-type permissions

The Better Auth stack splits those concerns into three plugins:

| Plugin | Owns |
| --- | --- |
| `plugin-better-auth` | Auth flows, sessions, the `ba_user` table, the Better Auth endpoints under `/api/auth/*` |
| `plugin-api-permissions` | Public/Authenticated roles, per-content-type permission engine, the **Settings → API Permissions** admin UI |
| `plugin-better-auth-dashboard` | Admin tab showing user list, growth charts, session management, ban/revoke flows |

They share state via a session resolver. When `plugin-api-permissions` runs its content-API authorization check, it calls back into `plugin-better-auth` to resolve "who is the requester?" before deciding "what are they allowed to do?". You can swap `plugin-better-auth` out for a different auth provider later without touching `plugin-api-permissions` — it's auth-agnostic.

## What replaces what

| `users-permissions` | Better Auth equivalent |
| --- | --- |
| `POST /api/auth/local/register` | `POST /api/auth/sign-up/email` |
| `POST /api/auth/local` | `POST /api/auth/sign-in/email` |
| `POST /api/auth/local/forgot-password` | `POST /api/auth/forget-password` |
| `GET /api/users/me` | `GET /api/auth/get-session` (returns user nested under `session.user`) |
| `plugin::users-permissions.user` content type | `plugin::better-auth.user` (table `ba_user`) |
| Settings → Users & Permissions → Roles | Settings → API Permissions → Roles |
| Content Manager → User (basic CRUD) | Better Auth dashboard tab (search, metrics, sessions, ban) |
| Frontend: hand-rolled `fetch` | `better-auth/react` (`useSession`, `signIn`, `signUp`, `signOut`) |

## Why the order in the skill matters

The bootstrap that seeds Public-role permissions calls `findMany` on `plugin::api-permissions.role`. That triggers a Strapi document-service middleware which calls `addUserCount` inside `plugin-api-permissions`. `addUserCount` needs the Better Auth `user` content type to exist. If you run the bootstrap before `better-auth generate` has created `src/extensions/better-auth/content-types/user/schema.json`, you crash with:

```
TypeError: Cannot read properties of undefined (reading 'attributes')
  at addUserCount (.../plugin-api-permissions/dist/server/index.js:185)
```

The template `strapi-src-index.ts` has a defensive guard at the top that no-ops on the first run (when the user content type is missing) and seeds permissions on subsequent runs. The skill relies on this guard, so the order is:

1. Write templates
2. Run `better-auth generate` (bootstrap silently no-ops)
3. Boot Strapi once (bootstrap seeds permissions)

## Tables created

Better Auth's schema generator writes content types into `<strapi>/src/extensions/better-auth/content-types/`:

| Folder | Table | Purpose |
| --- | --- | --- |
| `user/` | `ba_user` | Account records |
| `session/` | `ba_session` | Active sessions |
| `account/` | `ba_account` | OAuth provider linkage |
| `verification/` | `ba_verification` | Email/phone verification tokens |
| `jwks/` | `ba_jwks` | JWT signing keys (added by the `jwt()` plugin, required by the dashboard) |

`plugin-api-permissions` adds its own tables:

| Table | Purpose |
| --- | --- |
| `api_permissions_roles` | Role records (seeds Public + Authenticated on first boot) |
| `api_permissions_permissions` | Per-role permission entries (action: e.g. `api::article.article.find`) |

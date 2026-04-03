# AppBikeConfig

Next.js 14 App Router + Neon Postgres app for Matrix, Order, Setup, Bike SKU Definition, and Bike Builder with mandatory login + role-based access control (RBAC).

## Stack

- Next.js App Router
- Route Handlers under `app/api`
- Neon Postgres
- Auth.js (next-auth) credentials provider
- bcryptjs password hashing
- Hosted on Vercel

## SQL files to run

Run in this order:

1. `sql/schema.sql`
2. `sql/seed.sql` (optional baseline business data)
3. `sql/002_auth_rbac.sql` (required for auth + RBAC + audit)

## Environment variables

Required:

- `DATABASE_URL` (server-side only)
- `AUTH_SECRET` (Auth.js signing secret)

Example `.env.local`:

```bash
DATABASE_URL="postgres://..."
AUTH_SECRET="replace-with-long-random-secret"
```

> Do not expose these values in client code. Do not use `NEXT_PUBLIC_` for secrets.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` and `AUTH_SECRET`.
3. Run SQL files listed above in Neon.
4. Install dependencies.
5. Start local server.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`.

## Bootstrap first sys_admin user

The app expects users in `app_users` with bcrypt password hashes.

Generate a hash locally:

```bash
node -e "console.log(require('bcryptjs').hashSync('ChangeMe123!', 12))"
```

Then insert user + role in Neon SQL:

```sql
insert into app_users (email, password_hash)
values ('admin@example.com', '<PASTE_BCRYPT_HASH>')
on conflict (email) do nothing;

insert into user_roles (user_id, role_id)
select u.id, r.id
from app_users u
join roles r on r.role_key = 'sys_admin'
where u.email = 'admin@example.com'
on conflict do nothing;
```

## Auth/RBAC overview

Mandatory login for all app pages except `/login`.

Roles:
- `sys_admin`
- `sales_admin`
- `sales_standard`
- `product_admin`
- `read_only`

Server-side authorization is enforced in API handlers. UI buttons are disabled where access is missing, but the API checks are source of truth.

## Restricted APIs

- `POST /api/countries` -> `sys_admin`, `sales_admin`
- `POST /api/matrix` -> `sys_admin`, `sales_admin`, `sales_standard`
- `POST /api/matrix/bulk-update` -> `sys_admin`, `sales_admin`
- `POST/DELETE /api/setup-options` -> `sys_admin`, `product_admin`
- `POST /api/sku-rules` -> `sys_admin`, `product_admin`
- `POST /api/builder-push` -> `sys_admin`, `product_admin`
- `/api/users*` -> `sys_admin`

## Audit log coverage

Writes to `audit_log` for:
- matrix single updates
- matrix bulk updates
- add country
- setup option changes
- SKU rule changes
- builder push
- user creation
- role assignment
- user deactivation/reactivation

## Vercel deployment steps

1. Push repo to GitHub.
2. Import project in Vercel.
3. Add environment variables in Vercel Project Settings:
   - `DATABASE_URL`
   - `AUTH_SECRET`
4. Run SQL migrations in Neon (including `sql/002_auth_rbac.sql`).
5. Deploy.
6. Validate login and role-protected APIs in production.

## Exact commands to test locally

```bash
npm run build
npm run dev
```

Then manually test:
1. Login at `/login`.
2. Verify unauthorized users are redirected to `/login`.
3. Verify role-based buttons/actions:
   - Matrix save
   - Matrix bulk update
   - Add country
   - Setup add/delete
   - SKU rule add
   - Builder push
   - Users page
4. Verify forbidden API calls return 403 for missing roles.

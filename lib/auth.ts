import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { can, getDefaultPermissionsForRoles, type ActionKey } from '@/lib/rbac';

export type AppUser = {
  id: number;
  email: string;
  is_active: boolean;
};

export const authOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' as const },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');
        if (!email || !password) return null;

        const rows = await sql`
          select id, email, password_hash, is_active
          from app_users
          where lower(email) = ${email}
          limit 1
        ` as any[];

        if (!rows.length) return null;
        const user = rows[0];
        if (!user.is_active) return null;

        const ok = await bcrypt.compare(password, String(user.password_hash || ''));
        if (!ok) return null;

        return { id: String(user.id), email: user.email };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.userId = Number(user.id);
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as any).id = Number(token.userId);
      }
      return session;
    }
  }
};

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getCurrentSession();
  const email = session?.user?.email;
  if (!email) return null;

  const rows = await sql`
    select id, email, is_active
    from app_users
    where lower(email) = ${email.toLowerCase()}
    limit 1
  ` as any[];

  if (!rows.length) return null;
  return rows[0] as AppUser;
}

export async function getCurrentUserRoles() {
  const user = await getCurrentUser();
  if (!user) return [] as string[];
  const roles = await sql`
    select r.role_key
    from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = ${user.id}
    order by r.role_key
  ` as any[];
  return roles.map((r) => String(r.role_key));
}

export async function getPermissionsForUser(userId: number, roles: string[]) {
  const fallback = new Set(getDefaultPermissionsForRoles(roles));
  const rows = await sql`
    with role_perms as (
      select p.permission_key
      from user_roles ur
      join roles r on r.id = ur.role_id
      join role_permissions rp on rp.role_key = r.role_key
      join permissions p on p.id = rp.permission_id
      where ur.user_id = ${userId}
    ),
    role_granted as (
      select permission_key, true as granted from role_perms
    ),
    user_overrides as (
      select p.permission_key, up.granted
      from user_permissions up
      join permissions p on p.id = up.permission_id
      where up.user_id = ${userId}
    )
    select permission_key, granted
    from (
      select * from role_granted
      union all
      select * from user_overrides
    ) x
  ` as Array<{ permission_key: string; granted: boolean }>;

  if (!rows.length) return Array.from(fallback);

  const merged = new Map<string, boolean>();
  rows.forEach((row) => merged.set(String(row.permission_key), Boolean(row.granted)));

  fallback.forEach((permission) => {
    if (!merged.has(permission)) merged.set(permission, true);
  });

  return Array.from(merged.entries())
    .filter(([, granted]) => granted)
    .map(([permission]) => permission);
}

export async function requireLogin() {
  const user = await getCurrentUser();
  if (!user || !user.is_active) {
    throw new Error('UNAUTHORIZED');
  }
  const roles = await getCurrentUserRoles();
  const permissions = await getPermissionsForUser(user.id, roles);
  return { user, roles, permissions };
}

export async function requireRole(actionKey: ActionKey) {
  const { user, roles, permissions } = await requireLogin();
  if (!can(permissions, actionKey)) {
    throw new Error('FORBIDDEN');
  }
  return { user, roles, permissions };
}

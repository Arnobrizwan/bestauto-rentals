import { count, eq, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { adminUsers, type AdminUser } from "@/server/db/schema";

/** How many admin accounts exist. Gates the one-time setup flow. */
export async function countAdmins() {
  const [row] = await db.select({ n: count() }).from(adminUsers);
  return row?.n ?? 0;
}

export async function createAdmin(input: { email: string; name: string; passwordHash: string }) {
  const [row] = await db
    .insert(adminUsers)
    .values({
      id: `adm_${crypto.randomUUID().slice(0, 12)}`,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      role: "admin",
    })
    .returning();
  return row;
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(sql`lower(${adminUsers.email})`, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function findAdminById(id: string): Promise<AdminUser | null> {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row ?? null;
}

export async function touchLastLogin(id: string) {
  await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
}

export async function upsertAdmin(input: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role?: string;
}) {
  const [row] = await db
    .insert(adminUsers)
    .values({ ...input, role: input.role ?? "admin" })
    .onConflictDoUpdate({
      target: adminUsers.email,
      set: { name: input.name, passwordHash: input.passwordHash, role: input.role ?? "admin", active: true },
    })
    .returning();
  return row;
}

/** Every staff account, for the team board. Never selects the password hash. */
export async function listAdmins() {
  return db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      name: adminUsers.name,
      role: adminUsers.role,
      active: adminUsers.active,
      lastLoginAt: adminUsers.lastLoginAt,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(sql`${adminUsers.createdAt} asc`);
}

/**
 * Creates a further staff account on behalf of an existing admin.
 *
 * Distinct from `createAdmin`, which is the one-time setup path and always
 * mints an admin: this one carries a role, so an invited colleague can be a
 * viewer who cannot mutate anything.
 */
export async function createTeamMember(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "viewer";
}) {
  const [row] = await db
    .insert(adminUsers)
    .values({
      id: `adm_${crypto.randomUUID().slice(0, 12)}`,
      email: input.email.trim().toLowerCase(),
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role,
    })
    .returning({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role });
  return row;
}

/** Deactivating removes access on the next page view, without deleting history. */
export async function setAdminActive(id: string, active: boolean) {
  const [row] = await db
    .update(adminUsers)
    .set({ active })
    .where(eq(adminUsers.id, id))
    .returning({ id: adminUsers.id, active: adminUsers.active });
  return row ?? null;
}

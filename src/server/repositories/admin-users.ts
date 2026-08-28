import { eq, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { adminUsers, type AdminUser } from "@/server/db/schema";

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

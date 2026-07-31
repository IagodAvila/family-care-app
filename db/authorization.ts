import { and, eq } from "drizzle-orm";
import type { AuthorizedFamilyContext } from "./domain.ts";
import { FamilyCareDataError } from "./errors.ts";
import type { FamilyCareDatabase } from "./index.ts";
import {
  families,
  familyMembers,
  users,
  type FamilyRole,
} from "./schema.ts";

const ROLE_LEVEL: Record<FamilyRole, number> = {
  viewer: 0,
  caregiver: 1,
  admin: 2,
};

export async function requireFamilyRole(
  db: FamilyCareDatabase,
  context: AuthorizedFamilyContext,
  minimumRole: FamilyRole,
): Promise<FamilyRole> {
  const membership = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .innerJoin(
      families,
      and(
        eq(families.id, familyMembers.familyId),
        eq(families.status, "active"),
      ),
    )
    .innerJoin(
      users,
      and(eq(users.id, familyMembers.userId), eq(users.status, "active")),
    )
    .where(
      and(
        eq(familyMembers.familyId, context.familyId),
        eq(familyMembers.userId, context.userId),
        eq(familyMembers.status, "active"),
      ),
    )
    .get();

  if (!membership) {
    // The same error is returned for an absent family and an unauthorized ID.
    throw new FamilyCareDataError("NOT_FOUND");
  }

  if (ROLE_LEVEL[membership.role] < ROLE_LEVEL[minimumRole]) {
    throw new FamilyCareDataError("FORBIDDEN");
  }

  return membership.role;
}

import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";
import { requireFamilyRole } from "../authorization.ts";
import type {
  AddFamilyMemberInput,
  AuthenticatedUserContext,
  AuthorizedFamilyContext,
  CreateFamilyInput,
  CreateInvitationInput,
  LogDoseInput,
  MedicationInput,
  MedicationScheduleInput,
  PushSubscriptionInput,
  RelativeInput,
  UpdateMedicationInput,
  UpdateMedicationScheduleInput,
  UpdateRelativeInput,
} from "../domain.ts";
import { FamilyCareDataError, safely } from "../errors.ts";
import type { FamilyCareDatabase } from "../index.ts";
import {
  auditEvents,
  families,
  familyMembers,
  invitations,
  medicationDoses,
  medications,
  medicationSchedules,
  pushSubscriptions,
  relatives,
  users,
  type FamilyRole,
  type InvitationRow,
  type MedicationRow,
  type MedicationScheduleRow,
  type RelativeRow,
} from "../schema.ts";
import { currentOccurrenceDate, currentWeekday, scheduledInstant } from "../time.ts";
import { generateToken, hashToken } from "../token.ts";
import {
  validateEmail,
  validateExpectedVersion,
  validateFamilyName,
  validateMedicationInput,
  validateOccurrenceDate,
  validatePushSubscriptionInput,
  validateRelativeInput,
  validateRole,
  validateScheduleInput,
} from "../validation.ts";

/** Invitation links expire after 7 days (docs/architecture.md leaves the exact value to product judgment). */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ServiceOptions = {
  createId?: () => string;
  now?: () => number;
};

export type RelativeWithMedications = RelativeRow & {
  medications: MedicationRow[];
};

export class FamilyCareDataService {
  private readonly db: FamilyCareDatabase;
  private readonly createId: () => string;
  private readonly now: () => number;

  constructor(db: FamilyCareDatabase, options: ServiceOptions = {}) {
    this.db = db;
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => Date.now());
  }

  async listFamilies(context: AuthenticatedUserContext) {
    return safely(async () => {
      this.validateAuthenticatedContext(context);

      return this.db
        .select({
          family: families,
          role: familyMembers.role,
        })
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
            eq(familyMembers.userId, context.userId),
            eq(familyMembers.status, "active"),
          ),
        )
        .orderBy(asc(families.createdAt))
        .all();
    });
  }

  async createFamily(
    context: AuthenticatedUserContext,
    input: CreateFamilyInput,
  ) {
    return safely(async () => {
      this.validateAuthenticatedContext(context);
      const name = validateFamilyName(input.name);
      const actor = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, context.userId), eq(users.status, "active")))
        .get();

      if (!actor) {
        throw new FamilyCareDataError("NOT_FOUND");
      }

      const familyId = this.createId();
      const now = this.now();

      await this.db.batch([
        this.db.insert(families).values({
          id: familyId,
          name,
          createdByUserId: context.userId,
          createdAt: now,
          updatedAt: now,
        }),
        this.db.insert(familyMembers).values({
          familyId,
          userId: context.userId,
          role: "admin",
          status: "active",
          joinedAt: now,
          createdAt: now,
          updatedAt: now,
        }),
        this.auditQuery({
          context: { ...context, familyId },
          action: "family.created",
          targetType: "family",
          targetId: familyId,
          now,
        }),
      ]);

      return this.requireFamily({ ...context, familyId });
    });
  }

  async getFamily(context: AuthorizedFamilyContext) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      return this.requireFamily(context);
    });
  }

  async renameFamily(
    context: AuthorizedFamilyContext,
    nameInput: string,
    expectedVersion: number,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      const name = validateFamilyName(nameInput);
      const version = validateExpectedVersion(expectedVersion);
      const current = await this.requireFamily(context);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(families)
          .set({
            name,
            updatedAt: now,
            version: sql`${families.version} + 1`,
          })
          .where(
            and(
              eq(families.id, context.familyId),
              eq(families.status, "active"),
              eq(families.version, version),
            ),
          ),
        this.auditQuery({
          context,
          action: "family.updated",
          targetType: "family",
          targetId: context.familyId,
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireFamily(context);
    });
  }

  async listMembers(context: AuthorizedFamilyContext) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      return this.db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.familyId, context.familyId))
        .orderBy(asc(familyMembers.createdAt))
        .all();
    });
  }

  async listMembersWithUsers(context: AuthorizedFamilyContext) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      return this.db
        .select({
          userId: familyMembers.userId,
          role: familyMembers.role,
          status: familyMembers.status,
          joinedAt: familyMembers.joinedAt,
          revokedAt: familyMembers.revokedAt,
          emailNormalized: users.emailNormalized,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(familyMembers)
        .innerJoin(users, eq(users.id, familyMembers.userId))
        .where(eq(familyMembers.familyId, context.familyId))
        .orderBy(asc(familyMembers.createdAt))
        .all();
    });
  }

  async addMember(
    context: AuthorizedFamilyContext,
    input: AddFamilyMemberInput,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      this.validateIdentifier(input.userId);
      const role = validateRole(input.role);
      if (role === "admin") {
        throw new FamilyCareDataError("INVALID_INPUT");
      }
      const now = this.now();
      const targetUser = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.status, "active")))
        .get();

      if (!targetUser) {
        throw new FamilyCareDataError("NOT_FOUND");
      }

      const existing = await this.db
        .select({ status: familyMembers.status })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, context.familyId),
            eq(familyMembers.userId, input.userId),
          ),
        )
        .get();

      if (existing?.status === "active") {
        throw new FamilyCareDataError("CONFLICT");
      }

      await this.db.batch([
        this.db
          .insert(familyMembers)
          .values({
            familyId: context.familyId,
            userId: input.userId,
            role,
            status: "active",
            invitedByUserId: context.userId,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [familyMembers.familyId, familyMembers.userId],
            set: {
              role,
              status: "active",
              invitedByUserId: context.userId,
              joinedAt: now,
              updatedAt: now,
              revokedAt: null,
              revokedByUserId: null,
            },
          }),
        this.auditQuery({
          context,
          action: "member.added",
          targetType: "user",
          targetId: input.userId,
          metadata: { role },
          now,
        }),
      ]);

      return this.requireMember(context.familyId, input.userId);
    });
  }

  async changeMemberRole(
    context: AuthorizedFamilyContext,
    targetUserId: string,
    roleInput: FamilyRole,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      this.validateIdentifier(targetUserId);
      const role = validateRole(roleInput);
      const target = await this.requireMember(context.familyId, targetUserId);
      const now = this.now();

      if (target.status !== "active") {
        throw new FamilyCareDataError("NOT_FOUND");
      }

      if (target.role === "admin" && role !== "admin") {
        await this.requireAnotherAdmin(context.familyId);
      }

      const [result] = await this.db.batch([
        this.db
          .update(familyMembers)
          .set({ role, updatedAt: now })
          .where(
            and(
              eq(familyMembers.familyId, context.familyId),
              eq(familyMembers.userId, targetUserId),
              eq(familyMembers.status, "active"),
              target.role === "admin" && role !== "admin"
                ? sql`(
                    select count(*)
                    from family_members as active_admins
                    where active_admins.family_id = ${context.familyId}
                      and active_admins.role = 'admin'
                      and active_admins.status = 'active'
                  ) > 1`
                : undefined,
            ),
          ),
        this.auditQuery({
          context,
          action: "member.role_changed",
          targetType: "user",
          targetId: targetUserId,
          metadata: { role },
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireMember(context.familyId, targetUserId);
    });
  }

  async revokeMember(
    context: AuthorizedFamilyContext,
    targetUserId: string,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      this.validateIdentifier(targetUserId);
      const target = await this.requireMember(context.familyId, targetUserId);
      const now = this.now();

      if (target.status !== "active") {
        throw new FamilyCareDataError("NOT_FOUND");
      }

      if (target.role === "admin") {
        await this.requireAnotherAdmin(context.familyId);
      }

      const [result] = await this.db.batch([
        this.db
          .update(familyMembers)
          .set({
            status: "revoked",
            revokedAt: now,
            revokedByUserId: context.userId,
            updatedAt: now,
          })
          .where(
            and(
              eq(familyMembers.familyId, context.familyId),
              eq(familyMembers.userId, targetUserId),
              eq(familyMembers.status, "active"),
              target.role === "admin"
                ? sql`(
                    select count(*)
                    from family_members as active_admins
                    where active_admins.family_id = ${context.familyId}
                      and active_admins.role = 'admin'
                      and active_admins.status = 'active'
                  ) > 1`
                : undefined,
            ),
          ),
        this.auditQuery({
          context,
          action: "member.revoked",
          targetType: "user",
          targetId: targetUserId,
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireMember(context.familyId, targetUserId);
    });
  }

  async listInvitations(context: AuthorizedFamilyContext) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      return this.db
        .select()
        .from(invitations)
        .where(eq(invitations.familyId, context.familyId))
        .orderBy(asc(invitations.createdAt))
        .all();
    });
  }

  /** Returns the plaintext `token` too — the only time it's ever available; only its hash is stored. */
  async createInvitation(
    context: AuthorizedFamilyContext,
    input: CreateInvitationInput,
  ): Promise<{ invitation: InvitationRow; token: string }> {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      const emailNormalized = validateEmail(input.emailNormalized);
      const role = validateRole(input.role);
      if (role === "admin") {
        throw new FamilyCareDataError("INVALID_INPUT");
      }

      const existingPending = await this.db
        .select({ id: invitations.id })
        .from(invitations)
        .where(
          and(
            eq(invitations.familyId, context.familyId),
            eq(invitations.emailNormalized, emailNormalized),
            eq(invitations.status, "pending"),
          ),
        )
        .get();
      if (existingPending) {
        throw new FamilyCareDataError("CONFLICT");
      }

      const invitationId = this.createId();
      const token = generateToken();
      const tokenHash = await hashToken(token);
      const now = this.now();

      await this.db.batch([
        this.db.insert(invitations).values({
          id: invitationId,
          familyId: context.familyId,
          emailNormalized,
          role,
          tokenHash,
          status: "pending",
          invitedByUserId: context.userId,
          expiresAt: now + INVITATION_TTL_MS,
          createdAt: now,
          updatedAt: now,
        }),
        this.auditQuery({
          context,
          action: "invitation.created",
          targetType: "invitation",
          targetId: invitationId,
          metadata: { role },
          now,
        }),
      ]);

      return { invitation: await this.requireInvitation(invitationId), token };
    });
  }

  async revokeInvitation(context: AuthorizedFamilyContext, invitationId: string) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "admin");
      this.validateIdentifier(invitationId);
      const current = await this.requireInvitation(invitationId, context.familyId);
      if (current.status !== "pending") {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(invitations)
          .set({ status: "revoked", revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(invitations.id, invitationId),
              eq(invitations.familyId, context.familyId),
              eq(invitations.status, "pending"),
            ),
          ),
        this.auditQuery({
          context,
          action: "invitation.revoked",
          targetType: "invitation",
          targetId: invitationId,
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireInvitation(invitationId, context.familyId);
    });
  }

  /**
   * Accepts an invitation by its plaintext token. Unlike every other
   * method here, the caller isn't a family member yet — there's no
   * `familyId` to authorize against until the invitation itself resolves
   * one, so this takes a plain `AuthenticatedUserContext`.
   */
  async acceptInvitation(context: AuthenticatedUserContext, token: string) {
    return safely(async () => {
      this.validateAuthenticatedContext(context);
      if (!token || token.length > 512) {
        throw new FamilyCareDataError("INVALID_INPUT");
      }
      const tokenHash = await hashToken(token);
      const now = this.now();

      const invitation = await this.db
        .select()
        .from(invitations)
        .where(and(eq(invitations.tokenHash, tokenHash), eq(invitations.status, "pending")))
        .get();
      // Same "not found" for missing/expired: don't let an expired token's
      // existence be observably different from a bogus one.
      if (!invitation || invitation.expiresAt <= now) {
        throw new FamilyCareDataError("NOT_FOUND");
      }

      const actor = await this.db
        .select({ id: users.id, emailNormalized: users.emailNormalized })
        .from(users)
        .where(and(eq(users.id, context.userId), eq(users.status, "active")))
        .get();
      if (!actor) {
        throw new FamilyCareDataError("NOT_FOUND");
      }
      // Invitations are addressed to an identity, not just an inbox: only
      // the invited email may accept, per docs/architecture.md.
      if (actor.emailNormalized !== invitation.emailNormalized) {
        throw new FamilyCareDataError("FORBIDDEN");
      }

      const familyContext: AuthorizedFamilyContext = { ...context, familyId: invitation.familyId };

      await this.db.batch([
        this.db
          .insert(familyMembers)
          .values({
            familyId: invitation.familyId,
            userId: context.userId,
            role: invitation.role,
            status: "active",
            invitedByUserId: invitation.invitedByUserId,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [familyMembers.familyId, familyMembers.userId],
            set: {
              role: invitation.role,
              status: "active",
              invitedByUserId: invitation.invitedByUserId,
              joinedAt: now,
              updatedAt: now,
              revokedAt: null,
              revokedByUserId: null,
            },
          }),
        this.db
          .update(invitations)
          .set({ status: "accepted", acceptedByUserId: context.userId, acceptedAt: now, updatedAt: now })
          .where(eq(invitations.id, invitation.id)),
        this.auditQuery({
          context: familyContext,
          action: "invitation.accepted",
          targetType: "invitation",
          targetId: invitation.id,
          now,
        }),
      ]);

      return this.requireFamily(familyContext);
    });
  }

  async listRelatives(context: AuthorizedFamilyContext) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      const familyRelatives = await this.db
        .select()
        .from(relatives)
        .where(
          and(
            eq(relatives.familyId, context.familyId),
            isNull(relatives.deletedAt),
          ),
        )
        .orderBy(asc(relatives.position), asc(relatives.createdAt))
        .all();
      const familyMedications = await this.db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.familyId, context.familyId),
            isNull(medications.deletedAt),
          ),
        )
        .orderBy(asc(medications.position), asc(medications.createdAt))
        .all();

      return familyRelatives.map((relative) => ({
        ...relative,
        medications: familyMedications.filter(
          (medication) => medication.relativeId === relative.id,
        ),
      }));
    });
  }

  async getRelative(
    context: AuthorizedFamilyContext,
    relativeId: string,
  ): Promise<RelativeWithMedications> {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      return this.requireRelativeWithMedications(context, relativeId);
    });
  }

  async createRelative(
    context: AuthorizedFamilyContext,
    input: RelativeInput,
  ): Promise<RelativeWithMedications> {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      const relativeInput = validateRelativeInput(input);
      const medicationInputs = (input.medications ?? []).map(
        validateMedicationInput,
      );
      if (medicationInputs.length > 100) {
        throw new FamilyCareDataError("INVALID_INPUT");
      }

      const relativeId = this.createId();
      const now = this.now();
      const medicationValues = medicationInputs.map((medication) => ({
        id: this.createId(),
        familyId: context.familyId,
        relativeId,
        ...medication,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
        createdAt: now,
        updatedAt: now,
      }));

      const statements = [
        this.db.insert(relatives).values({
          id: relativeId,
          familyId: context.familyId,
          ...relativeInput,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
          createdAt: now,
          updatedAt: now,
        }),
        ...medicationValues.map((medication) =>
          this.db.insert(medications).values(medication)
        ),
        this.auditQuery({
          context,
          action: "relative.created",
          targetType: "relative",
          targetId: relativeId,
          metadata: { medicationCount: medicationValues.length },
          now,
        }),
      ] as const;

      await this.db.batch(statements);
      return this.requireRelativeWithMedications(context, relativeId);
    });
  }

  async updateRelative(
    context: AuthorizedFamilyContext,
    relativeId: string,
    input: UpdateRelativeInput,
  ): Promise<RelativeWithMedications> {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      this.validateIdentifier(relativeId);
      const values = validateRelativeInput(input);
      const version = validateExpectedVersion(input.expectedVersion);
      const current = await this.requireRelative(context, relativeId);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(relatives)
          .set({
            ...values,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${relatives.version} + 1`,
          })
          .where(
            and(
              eq(relatives.familyId, context.familyId),
              eq(relatives.id, relativeId),
              isNull(relatives.deletedAt),
              eq(relatives.version, version),
            ),
          ),
        this.auditQuery({
          context,
          action: "relative.updated",
          targetType: "relative",
          targetId: relativeId,
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireRelativeWithMedications(context, relativeId);
    });
  }

  async deleteRelative(
    context: AuthorizedFamilyContext,
    relativeId: string,
    expectedVersion: number,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      this.validateIdentifier(relativeId);
      const version = validateExpectedVersion(expectedVersion);
      const current = await this.requireRelative(context, relativeId);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [relativeResult] = await this.db.batch([
        this.db
          .update(relatives)
          .set({
            deletedAt: now,
            deletedByUserId: context.userId,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${relatives.version} + 1`,
          })
          .where(
            and(
              eq(relatives.familyId, context.familyId),
              eq(relatives.id, relativeId),
              isNull(relatives.deletedAt),
              eq(relatives.version, version),
            ),
          ),
        this.db
          .update(medications)
          .set({
            deletedAt: now,
            deletedByUserId: context.userId,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${medications.version} + 1`,
          })
          .where(
            and(
              eq(medications.familyId, context.familyId),
              eq(medications.relativeId, relativeId),
              isNull(medications.deletedAt),
              sql`exists (
                select 1
                from relatives
                where relatives.family_id = ${context.familyId}
                  and relatives.id = ${relativeId}
                  and relatives.deleted_at = ${now}
                  and relatives.deleted_by_user_id = ${context.userId}
              )`,
            ),
          ),
        this.auditQuery({
          context,
          action: "relative.deleted",
          targetType: "relative",
          targetId: relativeId,
          now,
        }),
      ]);

      this.requireChange(relativeResult);
    });
  }

  async listMedications(
    context: AuthorizedFamilyContext,
    relativeId: string,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      await this.requireRelative(context, relativeId);
      return this.db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.familyId, context.familyId),
            eq(medications.relativeId, relativeId),
            isNull(medications.deletedAt),
          ),
        )
        .orderBy(asc(medications.position), asc(medications.createdAt))
        .all();
    });
  }

  async getMedication(
    context: AuthorizedFamilyContext,
    medicationId: string,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      return this.requireMedication(context, medicationId);
    });
  }

  async createMedication(
    context: AuthorizedFamilyContext,
    relativeId: string,
    input: MedicationInput,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      await this.requireRelative(context, relativeId);
      const values = validateMedicationInput(input);
      const medicationId = this.createId();
      const now = this.now();

      await this.db.batch([
        this.db.insert(medications).values({
          id: medicationId,
          familyId: context.familyId,
          relativeId,
          ...values,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
          createdAt: now,
          updatedAt: now,
        }),
        this.auditQuery({
          context,
          action: "medication.created",
          targetType: "medication",
          targetId: medicationId,
          now,
        }),
      ]);

      return this.requireMedication(context, medicationId);
    });
  }

  async updateMedication(
    context: AuthorizedFamilyContext,
    medicationId: string,
    input: UpdateMedicationInput,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      this.validateIdentifier(medicationId);
      const values = validateMedicationInput(input);
      const version = validateExpectedVersion(input.expectedVersion);
      const current = await this.requireMedication(context, medicationId);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(medications)
          .set({
            ...values,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${medications.version} + 1`,
          })
          .where(
            and(
              eq(medications.familyId, context.familyId),
              eq(medications.id, medicationId),
              isNull(medications.deletedAt),
              eq(medications.version, version),
            ),
          ),
        this.auditQuery({
          context,
          action: "medication.updated",
          targetType: "medication",
          targetId: medicationId,
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireMedication(context, medicationId);
    });
  }

  async deleteMedication(
    context: AuthorizedFamilyContext,
    medicationId: string,
    expectedVersion: number,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      this.validateIdentifier(medicationId);
      const version = validateExpectedVersion(expectedVersion);
      const current = await this.requireMedication(context, medicationId);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(medications)
          .set({
            deletedAt: now,
            deletedByUserId: context.userId,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${medications.version} + 1`,
          })
          .where(
            and(
              eq(medications.familyId, context.familyId),
              eq(medications.id, medicationId),
              isNull(medications.deletedAt),
              eq(medications.version, version),
            ),
          ),
        this.auditQuery({
          context,
          action: "medication.deleted",
          targetType: "medication",
          targetId: medicationId,
          now,
        }),
      ]);

      this.requireChange(result);
    });
  }

  async listSchedules(context: AuthorizedFamilyContext, medicationId: string) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      await this.requireMedication(context, medicationId);
      return this.db
        .select()
        .from(medicationSchedules)
        .where(
          and(
            eq(medicationSchedules.medicationId, medicationId),
            isNull(medicationSchedules.deletedAt),
          ),
        )
        .orderBy(asc(medicationSchedules.position), asc(medicationSchedules.createdAt))
        .all();
    });
  }

  async getSchedule(context: AuthorizedFamilyContext, scheduleId: string) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      return this.requireSchedule(context, scheduleId);
    });
  }

  async createSchedule(
    context: AuthorizedFamilyContext,
    medicationId: string,
    input: MedicationScheduleInput,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      await this.requireMedication(context, medicationId);
      const values = validateScheduleInput(input);
      const scheduleId = this.createId();
      const now = this.now();

      await this.db.batch([
        this.db.insert(medicationSchedules).values({
          id: scheduleId,
          familyId: context.familyId,
          medicationId,
          ...values,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
          createdAt: now,
          updatedAt: now,
        }),
        this.auditQuery({
          context,
          action: "schedule.created",
          targetType: "medication_schedule",
          targetId: scheduleId,
          now,
        }),
      ]);

      return this.requireSchedule(context, scheduleId);
    });
  }

  async updateSchedule(
    context: AuthorizedFamilyContext,
    scheduleId: string,
    input: UpdateMedicationScheduleInput,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      this.validateIdentifier(scheduleId);
      const values = validateScheduleInput(input);
      const version = validateExpectedVersion(input.expectedVersion);
      const current = await this.requireSchedule(context, scheduleId);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(medicationSchedules)
          .set({
            ...values,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${medicationSchedules.version} + 1`,
          })
          .where(
            and(
              eq(medicationSchedules.familyId, context.familyId),
              eq(medicationSchedules.id, scheduleId),
              isNull(medicationSchedules.deletedAt),
              eq(medicationSchedules.version, version),
            ),
          ),
        this.auditQuery({
          context,
          action: "schedule.updated",
          targetType: "medication_schedule",
          targetId: scheduleId,
          now,
        }),
      ]);

      this.requireChange(result);
      return this.requireSchedule(context, scheduleId);
    });
  }

  async deleteSchedule(
    context: AuthorizedFamilyContext,
    scheduleId: string,
    expectedVersion: number,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      this.validateIdentifier(scheduleId);
      const version = validateExpectedVersion(expectedVersion);
      const current = await this.requireSchedule(context, scheduleId);
      if (current.version !== version) {
        throw new FamilyCareDataError("CONFLICT");
      }
      const now = this.now();

      const [result] = await this.db.batch([
        this.db
          .update(medicationSchedules)
          .set({
            deletedAt: now,
            deletedByUserId: context.userId,
            updatedByUserId: context.userId,
            updatedAt: now,
            version: sql`${medicationSchedules.version} + 1`,
          })
          .where(
            and(
              eq(medicationSchedules.familyId, context.familyId),
              eq(medicationSchedules.id, scheduleId),
              isNull(medicationSchedules.deletedAt),
              eq(medicationSchedules.version, version),
            ),
          ),
        this.auditQuery({
          context,
          action: "schedule.deleted",
          targetType: "medication_schedule",
          targetId: scheduleId,
          now,
        }),
      ]);

      this.requireChange(result);
    });
  }

  /**
   * Marks a dose occurrence as taken. Shares the exact `(scheduleId,
   * occurrenceDate)` idempotency key used by the cron sweep in
   * `db/queries/reminders.ts` — logging a dose the cron already notified
   * for updates that same row instead of creating a duplicate.
   */
  async logDoseTaken(
    context: AuthorizedFamilyContext,
    scheduleId: string,
    input: LogDoseInput,
  ) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "caregiver");
      const schedule = await this.requireSchedule(context, scheduleId);
      const occurrenceDate = validateOccurrenceDate(input.occurrenceDate);
      const takenAt = input.takenAt ?? this.now();
      if (!Number.isSafeInteger(takenAt)) {
        throw new FamilyCareDataError("INVALID_INPUT");
      }
      const notes = input.notes ? input.notes.trim().slice(0, 500) : null;
      const now = this.now();
      const doseId = this.createId();

      await this.db
        .insert(medicationDoses)
        .values({
          id: doseId,
          familyId: context.familyId,
          medicationId: schedule.medicationId,
          scheduleId,
          occurrenceDate,
          scheduledAt: scheduledInstant(occurrenceDate, schedule.timeOfDay),
          takenAt,
          takenByUserId: context.userId,
          notes,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [medicationDoses.scheduleId, medicationDoses.occurrenceDate],
          set: { takenAt, takenByUserId: context.userId, notes, updatedAt: now },
        });

      return this.requireDose(scheduleId, occurrenceDate);
    });
  }

  /**
   * Today's schedule occurrences for a relative (in `APP_TIMEZONE`), each
   * paired with its dose row if one already exists — the shape the "due
   * today" / "mark as taken" UI needs. Not a full dose history browser;
   * that's a reasonable follow-up if the user wants one later.
   */
  async listTodayDoses(context: AuthorizedFamilyContext, relativeId: string) {
    return safely(async () => {
      await requireFamilyRole(this.db, context, "viewer");
      await this.requireRelative(context, relativeId);

      const relativeMedications = await this.db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.familyId, context.familyId),
            eq(medications.relativeId, relativeId),
            isNull(medications.deletedAt),
          ),
        )
        .all();
      if (relativeMedications.length === 0) {
        return [];
      }
      const medicationIds = relativeMedications.map((medication) => medication.id);
      const medicationById = new Map(relativeMedications.map((m) => [m.id, m]));

      const now = this.now();
      const occurrenceDate = currentOccurrenceDate(now);
      const weekday = currentWeekday(now);

      const todaySchedules = (
        await this.db
          .select()
          .from(medicationSchedules)
          .where(
            and(
              inArray(medicationSchedules.medicationId, medicationIds),
              isNull(medicationSchedules.deletedAt),
            ),
          )
          .orderBy(asc(medicationSchedules.timeOfDay))
          .all()
      ).filter((schedule) => schedule.daysOfWeek.includes(weekday));
      if (todaySchedules.length === 0) {
        return [];
      }

      const scheduleIds = todaySchedules.map((schedule) => schedule.id);
      const existingDoses = await this.db
        .select()
        .from(medicationDoses)
        .where(
          and(
            inArray(medicationDoses.scheduleId, scheduleIds),
            eq(medicationDoses.occurrenceDate, occurrenceDate),
          ),
        )
        .all();
      const doseBySchedule = new Map(existingDoses.map((dose) => [dose.scheduleId, dose]));

      return todaySchedules.map((schedule) => {
        const medication = medicationById.get(schedule.medicationId)!;
        const dose = doseBySchedule.get(schedule.id);
        return {
          scheduleId: schedule.id,
          medicationId: medication.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          timeOfDay: schedule.timeOfDay,
          quantity: schedule.quantity,
          occurrenceDate,
          scheduledAt: scheduledInstant(occurrenceDate, schedule.timeOfDay),
          takenAt: dose?.takenAt ?? null,
        };
      });
    });
  }

  async upsertPushSubscription(
    context: AuthenticatedUserContext,
    input: PushSubscriptionInput,
  ) {
    return safely(async () => {
      this.validateAuthenticatedContext(context);
      const values = validatePushSubscriptionInput(input);
      const now = this.now();

      await this.db
        .insert(pushSubscriptions)
        .values({
          id: this.createId(),
          userId: context.userId,
          ...values,
          createdAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: context.userId,
            p256dh: values.p256dh,
            authKey: values.authKey,
            userAgent: values.userAgent,
            lastSeenAt: now,
            lastFailureAt: null,
            failureCount: 0,
          },
        });
    });
  }

  async deletePushSubscription(context: AuthenticatedUserContext, endpoint: string) {
    return safely(async () => {
      this.validateAuthenticatedContext(context);
      this.validateIdentifier(endpoint);
      await this.db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, endpoint),
            eq(pushSubscriptions.userId, context.userId),
          ),
        );
    });
  }

  private auditQuery({
    context,
    action,
    targetType,
    targetId,
    metadata = {},
    now,
  }: {
    context: AuthorizedFamilyContext;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, string | number | boolean | null>;
    now: number;
  }) {
    return this.db.insert(auditEvents).values({
      id: this.createId(),
      familyId: context.familyId,
      actorUserId: context.userId,
      action,
      targetType,
      targetId,
      outcome: "success",
      requestId: context.requestId,
      metadata,
      createdAt: now,
    });
  }

  private async requireFamily(context: AuthorizedFamilyContext) {
    const family = await this.db
      .select()
      .from(families)
      .where(
        and(
          eq(families.id, context.familyId),
          eq(families.status, "active"),
        ),
      )
      .get();
    if (!family) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return family;
  }

  private async requireMember(familyId: string, userId: string) {
    const member = await this.db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, userId),
        ),
      )
      .get();
    if (!member) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return member;
  }

  private async requireAnotherAdmin(familyId: string) {
    const result = await this.db
      .select({ value: count() })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.role, "admin"),
          eq(familyMembers.status, "active"),
        ),
      )
      .get();
    if (!result || result.value <= 1) {
      throw new FamilyCareDataError("LAST_ADMIN");
    }
  }

  private async requireInvitation(invitationId: string, familyId?: string) {
    const invitation = await this.db
      .select()
      .from(invitations)
      .where(
        familyId
          ? and(eq(invitations.id, invitationId), eq(invitations.familyId, familyId))
          : eq(invitations.id, invitationId),
      )
      .get();
    if (!invitation) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return invitation;
  }

  private async requireRelative(
    context: AuthorizedFamilyContext,
    relativeId: string,
  ) {
    this.validateIdentifier(relativeId);
    const relative = await this.db
      .select()
      .from(relatives)
      .where(
        and(
          eq(relatives.familyId, context.familyId),
          eq(relatives.id, relativeId),
          isNull(relatives.deletedAt),
        ),
      )
      .get();
    if (!relative) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return relative;
  }

  private async requireRelativeWithMedications(
    context: AuthorizedFamilyContext,
    relativeId: string,
  ): Promise<RelativeWithMedications> {
    const relative = await this.requireRelative(context, relativeId);
    const relativeMedications = await this.db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.familyId, context.familyId),
          eq(medications.relativeId, relativeId),
          isNull(medications.deletedAt),
        ),
      )
      .orderBy(asc(medications.position), asc(medications.createdAt))
      .all();
    return { ...relative, medications: relativeMedications };
  }

  private async requireMedication(
    context: AuthorizedFamilyContext,
    medicationId: string,
  ) {
    this.validateIdentifier(medicationId);
    const medication = await this.db
      .select()
      .from(medications)
      .where(
        and(
          eq(medications.familyId, context.familyId),
          eq(medications.id, medicationId),
          isNull(medications.deletedAt),
        ),
      )
      .get();
    if (!medication) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return medication;
  }

  private async requireSchedule(
    context: AuthorizedFamilyContext,
    scheduleId: string,
  ): Promise<MedicationScheduleRow> {
    this.validateIdentifier(scheduleId);
    const schedule = await this.db
      .select()
      .from(medicationSchedules)
      .where(
        and(
          eq(medicationSchedules.familyId, context.familyId),
          eq(medicationSchedules.id, scheduleId),
          isNull(medicationSchedules.deletedAt),
        ),
      )
      .get();
    if (!schedule) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return schedule;
  }

  private async requireDose(scheduleId: string, occurrenceDate: string) {
    const dose = await this.db
      .select()
      .from(medicationDoses)
      .where(
        and(
          eq(medicationDoses.scheduleId, scheduleId),
          eq(medicationDoses.occurrenceDate, occurrenceDate),
        ),
      )
      .get();
    if (!dose) {
      throw new FamilyCareDataError("NOT_FOUND");
    }
    return dose;
  }

  private requireChange(result: { meta: { changes: number } }) {
    if (result.meta.changes < 1) {
      throw new FamilyCareDataError("CONFLICT");
    }
  }

  private validateAuthenticatedContext(context: AuthenticatedUserContext) {
    this.validateIdentifier(context.userId);
  }

  private validateIdentifier(value: string) {
    if (!value || value.length > 128) {
      throw new FamilyCareDataError("INVALID_INPUT");
    }
  }
}

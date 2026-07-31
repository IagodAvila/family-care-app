import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { eq } from "drizzle-orm";

import { createDb } from "../db/index.ts";
import { FamilyCareDataError } from "../db/errors.ts";
import {
  auditEvents,
  families,
  familyMembers,
  medications,
  relatives,
  users,
} from "../db/schema.ts";
import { FamilyCareDataService } from "../db/services/family-care.ts";
import {
  applyMigrations,
  LocalD1Database,
} from "./helpers/d1-database.mjs";

const databases = [];

afterEach(() => {
  while (databases.length > 0) {
    databases.pop().close();
  }
});

async function createTestContext() {
  const binding = new LocalD1Database();
  databases.push(binding);
  await applyMigrations(binding);
  const db = createDb(binding);
  let nextId = 0;
  const service = new FamilyCareDataService(db, {
    createId: () => `generated-${++nextId}`,
    now: () => 1_800_000_000_000 + nextId,
  });
  return { binding, db, service };
}

async function seedUser(db, id) {
  const now = 1_800_000_000_000;
  await db.insert(users).values({
    id,
    authProvider: "test-provider",
    authSubject: `subject-${id}`,
    emailNormalized: `${id}@invalid.example`,
    displayName: `Pessoa ${id}`,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

async function createFamilyFor(service, db, userId, name = "Grupo sintético") {
  await seedUser(db, userId);
  const family = await service.createFamily({ userId }, { name });
  return {
    family,
    context: { userId, familyId: family.id },
  };
}

function relativeInput(overrides = {}) {
  return {
    name: "Familiar sintético",
    relation: "Vínculo de teste",
    birthDate: "1980-01-02",
    bloodType: "O+",
    conditions: ["Condição sintética"],
    allergies: ["Alergia sintética"],
    notes: "Observação exclusivamente fictícia.",
    color: "#123456",
    ...overrides,
  };
}

function medicationInput(overrides = {}) {
  return {
    name: "Medicamento sintético",
    dosage: "Dose fictícia",
    orientation: "Orientação fictícia",
    frequency: 2,
    schedules: ["08:00", "20:00"],
    ...overrides,
  };
}

async function expectDataError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof FamilyCareDataError);
    assert.equal(error.code, code);
    return true;
  });
}

test("aplica a migration completa em um banco vazio", async () => {
  const { binding } = await createTestContext();
  const tables = binding.database
    .prepare(
      "select name from sqlite_master where type = 'table' order by name",
    )
    .all()
    .map(({ name }) => name);

  assert.deepEqual(tables, [
    "audit_events",
    "families",
    "family_members",
    "invitations",
    "medications",
    "relatives",
    "users",
  ]);

  const indexes = binding.database
    .prepare(
      "select name from sqlite_master where type = 'index' and name not like 'sqlite_%'",
    )
    .all();
  assert.ok(indexes.length >= 20);
});

test("cria e consulta um grupo com o criador como administrador", async () => {
  const { db, service } = await createTestContext();
  const { family, context } = await createFamilyFor(
    service,
    db,
    "user-admin",
  );

  assert.equal((await service.getFamily(context)).id, family.id);
  assert.deepEqual(
    (await service.listFamilies({ userId: "user-admin" })).map(
      ({ role }) => role,
    ),
    ["admin"],
  );
  assert.equal((await service.listMembers(context))[0].role, "admin");
});

test("executa CRUD de familiar com concorrência otimista e exclusão lógica", async () => {
  const { db, service } = await createTestContext();
  const { context } = await createFamilyFor(service, db, "relative-editor");
  const created = await service.createRelative(context, relativeInput());

  assert.equal((await service.getRelative(context, created.id)).name, created.name);

  const updated = await service.updateRelative(
    context,
    created.id,
    {
      ...relativeInput({ name: "Familiar sintético atualizado" }),
      expectedVersion: created.version,
    },
  );
  assert.equal(updated.version, 2);
  assert.equal(updated.name, "Familiar sintético atualizado");

  await expectDataError(
    service.updateRelative(context, created.id, {
      ...relativeInput(),
      expectedVersion: 1,
    }),
    "CONFLICT",
  );

  await service.deleteRelative(context, created.id, updated.version);
  assert.deepEqual(await service.listRelatives(context), []);
  await expectDataError(service.getRelative(context, created.id), "NOT_FOUND");
});

test("executa CRUD de medicamento sempre no escopo do familiar e da família", async () => {
  const { db, service } = await createTestContext();
  const { context } = await createFamilyFor(service, db, "medication-editor");
  const relative = await service.createRelative(context, relativeInput());
  const created = await service.createMedication(
    context,
    relative.id,
    medicationInput(),
  );

  assert.equal(
    (await service.listMedications(context, relative.id))[0].id,
    created.id,
  );

  const updated = await service.updateMedication(context, created.id, {
    ...medicationInput({ dosage: "Dose fictícia revisada" }),
    expectedVersion: created.version,
  });
  assert.equal(updated.version, 2);
  assert.equal(updated.dosage, "Dose fictícia revisada");

  await service.deleteMedication(context, created.id, updated.version);
  assert.deepEqual(await service.listMedications(context, relative.id), []);
  await expectDataError(
    service.getMedication(context, created.id),
    "NOT_FOUND",
  );
});

test("isola IDs entre duas famílias e não revela registros cruzados", async () => {
  const { db, service } = await createTestContext();
  const first = await createFamilyFor(service, db, "family-one", "Grupo um");
  const second = await createFamilyFor(service, db, "family-two", "Grupo dois");
  const relative = await service.createRelative(
    first.context,
    relativeInput(),
  );
  const medication = await service.createMedication(
    first.context,
    relative.id,
    medicationInput(),
  );

  await expectDataError(
    service.getRelative(second.context, relative.id),
    "NOT_FOUND",
  );
  await expectDataError(
    service.getMedication(second.context, medication.id),
    "NOT_FOUND",
  );
  assert.deepEqual(await service.listRelatives(second.context), []);
});

test("rejeita usuário sem vínculo mesmo quando ele conhece os IDs", async () => {
  const { db, service } = await createTestContext();
  const owner = await createFamilyFor(service, db, "linked-owner");
  await seedUser(db, "unlinked-user");

  await expectDataError(
    service.getFamily({
      userId: "unlinked-user",
      familyId: owner.family.id,
    }),
    "NOT_FOUND",
  );
  await expectDataError(
    service.listRelatives({
      userId: "unlinked-user",
      familyId: owner.family.id,
    }),
    "NOT_FOUND",
  );
});

test("aplica permissões de administrador, cuidador e somente leitura", async () => {
  const { db, service } = await createTestContext();
  const { family, context: adminContext } = await createFamilyFor(
    service,
    db,
    "role-admin",
  );
  await seedUser(db, "role-caregiver");
  await seedUser(db, "role-viewer");
  await service.addMember(adminContext, {
    userId: "role-caregiver",
    role: "caregiver",
  });
  await service.addMember(adminContext, {
    userId: "role-viewer",
    role: "viewer",
  });

  const caregiverContext = {
    userId: "role-caregiver",
    familyId: family.id,
  };
  const viewerContext = { userId: "role-viewer", familyId: family.id };
  const relative = await service.createRelative(
    caregiverContext,
    relativeInput(),
  );

  assert.equal((await service.getRelative(viewerContext, relative.id)).id, relative.id);
  await expectDataError(
    service.createRelative(viewerContext, relativeInput()),
    "FORBIDDEN",
  );
  await expectDataError(
    service.addMember(caregiverContext, {
      userId: "role-viewer",
      role: "viewer",
    }),
    "FORBIDDEN",
  );
  await expectDataError(
    service.revokeMember(adminContext, "role-admin"),
    "LAST_ADMIN",
  );
});

test("faz rollback integral quando uma instrução do lote falha", async () => {
  const { db } = await createTestContext();
  await seedUser(db, "rollback-user");
  await db.insert(auditEvents).values({
    id: "forced-collision",
    action: "test.setup",
    outcome: "success",
    metadata: {},
    createdAt: 1,
  });
  const service = new FamilyCareDataService(db, {
    createId: () => "forced-collision",
    now: () => 2,
  });

  await expectDataError(
    service.createFamily(
      { userId: "rollback-user" },
      { name: "Grupo que deve sofrer rollback" },
    ),
    "STORAGE_FAILURE",
  );

  assert.equal(
    (await db.select().from(families).where(eq(families.id, "forced-collision")))
      .length,
    0,
  );
  assert.equal(
    (
      await db
        .select()
        .from(familyMembers)
        .where(eq(familyMembers.familyId, "forced-collision"))
    ).length,
    0,
  );
});

test("preserva relacionamentos e arquiva medicamentos junto com o familiar", async () => {
  const { binding, db, service } = await createTestContext();
  const { context } = await createFamilyFor(service, db, "relationship-owner");
  const relative = await service.createRelative(context, {
    ...relativeInput(),
    medications: [medicationInput(), medicationInput({ name: "Item sintético B" })],
  });

  assert.equal(relative.medications.length, 2);
  assert.throws(() => {
    binding.database
      .prepare("delete from relatives where family_id = ? and id = ?")
      .run(context.familyId, relative.id);
  }, /FOREIGN KEY constraint failed/);

  await service.deleteRelative(context, relative.id, relative.version);
  const storedRelative = await db
    .select()
    .from(relatives)
    .where(eq(relatives.id, relative.id))
    .get();
  const storedMedications = await db
    .select()
    .from(medications)
    .where(eq(medications.relativeId, relative.id))
    .all();

  assert.ok(storedRelative.deletedAt);
  assert.ok(storedMedications.every((medication) => medication.deletedAt));
});

test("reativa vínculo revogado sem duplicar o membro", async () => {
  const { db, service } = await createTestContext();
  const { context } = await createFamilyFor(service, db, "member-admin");
  await seedUser(db, "member-caregiver");
  await service.addMember(context, {
    userId: "member-caregiver",
    role: "caregiver",
  });
  await service.revokeMember(context, "member-caregiver");
  const reactivated = await service.addMember(context, {
    userId: "member-caregiver",
    role: "viewer",
  });

  assert.equal(reactivated.status, "active");
  assert.equal(reactivated.role, "viewer");
  const rows = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, "member-caregiver"))
    .all();
  assert.equal(rows.length, 1);
});

// Minimal in-memory stand-in for the real `/api/**` routes, used to drive
// tests/components.test.tsx without a real Worker/D1. Mirrors the exact
// response shapes hooks/use-family-store.ts expects (see the real routes
// under app/api/), including optimistic-concurrency (`expectedVersion`)
// and 401/404/409 behavior, so the UI is exercised the same way it would
// be against the real backend.
import type { Medication, Relative } from "@/types/family";

/** Shape a POST body's `medications` entries actually have on the wire — see `toMedicationInput` in lib/family-data.ts. */
type MedicationWireInput = {
  name: string;
  dosage?: string;
  orientation?: string;
  frequency?: number | null;
  schedules?: string[];
  legacySchedule?: string | null;
};

type StoredMedication = {
  id: string;
  version: number;
  name: string;
  dosage: string;
  orientation: string;
  frequency: number | null;
  schedules: string[];
  legacySchedule: string | null;
  doseSchedules: StoredDoseSchedule[];
};

/** A `medication_schedules` row stand-in — unrelated to the legacy `schedules`/`schedule` free-text fields above, despite the similar name. */
type StoredDoseSchedule = {
  id: string;
  version: number;
  timeOfDay: string;
  daysOfWeek: number[];
  quantity: number;
};

type StoredRelative = {
  id: string;
  version: number;
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  notes: string;
  color: string;
  photoUrl: string | null;
  medications: StoredMedication[];
};

type StoredMember = {
  userId: string;
  role: "admin" | "caregiver" | "viewer";
  status: "active" | "revoked";
  joinedAt: number;
  revokedAt: number | null;
  emailNormalized: string;
  displayName: string | null;
};

type StoredInvitation = {
  id: string;
  emailNormalized: string;
  role: "caregiver" | "viewer";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: number;
  createdAt: number;
};

const FAMILY_ID = "family-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number, code?: string) {
  return jsonResponse({ error: message, code }, status);
}

export function createFakeFamilyBackend(seedRelatives: readonly Relative[] = []) {
  let nextId = 1;
  const relatives: StoredRelative[] = seedRelatives.map((relative) => toStoredRelative(relative, () => `seed-${nextId++}`));
  const members: StoredMember[] = [
    {
      userId: "user-1",
      role: "admin",
      status: "active",
      joinedAt: 0,
      revokedAt: null,
      emailNormalized: "ana@example.com",
      displayName: "Ana Teste",
    },
  ];
  const invitations: StoredInvitation[] = [];

  function toStoredRelative(relative: Relative, makeId: () => string): StoredRelative {
    return {
      id: relative.id || makeId(),
      version: relative.version ?? 1,
      name: relative.name,
      relation: relative.relation,
      birthDate: relative.birthDate,
      bloodType: relative.bloodType,
      conditions: relative.conditions,
      allergies: relative.allergies,
      notes: relative.notes,
      color: relative.color,
      photoUrl: relative.photoUrl ?? null,
      medications: relative.medications.map((medication) => toStoredMedication(medication, makeId)),
    };
  }

  function toStoredMedication(medication: Medication, makeId: () => string): StoredMedication {
    return {
      id: medication.id || makeId(),
      version: medication.version ?? 1,
      name: medication.name,
      dosage: medication.dosage,
      orientation: medication.orientation ?? "",
      frequency: medication.frequency ?? null,
      schedules: medication.schedules ?? [],
      legacySchedule: medication.schedule ?? null,
      doseSchedules: [],
    };
  }

  function findRelative(id: string) {
    return relatives.find((relative) => relative.id === id);
  }

  function findMedication(relativeId: string, medicationId: string) {
    const relative = findRelative(relativeId);
    return relative?.medications.find((item) => item.id === medicationId);
  }

  function findDoseSchedule(scheduleId: string) {
    for (const relative of relatives) {
      for (const medication of relative.medications) {
        const schedule = medication.doseSchedules.find((item) => item.id === scheduleId);
        if (schedule) return { relative, medication, schedule };
      }
    }
    return undefined;
  }

  // scheduleId -> occurrenceDate -> takenAt. Doesn't filter by weekday like
  // the real `listTodayDoses` does — every schedule is treated as due
  // "today", which is enough to exercise the mark-as-taken wire flow
  // without needing tests to align with the current real-world weekday.
  const takenDoses = new Map<string, number>();
  const todayOccurrenceDate = () => new Date().toISOString().slice(0, 10);
  const doseKey = (scheduleId: string, occurrenceDate: string) => `${scheduleId}:${occurrenceDate}`;

  async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    // Built from the raw args instead of `new Request(input, init)`: that
    // constructor requires an absolute URL, but hooks/use-family-store.ts
    // (like a real browser) calls `fetch("/api/...")` with a path relative
    // to the page origin.
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, "http://localhost");
    const method = (input instanceof Request ? input.method : init?.method) ?? "GET";
    const rawBody = input instanceof Request ? undefined : init?.body;
    const path = url.pathname;
    const body = typeof rawBody === "string" && rawBody.length > 0 ? JSON.parse(rawBody) : {};

    if (path === "/api/me" && method === "GET") {
      return jsonResponse({
        user: { id: "user-1", displayName: "Ana Teste", emailNormalized: "ana@example.com", avatarUrl: null },
        families: [{ family: { id: FAMILY_ID, name: "Família de Ana Teste" }, role: "admin" }],
      });
    }

    if (path === `/api/families/${FAMILY_ID}/relatives` && method === "GET") {
      return jsonResponse({ relatives });
    }

    if (path === `/api/families/${FAMILY_ID}/relatives` && method === "POST") {
      const created: StoredRelative = {
        id: `relative-${nextId++}`,
        version: 1,
        name: body.name ?? "",
        relation: body.relation ?? "",
        birthDate: body.birthDate ?? "",
        bloodType: body.bloodType ?? "",
        conditions: body.conditions ?? [],
        allergies: body.allergies ?? [],
        notes: body.notes ?? "",
        color: body.color ?? "",
        photoUrl: body.photoUrl ?? null,
        medications: (body.medications ?? []).map((medication: MedicationWireInput) => ({
          id: `medication-${nextId++}`,
          version: 1,
          name: medication.name,
          dosage: medication.dosage ?? "",
          orientation: medication.orientation ?? "",
          frequency: medication.frequency ?? null,
          schedules: medication.schedules ?? [],
          legacySchedule: medication.legacySchedule ?? null,
        })),
      };
      relatives.push(created);
      return jsonResponse({ relative: created }, 201);
    }

    const relativeMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/relatives/([^/]+)$`));
    if (relativeMatch) {
      const relative = findRelative(relativeMatch[1]);
      if (!relative) return errorResponse("Não encontrado.", 404, "NOT_FOUND");

      if (method === "GET") return jsonResponse({ relative });

      if (method === "PATCH") {
        if (body.expectedVersion !== relative.version) return errorResponse("Conflito de versão.", 409, "CONFLICT");
        Object.assign(relative, {
          name: body.name ?? relative.name,
          relation: body.relation ?? relative.relation,
          birthDate: body.birthDate ?? relative.birthDate,
          bloodType: body.bloodType ?? relative.bloodType,
          conditions: body.conditions ?? relative.conditions,
          allergies: body.allergies ?? relative.allergies,
          notes: body.notes ?? relative.notes,
          color: body.color ?? relative.color,
          // `photoUrl` can legitimately be cleared to null, unlike the other
          // fields here — `??` would wrongly keep the old photo in that case.
          photoUrl: "photoUrl" in body ? body.photoUrl : relative.photoUrl,
          version: relative.version + 1,
        });
        return jsonResponse({ relative });
      }

      if (method === "DELETE") {
        const expectedVersion = Number(url.searchParams.get("expectedVersion"));
        if (expectedVersion !== relative.version) return errorResponse("Conflito de versão.", 409, "CONFLICT");
        relatives.splice(relatives.indexOf(relative), 1);
        return new Response(null, { status: 204 });
      }
    }

    const medicationsMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/relatives/([^/]+)/medications$`));
    if (medicationsMatch && method === "POST") {
      const relative = findRelative(medicationsMatch[1]);
      if (!relative) return errorResponse("Não encontrado.", 404, "NOT_FOUND");
      const created: StoredMedication = {
        id: `medication-${nextId++}`,
        version: 1,
        name: body.name ?? "",
        dosage: body.dosage ?? "",
        orientation: body.orientation ?? "",
        frequency: body.frequency ?? null,
        schedules: body.schedules ?? [],
        legacySchedule: body.legacySchedule ?? null,
        doseSchedules: [],
      };
      relative.medications.push(created);
      return jsonResponse({ medication: created }, 201);
    }

    const medicationMatch = path.match(
      new RegExp(`^/api/families/${FAMILY_ID}/relatives/([^/]+)/medications/([^/]+)$`),
    );
    if (medicationMatch) {
      const relative = findRelative(medicationMatch[1]);
      const medication = relative?.medications.find((item) => item.id === medicationMatch[2]);
      if (!relative || !medication) return errorResponse("Não encontrado.", 404, "NOT_FOUND");

      if (method === "PATCH") {
        if (body.expectedVersion !== medication.version) return errorResponse("Conflito de versão.", 409, "CONFLICT");
        Object.assign(medication, {
          name: body.name ?? medication.name,
          dosage: body.dosage ?? medication.dosage,
          orientation: body.orientation ?? medication.orientation,
          frequency: body.frequency ?? medication.frequency,
          schedules: body.schedules ?? medication.schedules,
          legacySchedule: body.legacySchedule ?? medication.legacySchedule,
          version: medication.version + 1,
        });
        return jsonResponse({ medication });
      }

      if (method === "DELETE") {
        const expectedVersion = Number(url.searchParams.get("expectedVersion"));
        if (expectedVersion !== medication.version) return errorResponse("Conflito de versão.", 409, "CONFLICT");
        relative.medications.splice(relative.medications.indexOf(medication), 1);
        return new Response(null, { status: 204 });
      }
    }

    const schedulesMatch = path.match(
      new RegExp(`^/api/families/${FAMILY_ID}/relatives/([^/]+)/medications/([^/]+)/schedules$`),
    );
    if (schedulesMatch) {
      const medication = findMedication(schedulesMatch[1], schedulesMatch[2]);
      if (!medication) return errorResponse("Não encontrado.", 404, "NOT_FOUND");

      if (method === "GET") return jsonResponse({ schedules: medication.doseSchedules });

      if (method === "POST") {
        const created: StoredDoseSchedule = {
          id: `schedule-${nextId++}`,
          version: 1,
          timeOfDay: body.timeOfDay ?? "08:00",
          daysOfWeek: body.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7],
          quantity: body.quantity ?? 1,
        };
        medication.doseSchedules.push(created);
        return jsonResponse({ schedule: created }, 201);
      }
    }

    const scheduleMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/relatives/[^/]+/medications/[^/]+/schedules/([^/]+)$`));
    if (scheduleMatch) {
      const found = findDoseSchedule(scheduleMatch[1]);
      if (!found) return errorResponse("Não encontrado.", 404, "NOT_FOUND");
      const { medication, schedule } = found;

      if (method === "PATCH") {
        if (body.expectedVersion !== schedule.version) return errorResponse("Conflito de versão.", 409, "CONFLICT");
        Object.assign(schedule, {
          timeOfDay: body.timeOfDay ?? schedule.timeOfDay,
          daysOfWeek: body.daysOfWeek ?? schedule.daysOfWeek,
          quantity: body.quantity ?? schedule.quantity,
          version: schedule.version + 1,
        });
        return jsonResponse({ schedule });
      }

      if (method === "DELETE") {
        const expectedVersion = Number(url.searchParams.get("expectedVersion"));
        if (expectedVersion !== schedule.version) return errorResponse("Conflito de versão.", 409, "CONFLICT");
        medication.doseSchedules.splice(medication.doseSchedules.indexOf(schedule), 1);
        return new Response(null, { status: 204 });
      }
    }

    const doseMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/relatives/[^/]+/medications/[^/]+/schedules/([^/]+)/doses$`));
    if (doseMatch && method === "POST") {
      const found = findDoseSchedule(doseMatch[1]);
      if (!found) return errorResponse("Não encontrado.", 404, "NOT_FOUND");
      const occurrenceDate = body.occurrenceDate ?? todayOccurrenceDate();
      const takenAt = body.takenAt ?? Date.now();
      takenDoses.set(doseKey(found.schedule.id, occurrenceDate), takenAt);
      return jsonResponse({ dose: { scheduleId: found.schedule.id, occurrenceDate, takenAt } }, 201);
    }

    const todayDosesMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/relatives/([^/]+)/doses$`));
    if (todayDosesMatch && method === "GET") {
      const relative = findRelative(todayDosesMatch[1]);
      if (!relative) return errorResponse("Não encontrado.", 404, "NOT_FOUND");
      const occurrenceDate = todayOccurrenceDate();
      const doses = relative.medications.flatMap((medication) =>
        medication.doseSchedules.map((schedule) => ({
          scheduleId: schedule.id,
          medicationId: medication.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          timeOfDay: schedule.timeOfDay,
          quantity: schedule.quantity,
          occurrenceDate,
          scheduledAt: Date.now(),
          takenAt: takenDoses.get(doseKey(schedule.id, occurrenceDate)) ?? null,
        })),
      );
      return jsonResponse({ doses });
    }

    if (path === "/api/push/public-key" && method === "GET") {
      return jsonResponse({ publicKey: "fake-vapid-public-key" });
    }

    if (path === "/api/push/subscribe" && (method === "POST" || method === "DELETE")) {
      return new Response(null, { status: 204 });
    }

    if (path === `/api/families/${FAMILY_ID}/members` && method === "GET") {
      return jsonResponse({ members });
    }

    const memberMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/members/([^/]+)$`));
    if (memberMatch) {
      const member = members.find((item) => item.userId === memberMatch[1]);
      if (!member) return errorResponse("Não encontrado.", 404, "NOT_FOUND");

      if (method === "PATCH") {
        member.role = body.role ?? member.role;
        return jsonResponse({ member });
      }
      if (method === "DELETE") {
        member.status = "revoked";
        member.revokedAt = Date.now();
        return jsonResponse({ member });
      }
    }

    if (path === `/api/families/${FAMILY_ID}/invitations` && method === "GET") {
      return jsonResponse({ invitations });
    }

    if (path === `/api/families/${FAMILY_ID}/invitations` && method === "POST") {
      if (invitations.some((item) => item.emailNormalized === body.emailNormalized && item.status === "pending")) {
        return errorResponse("Já existe um convite pendente para esse e-mail.", 409, "CONFLICT");
      }
      const invitation: StoredInvitation = {
        id: `invitation-${nextId++}`,
        emailNormalized: body.emailNormalized ?? "",
        role: body.role ?? "viewer",
        status: "pending",
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
      };
      invitations.push(invitation);
      return jsonResponse({ invitation, token: `fake-token-${invitation.id}` }, 201);
    }

    const invitationMatch = path.match(new RegExp(`^/api/families/${FAMILY_ID}/invitations/([^/]+)$`));
    if (invitationMatch && method === "DELETE") {
      const invitation = invitations.find((item) => item.id === invitationMatch[1]);
      if (!invitation) return errorResponse("Não encontrado.", 404, "NOT_FOUND");
      invitation.status = "revoked";
      return new Response(null, { status: 204 });
    }

    if (path === `/api/families/${FAMILY_ID}/import-local` && method === "POST") {
      const imported = (body.relatives ?? []).map((relative: Relative) => toStoredRelative(relative, () => `imported-${nextId++}`));
      relatives.push(...imported);
      return jsonResponse({ imported: imported.length, relatives: imported });
    }

    if (path === "/api/auth/logout" && method === "POST") {
      return new Response(null, { status: 204 });
    }

    return errorResponse(`Rota não simulada: ${method} ${path}`, 404);
  }

  return {
    fetch: handle,
    getRelatives: () => relatives,
    getMembers: () => members,
    getInvitations: () => invitations,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { InviteForm } from "./invite-form";
import { Modal } from "./modal";

type FamilyRole = "admin" | "caregiver" | "viewer";

type MemberRow = {
  userId: string;
  role: FamilyRole;
  status: "active" | "revoked";
  joinedAt: number;
  revokedAt: number | null;
  emailNormalized: string;
  displayName: string | null;
};

type InvitationRow = {
  id: string;
  emailNormalized: string;
  role: Exclude<FamilyRole, "admin">;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: number;
  createdAt: number;
};

const ROLE_LABELS: Record<FamilyRole, string> = {
  admin: "Administrador",
  caregiver: "Cuidador",
  viewer: "Somente leitura",
};

type MembersPanelProps = {
  familyId: string;
  currentUserId: string;
  onClose: () => void;
  onError: (message: string) => void;
};

export function MembersPanel({ familyId, currentUserId, onClose, onError }: MembersPanelProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [revokeMemberId, setRevokeMemberId] = useState<string | null>(null);
  const [revokeInvitationId, setRevokeInvitationId] = useState<string | null>(null);

  const isAdmin = members.find((member) => member.userId === currentUserId)?.role === "admin";
  const activeMembers = members.filter((member) => member.status === "active");
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");

  const load = useCallback(async () => {
    try {
      const membersResponse = await api(`/api/families/${familyId}/members`);
      setMembers(membersResponse.members);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Não foi possível carregar os membros.");
    }
    try {
      // Only admins can list invitations (service-side check) — a
      // caregiver/viewer gets 403 here, which just means "nothing to show".
      const invitationsResponse = await api(`/api/families/${familyId}/invitations`);
      setInvitations(invitationsResponse.invitations);
    } catch {
      setInvitations([]);
    }
    setLoading(false);
  }, [familyId, onError]);

  /* eslint-disable react-hooks/set-state-in-effect -- Loads members/invitations from the server once on mount. */
  useEffect(() => {
    load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleInviteSubmit(emailNormalized: string, role: "caregiver" | "viewer") {
    try {
      const response = await api(`/api/families/${familyId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ emailNormalized, role }),
      });
      await load();
      return { link: `${window.location.origin}/convite/${response.token}` };
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Não foi possível criar o convite.");
      return null;
    }
  }

  async function changeRole(userId: string, role: FamilyRole) {
    try {
      await api(`/api/families/${familyId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Não foi possível trocar o papel.");
    }
  }

  async function confirmRevokeMember(userId: string) {
    setRevokeMemberId(null);
    try {
      await api(`/api/families/${familyId}/members/${userId}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Não foi possível revogar o acesso.");
    }
  }

  async function confirmRevokeInvitation(invitationId: string) {
    setRevokeInvitationId(null);
    try {
      await api(`/api/families/${familyId}/invitations/${invitationId}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Não foi possível revogar o convite.");
    }
  }

  return (
    <Modal
      className="members-modal"
      titleId="members-title"
      initialFocusSelector="[data-modal-primary]"
      onClose={onClose}
    >
      <div className="modal-header">
        <div>
          <p className="eyebrow">Sua família</p>
          <h2 id="members-title">{showInviteForm ? "Convidar para a família" : "Membros"}</h2>
        </div>
        <button type="button" aria-label="Fechar" data-modal-primary={!showInviteForm || undefined} onClick={onClose}>
          ×
        </button>
      </div>

      {showInviteForm ? (
        <InviteForm onCancel={() => setShowInviteForm(false)} onSubmit={handleInviteSubmit} />
      ) : loading ? (
        <p>Carregando…</p>
      ) : (
        <>
          <ul className="members-list" aria-label="Membros da família">
            {activeMembers.map((member) => (
              <li key={member.userId} className="member-row">
                <div>
                  <strong>{member.displayName ?? member.emailNormalized}</strong>
                  <small>{member.emailNormalized}</small>
                </div>

                {revokeMemberId === member.userId ? (
                  <div className="member-actions">
                    <span>Revogar acesso?</span>
                    <button type="button" onClick={() => setRevokeMemberId(null)}>Cancelar</button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => confirmRevokeMember(member.userId)}
                    >
                      Confirmar
                    </button>
                  </div>
                ) : isAdmin && member.userId !== currentUserId ? (
                  <div className="member-actions">
                    <select
                      aria-label={`Papel de ${member.displayName ?? member.emailNormalized}`}
                      value={member.role}
                      onChange={(event) => changeRole(member.userId, event.target.value as FamilyRole)}
                    >
                      <option value="admin">Administrador</option>
                      <option value="caregiver">Cuidador</option>
                      <option value="viewer">Somente leitura</option>
                    </select>
                    <button type="button" onClick={() => setRevokeMemberId(member.userId)}>Revogar</button>
                  </div>
                ) : (
                  <span className="role-badge">{ROLE_LABELS[member.role]}</span>
                )}
              </li>
            ))}
          </ul>

          {isAdmin && (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Acesso</p>
                  <h3>Convites pendentes</h3>
                </div>
                <button type="button" onClick={() => setShowInviteForm(true)}>
                  <span aria-hidden="true">＋</span> Convidar
                </button>
              </div>

              {pendingInvitations.length ? (
                <ul className="members-list" aria-label="Convites pendentes">
                  {pendingInvitations.map((invitation) => (
                    <li key={invitation.id} className="member-row">
                      <div>
                        <strong>{invitation.emailNormalized}</strong>
                        <small>{ROLE_LABELS[invitation.role]}</small>
                      </div>
                      {revokeInvitationId === invitation.id ? (
                        <div className="member-actions">
                          <span>Revogar convite?</span>
                          <button type="button" onClick={() => setRevokeInvitationId(null)}>Cancelar</button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => confirmRevokeInvitation(invitation.id)}
                          >
                            Confirmar
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setRevokeInvitationId(invitation.id)}>
                          Revogar convite
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-medications">Nenhum convite pendente.</div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

"use client";

import { useState, type FormEvent } from "react";

type InviteFormProps = {
  onCancel: () => void;
  onSubmit: (emailNormalized: string, role: "caregiver" | "viewer") => Promise<{ link: string } | null>;
};

/**
 * Plain section (not its own `<Modal>`) meant to be swapped into
 * `MembersPanel`'s single modal body — this app avoids nesting one
 * `Modal` inside another (see `app-modals.tsx`: destructive confirmations
 * always replace, never stack on top of, the form that triggered them).
 */
export function InviteForm({ onCancel, onSubmit }: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"caregiver" | "viewer">("caregiver");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const result = await onSubmit(email.trim(), role);
    setSubmitting(false);
    if (result) setLink(result.link);
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (link) {
    return (
      <div className="invite-link-result">
        <p>
          Convite criado para <strong>{email}</strong>. Envie este link por
          WhatsApp, e-mail ou como preferir — ele expira em 7 dias e só pode
          ser aceito por quem entrar com esse e-mail.
        </p>
        <div className="invite-link-row">
          <input
            readOnly
            value={link}
            aria-label="Link de convite"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" onClick={copyLink}>
            {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
        <div className="form-actions">
          <button className="submit-button" type="button" onClick={onCancel}>
            Concluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        E-mail da pessoa convidada
        <input
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nome@exemplo.com"
        />
      </label>
      <label>
        Papel
        <select value={role} onChange={(event) => setRole(event.target.value as "caregiver" | "viewer")}>
          <option value="caregiver">Cuidador — pode cadastrar e editar</option>
          <option value="viewer">Somente leitura — só pode consultar</option>
        </select>
      </label>
      <div className="form-actions">
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? "Gerando…" : "Gerar convite"}
        </button>
      </div>
    </form>
  );
}

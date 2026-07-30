"use client";

import { useMemo, useState } from "react";
import { getAge, getInitials } from "@/lib/family-format";
import type { Relative } from "@/types/family";

type FamilyPanelProps = {
  family: Relative[];
  selectedId?: string;
  onAddRelative: () => void;
  onSelectRelative: (id: string) => void;
};

export function FamilyPanel({
  family,
  selectedId,
  onAddRelative,
  onSelectRelative,
}: FamilyPanelProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      family.filter((person) =>
        `${person.name} ${person.relation}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [family, query],
  );

  return (
    <aside className="family-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Minha rede</p>
          <h2>Familiares</h2>
        </div>
        <div className="family-panel-actions">
          <span>{family.length}</span>
          <button
            className="add-relative-compact"
            type="button"
            onClick={onAddRelative}
            aria-label="Adicionar familiar"
          >
            <span aria-hidden="true">＋</span>
            <span className="add-relative-label">Adicionar</span>
          </button>
        </div>
      </div>

      <label className="search">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar familiar"
        />
      </label>

      <div className="family-list" role="region" aria-label="Lista de familiares" tabIndex={0}>
        {filtered.map((person) => (
          <button
            className={person.id === selectedId ? "person-card selected" : "person-card"}
            key={person.id}
            type="button"
            onClick={() => onSelectRelative(person.id)}
          >
            <span className="avatar" style={{ backgroundColor: person.color }}>
              {getInitials(person.name)}
            </span>
            <span className="person-summary">
              <strong>{person.name}</strong>
              <small>{person.relation} · {getAge(person.birthDate)} anos</small>
            </span>
            <span className="blood-mini">{person.bloodType}</span>
          </button>
        ))}

        {!filtered.length && <p className="empty-state">Nenhum familiar encontrado.</p>}
      </div>
    </aside>
  );
}

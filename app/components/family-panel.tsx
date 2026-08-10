"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAge } from "@/lib/family-format";
import type { Relative } from "@/types/family";
import { PersonAvatar } from "./person-avatar";

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere on the page, unless the user is
  // already typing somewhere else — a common list-filter shortcut.
  useEffect(() => {
    function focusSearchOnSlash(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      const isTyping = target
        && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if (isTyping) return;

      event.preventDefault();
      searchInputRef.current?.focus();
    }

    document.addEventListener("keydown", focusSearchOnSlash);
    return () => document.removeEventListener("keydown", focusSearchOnSlash);
  }, []);

  // Alphabetical by name — a fixed, predictable order rather than raw
  // insertion order, with no picker needed to explain it.
  const sorted = useMemo(() => {
    const filtered = family.filter((person) =>
      `${person.name} ${person.relation}`.toLowerCase().includes(query.toLowerCase()),
    );

    return filtered.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [family, query]);

  return (
    <aside className="family-panel">
      <div className="panel-title">
        <h2>Familiares</h2>
        <div className="family-panel-actions">
          <span>{family.length}</span>
          <button
            className="add-relative-compact"
            type="button"
            onClick={onAddRelative}
            aria-label="Adicionar familiar"
          >
            <Plus aria-hidden="true" size={15} strokeWidth={1.75} />
            <span className="add-relative-label">Adicionar</span>
          </button>
        </div>
      </div>

      <label className="search">
        <Search aria-hidden="true" size={15} strokeWidth={1.75} />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar familiar"
        />
        {!query && <kbd className="search-hint" aria-hidden="true">/</kbd>}
      </label>

      <div className="family-list" role="region" aria-label="Lista de familiares">
        {sorted.map((person) => (
          <button
            className={person.id === selectedId ? "person-card selected" : "person-card"}
            key={person.id}
            type="button"
            onClick={() => onSelectRelative(person.id)}
          >
            <PersonAvatar name={person.name} color={person.color} photoUrl={person.photoUrl} />
            <span className="person-summary">
              <strong>{person.name}</strong>
              <small>{person.relation} · {getAge(person.birthDate)} anos</small>
            </span>
            <span className="blood-mini">{person.bloodType}</span>
          </button>
        ))}

        {!sorted.length && (
          <p className="empty-state">
            {family.length
              ? `Nenhum familiar encontrado para "${query}".`
              : "Nenhum familiar cadastrado ainda."}
          </p>
        )}
      </div>
    </aside>
  );
}

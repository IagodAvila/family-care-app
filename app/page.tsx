"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createRelative, deleteRelative as removeRelative, updateRelative } from "./family-data.mjs";

type Medication = { name: string; dosage: string; schedule: string };
type Relative = {
  id: string;
  name: string;
  relation: string;
  birthDate: string;
  bloodType: string;
  conditions: string[];
  allergies: string[];
  medications: Medication[];
  notes: string;
  color: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ageFrom(date: string) {
  const birth = new Date(`${date}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${date}T12:00:00`));
}

export default function Home() {
  const [family, setFamily] = useState<Relative[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- This effect hydrates React state from browser storage. */
  useEffect(() => {
    const saved = window.localStorage.getItem("familycare-family");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Relative[];
        setFamily(parsed);
        setSelectedId(parsed[0]?.id ?? "");
      } catch {
        window.localStorage.removeItem("familycare-family");
      }
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("familycare-family", JSON.stringify(family));
  }, [family, hydrated]);

  const selected = family.find((person) => person.id === selectedId) ?? family[0];
  const editingRelative = family.find((person) => person.id === editingId);
  const filtered = useMemo(
    () => family.filter((person) => `${person.name} ${person.relation}`.toLowerCase().includes(query.toLowerCase())),
    [family, query],
  );

  function openAddRelative() {
    setEditingId(null);
    setShowForm(true);
  }

  function openEditRelative() {
    if (!selected) return;
    setEditingId(selected.id);
    setShowForm(true);
  }

  function deleteRelative() {
    if (!selected) return;
    const firstConfirmation = window.confirm(`Tem certeza de que deseja apagar ${selected.name}?`);
    if (!firstConfirmation) return;

    const finalConfirmation = window.confirm(`Confirmação final: todos os dados de ${selected.name}, incluindo medicamentos, serão excluídos definitivamente. Deseja continuar?`);
    if (!finalConfirmation) return;

    const remainingFamily = removeRelative(family, selected.id) as Relative[];
    setFamily(remainingFamily);
    setSelectedId(remainingFamily[0]?.id ?? "");
  }

  function saveRelative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (editingId) {
      setFamily((current) => updateRelative(current, editingId, data) as Relative[]);
      setShowForm(false);
      setEditingId(null);
      return;
    }

    const person = createRelative(data, family.length) as Relative;
    setFamily((current) => [...current, person]);
    setSelectedId(person.id);
    setShowForm(false);
  }

  function addMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const medication: Medication = {
      name: String(data.get("name")).trim(),
      dosage: String(data.get("dosage")).trim(),
      schedule: String(data.get("schedule")).trim(),
    };
    setFamily((current) => current.map((person) => person.id === selected.id
      ? { ...person, medications: [...person.medications, medication] }
      : person));
    setShowMedicationForm(false);
  }

  function removeMedication(index: number) {
    if (!selected) return;
    const medication = selected.medications[index];
    if (!window.confirm(`Remover ${medication.name} dos medicamentos de ${selected.name}?`)) return;
    setFamily((current) => current.map((person) => person.id === selected.id
      ? { ...person, medications: person.medications.filter((_, medicationIndex) => medicationIndex !== index) }
      : person));
  }

  return (
    <main className={emergencyMode ? "app emergency-active" : "app"}>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="FamilyCare, início">
          <span className="brand-mark" aria-hidden="true">+</span>
          <span>family<span>care</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a className="active" href="#familiares">Familiares</a>
          <button type="button" onClick={() => setShowPrivacy(true)}>Privacidade</button>
        </nav>
        <button className="add-button" type="button" onClick={openAddRelative}>
          <span aria-hidden="true">＋</span> Adicionar familiar
        </button>
      </header>

      <section className="hero" id="inicio">
        <div>
          <p className="eyebrow">Informação certa, na hora que importa</p>
          <h1>Quem você ama, sempre bem cuidado.</h1>
          <p>Tenha os dados essenciais de saúde da sua família organizados e acessíveis quando cada segundo conta.</p>
        </div>
        <button className="emergency-button" type="button" onClick={() => setEmergencyMode((current) => !current)}>
          <span className="pulse" aria-hidden="true">!</span>
          <span><strong>{emergencyMode ? "Sair do modo emergência" : "Modo emergência"}</strong><small>{emergencyMode ? "Voltar à visualização completa" : "Exibir somente dados vitais"}</small></span>
        </button>
      </section>

      <section className="workspace" id="familiares">
        <aside className="family-panel">
          <div className="panel-title">
            <div><p className="eyebrow">Minha rede</p><h2>Familiares</h2></div>
            <span>{family.length}</span>
          </div>
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar familiar" />
          </label>
          <div className="family-list">
            {filtered.map((person) => (
              <button
                className={person.id === selected?.id ? "person-card selected" : "person-card"}
                key={person.id}
                type="button"
                onClick={() => setSelectedId(person.id)}
              >
                <span className="avatar" style={{ backgroundColor: person.color }}>{initials(person.name)}</span>
                <span className="person-summary"><strong>{person.name}</strong><small>{person.relation} · {ageFrom(person.birthDate)} anos</small></span>
                <span className="blood-mini">{person.bloodType}</span>
              </button>
            ))}
            {!filtered.length && <p className="empty-state">Nenhum familiar encontrado.</p>}
          </div>
        </aside>

        {selected ? <article className="medical-record">
          <div className="record-header">
            <div className="identity">
              <span className="avatar avatar-large" style={{ backgroundColor: selected.color }}>{initials(selected.name)}</span>
              <div><span className="relation-label">{selected.relation}</span><h2>{selected.name}</h2><p>{formatDate(selected.birthDate)} · {ageFrom(selected.birthDate)} anos</p></div>
            </div>
            <div className="record-actions">
              <div className="updated"><span aria-hidden="true">✓</span> Dados salvos neste dispositivo</div>
              <button className="edit-button" type="button" onClick={openEditRelative}><span aria-hidden="true">✎</span> Editar familiar</button>
              <button className="delete-button" type="button" onClick={deleteRelative}><span aria-hidden="true">⌫</span> Apagar familiar</button>
            </div>
          </div>

          <div className="vitals-grid">
            <section className="vital-card blood-card">
              <span className="card-icon" aria-hidden="true">●</span>
              <div><small>Tipo sanguíneo</small><strong>{selected.bloodType}</strong></div>
            </section>
            <section className="vital-card">
              <span className="card-icon heart" aria-hidden="true">♥</span>
              <div><small>Comorbidades</small><div className="chips">{selected.conditions.length ? selected.conditions.map((item) => <span key={item}>{item}</span>) : <span className="chip-neutral">Nenhuma informada</span>}</div></div>
            </section>
            <section className="vital-card allergy-card">
              <span className="card-icon" aria-hidden="true">!</span>
              <div><small>Alergias</small><div className="chips">{selected.allergies.length ? selected.allergies.map((item) => <span key={item}>{item}</span>) : <span className="chip-neutral">Nenhuma informada</span>}</div></div>
            </section>
          </div>

          <section className="medications-section">
            <div className="section-heading">
              <div><p className="eyebrow">Uso contínuo</p><h3>Medicamentos</h3></div>
              <div className="medication-heading-actions">
                <span>{selected.medications.length} {selected.medications.length === 1 ? "medicamento" : "medicamentos"}</span>
                <button type="button" onClick={() => setShowMedicationForm(true)}><span aria-hidden="true">＋</span> Adicionar</button>
              </div>
            </div>
            {selected.medications.length ? (
              <div className="medication-list">
                {selected.medications.map((medication, index) => (
                  <div className="medication-row" key={`${medication.name}-${medication.dosage}-${index}`}>
                    <span className="pill-icon" aria-hidden="true">◐</span>
                    <div><strong>{medication.name}</strong><small>{medication.schedule}</small></div>
                    <b>{medication.dosage}</b>
                    <button className="remove-medication" type="button" aria-label={`Remover ${medication.name}`} title={`Remover ${medication.name}`} onClick={() => removeMedication(index)}>×</button>
                  </div>
                ))}
              </div>
            ) : <div className="empty-medications">Nenhum medicamento cadastrado.</div>}
          </section>

          {selected.notes && <section className="notes"><strong>Observação importante</strong><p>{selected.notes}</p></section>}
        </article> : (
          <article className="medical-record empty-family-record">
            <div><span aria-hidden="true">＋</span><p className="eyebrow">Boas-vindas ao FamilyCare</p><h2>Comece sua rede de cuidados</h2><p>Cadastre seu primeiro familiar para manter informações importantes de saúde organizadas e sempre por perto.</p><button className="submit-button" type="button" onClick={openAddRelative}>Cadastrar primeiro familiar</button></div>
          </article>
        )}
      </section>

      <footer><span>familycare</span><p>Seus dados permanecem apenas neste dispositivo nesta versão.</p><button type="button" onClick={() => setShowPrivacy(true)}>Como protegemos seus dados</button></footer>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowForm(false); setEditingId(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">{editingId ? "Atualizar cadastro" : "Nova pessoa"}</p><h2 id="form-title">{editingId ? "Editar familiar" : "Adicionar familiar"}</h2></div><button type="button" aria-label="Fechar" onClick={() => { setShowForm(false); setEditingId(null); }}>×</button></div>
            <form onSubmit={saveRelative}>
              <div className="form-grid">
                <label>Nome completo<input name="name" required placeholder="Ex.: Carlos Almeida" defaultValue={editingRelative?.name ?? ""} /></label>
                <label>Parentesco<input name="relation" required placeholder="Ex.: Avô" defaultValue={editingRelative?.relation ?? ""} /></label>
                <label>Data de nascimento<input name="birthDate" type="date" required defaultValue={editingRelative?.birthDate ?? ""} /></label>
                <label>Tipo sanguíneo<select name="bloodType" required defaultValue={editingRelative?.bloodType ?? ""}><option value="" disabled>Selecione</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"].map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="full">Comorbidades, separadas por vírgula<input name="conditions" placeholder="Hipertensão, diabetes" defaultValue={editingRelative?.conditions.join(", ") ?? ""} /></label>
                <label className="full">Alergias, separadas por vírgula<input name="allergies" placeholder="Dipirona, amoxicilina" defaultValue={editingRelative?.allergies.join(", ") ?? ""} /></label>
              </div>
              {!editingId && <fieldset><legend>Primeiro medicamento, opcional</legend><div className="form-grid three"><label>Nome<input name="medication" placeholder="Losartana" /></label><label>Dose<input name="dosage" placeholder="50 mg" /></label><label>Horário<input name="schedule" placeholder="Pela manhã" /></label></div></fieldset>}
              <label className={editingId ? "edit-notes" : ""}>Observações<textarea name="notes" placeholder="Histórico clínico ou orientação importante" defaultValue={editingRelative?.notes ?? ""} /></label>
              <div className="form-actions"><button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</button><button className="submit-button" type="submit">{editingId ? "Salvar alterações" : "Salvar familiar"}</button></div>
            </form>
          </section>
        </div>
      )}

      {showMedicationForm && selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowMedicationForm(false)}>
          <section className="modal medication-modal" role="dialog" aria-modal="true" aria-labelledby="medication-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">{selected.name}</p><h2 id="medication-form-title">Adicionar medicamento</h2></div><button type="button" aria-label="Fechar" onClick={() => setShowMedicationForm(false)}>×</button></div>
            <form onSubmit={addMedication}>
              <div className="form-grid three">
                <label>Nome<input name="name" required autoFocus placeholder="Ex.: Losartana" /></label>
                <label>Dose<input name="dosage" required placeholder="Ex.: 50 mg" /></label>
                <label>Horário e frequência<input name="schedule" required placeholder="Ex.: Pela manhã" /></label>
              </div>
              <div className="form-actions"><button type="button" onClick={() => setShowMedicationForm(false)}>Cancelar</button><button className="submit-button" type="submit">Adicionar medicamento</button></div>
            </form>
          </section>
        </div>
      )}

      {showPrivacy && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowPrivacy(false)}>
          <section className="modal privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="privacy-symbol">⌂</div><p className="eyebrow">Privacidade desde o início</p><h2 id="privacy-title">Nesta demonstração, os dados ficam no seu aparelho.</h2><p>As informações cadastradas são salvas somente no navegador deste dispositivo. Uma versão de produção deverá incluir acesso protegido, criptografia e consentimento de cada familiar.</p><button className="submit-button" type="button" onClick={() => setShowPrivacy(false)}>Entendi</button>
          </section>
        </div>
      )}
    </main>
  );
}

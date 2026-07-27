"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { addMedicationToList, applyDateMask, createMedication, createRelative, deleteRelative as removeRelative, displayDateToInternal, internalDateToDisplay, normalizeMedication, removeLegacyStarterFamily, removeMedicationFromList, updateMedicationInList, updateRelative, validateBirthDate } from "./family-data.mjs";

type Medication = { name: string; dosage: string; orientation?: string; frequency?: number; schedules?: string[]; schedule?: string };
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

function medicationTiming(medication: Medication) {
  const normalized = normalizeMedication(medication) as Medication;
  return normalized.orientation || "Orientação de uso não informada";
}

function MedicationFields({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
    <div className="form-grid medication-fields">
      <label>Nome<input name="name" required autoFocus={autoFocus} placeholder="Ex.: Losartana" /></label>
      <label>Dosagem ou apresentação<input name="dosage" placeholder="Ex.: 50 mg" /></label>
      <label className="full">Orientação de uso<input name="orientation" placeholder="Ex.: Tomar a cada 8 horas por 7 dias" /></label>
    </div>
  );
}

type RelativeFormProps = { relative?: Relative; isEditing: boolean; onCancel: () => void; onSave: (data: FormData, medications: Medication[]) => void };

function RelativeForm({ relative, isEditing, onCancel, onSave }: RelativeFormProps) {
  const [birthDate, setBirthDate] = useState(() => internalDateToDisplay(relative?.birthDate ?? ""));
  const [birthDateError, setBirthDateError] = useState("");
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationError, setMedicationError] = useState("");
  const [medicationDraft, setMedicationDraft] = useState<Medication>({ name: "", dosage: "", orientation: "" });
  const [editingMedicationIndex, setEditingMedicationIndex] = useState<number | null>(null);

  function addTemporaryMedication() {
    if (!medicationDraft.name.trim()) { setMedicationError("Informe o nome do medicamento antes de adicioná-lo."); return; }
    const medication = { ...medicationDraft, name: medicationDraft.name.trim() };
    setMedications((current) => editingMedicationIndex === null ? addMedicationToList(current, medication) as Medication[] : updateMedicationInList(current, editingMedicationIndex, medication) as Medication[]);
    setMedicationError("");
    setMedicationDraft({ name: "", dosage: "", orientation: "" });
    setEditingMedicationIndex(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateBirthDate(birthDate);
    if (result.error) { setBirthDateError(result.error); return; }
    const data = new FormData(event.currentTarget);
    data.set("birthDate", result.internalDate ?? displayDateToInternal(birthDate));
    onSave(data, medications);
  }

  return <form onSubmit={submit}>
    <div className="form-grid">
      <label>Nome completo<input name="name" required placeholder="Ex.: Carlos Almeida" defaultValue={relative?.name ?? ""} /></label>
      <label>Parentesco<input name="relation" required placeholder="Ex.: Avô" defaultValue={relative?.relation ?? ""} /></label>
      <label>Data de nascimento<input id="birthDate" name="birthDateDisplay" inputMode="numeric" autoComplete="bday" maxLength={10} required value={birthDate} onChange={(event) => { setBirthDate(applyDateMask(event.target.value)); setBirthDateError(""); }} placeholder="DD/MM/AAAA" aria-invalid={Boolean(birthDateError)} aria-describedby={birthDateError ? "birthDate-error" : undefined} />{birthDateError && <span className="field-error" id="birthDate-error" role="alert">{birthDateError}</span>}</label>
      <label>Tipo sanguíneo<select name="bloodType" required defaultValue={relative?.bloodType ?? ""}><option value="" disabled>Selecione</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"].map((type) => <option key={type}>{type}</option>)}</select></label>
      <label className="full">Comorbidades, separadas por vírgula<input name="conditions" placeholder="Hipertensão, diabetes" defaultValue={relative?.conditions.join(", ") ?? ""} /></label>
      <label className="full">Alergias, separadas por vírgula<input name="allergies" placeholder="Dipirona, amoxicilina" defaultValue={relative?.allergies.join(", ") ?? ""} /></label>
    </div>
    {!isEditing && <fieldset><legend>Medicamentos em uso</legend>
      <div className="temporary-medication-form">
        <div className="form-grid medication-fields">
          <label>Nome<input id="temporary-medication-name" value={medicationDraft.name} onChange={(event) => { setMedicationDraft((current) => ({ ...current, name: event.target.value })); setMedicationError(""); }} placeholder="Ex.: Losartana" aria-invalid={Boolean(medicationError)} aria-describedby={medicationError ? "temporary-medication-error" : undefined} /></label>
          <label>Dosagem ou apresentação<input value={medicationDraft.dosage} onChange={(event) => setMedicationDraft((current) => ({ ...current, dosage: event.target.value }))} placeholder="Ex.: 50 mg" /></label>
          <label className="full">Orientação de uso<input value={medicationDraft.orientation ?? ""} onChange={(event) => setMedicationDraft((current) => ({ ...current, orientation: event.target.value }))} placeholder="Ex.: Tomar a cada 8 horas por 7 dias" /></label>
        </div>
        {medicationError && <p className="field-error" id="temporary-medication-error" role="alert">{medicationError}</p>}
        <button className="add-temporary-medication" type="button" onClick={addTemporaryMedication}>{editingMedicationIndex === null ? "Adicionar medicamento" : "Salvar medicamento"}</button>
      </div>
      {medications.length > 0 && <ul className="temporary-medication-list" aria-label="Medicamentos adicionados">{medications.map((medication, index) => <li key={`${medication.name}-${index}`}><span><strong>{medication.name}</strong>{medication.dosage && <small>{medication.dosage}</small>}{medication.orientation && <small>{medication.orientation}</small>}</span><span className="temporary-medication-actions"><button type="button" aria-label={`Editar ${medication.name}`} onClick={() => { setMedicationDraft(medication); setEditingMedicationIndex(index); setMedicationError(""); }}>✎</button><button type="button" aria-label={`Remover ${medication.name}`} onClick={() => { setMedications((current) => removeMedicationFromList(current, index) as Medication[]); if (editingMedicationIndex === index) { setMedicationDraft({ name: "", dosage: "", orientation: "" }); setEditingMedicationIndex(null); } }}>×</button></span></li>)}</ul>}
    </fieldset>}
    <label className={isEditing ? "edit-notes" : ""}>Observações<textarea name="notes" placeholder="Histórico clínico ou orientação importante" defaultValue={relative?.notes ?? ""} /></label>
    <div className="form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="submit-button" type="submit">{isEditing ? "Salvar alterações" : "Salvar familiar"}</button></div>
  </form>;
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
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const moreOptionsRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- This effect hydrates React state from browser storage. */
  useEffect(() => {
    const saved = window.localStorage.getItem("familycare-family");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Relative[];
        const savedFamily = (removeLegacyStarterFamily(parsed) as Relative[]).map((person) => ({
          ...person,
          medications: (Array.isArray(person.medications) ? person.medications : []).map((medication) => normalizeMedication(medication) as Medication).filter((medication) => medication.name),
        }));
        setFamily(savedFamily);
        setSelectedId(savedFamily[0]?.id ?? "");
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

  useEffect(() => {
    if (!showMoreOptions) return;
    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") setShowMoreOptions(false);
      if (event instanceof MouseEvent && !moreOptionsRef.current?.contains(event.target as Node)) setShowMoreOptions(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => { document.removeEventListener("mousedown", closeMenu); document.removeEventListener("keydown", closeMenu); };
  }, [showMoreOptions]);

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
    setShowMoreOptions(false);
    const firstConfirmation = window.confirm(`Tem certeza de que deseja apagar ${selected.name}?`);
    if (!firstConfirmation) return;

    const finalConfirmation = window.confirm(`Confirmação final: todos os dados de ${selected.name}, incluindo medicamentos, serão excluídos definitivamente. Deseja continuar?`);
    if (!finalConfirmation) return;

    const remainingFamily = removeRelative(family, selected.id) as Relative[];
    setFamily(remainingFamily);
    setSelectedId(remainingFamily[0]?.id ?? "");
    if (!remainingFamily.length) setEmergencyMode(false);
  }

  function toggleEmergencyMode() {
    if (selected) setEmergencyMode((current) => !current);
  }

  function saveRelative(data: FormData, medications: Medication[]) {
    if (editingId) {
      setFamily((current) => updateRelative(current, editingId, data) as Relative[]);
      setShowForm(false);
      setEditingId(null);
      return;
    }

    const person = createRelative(data, family.length, crypto.randomUUID(), medications) as Relative;
    setFamily((current) => [...current, person]);
    setSelectedId(person.id);
    setShowForm(false);
  }

  function addMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const medication = createMedication(data) as Medication;
    if (!medication.name) return;
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
        <button className={emergencyMode ? "emergency-top-button active" : "emergency-top-button"} type="button" onClick={toggleEmergencyMode} disabled={!selected} aria-pressed={emergencyMode} aria-describedby={!selected ? "emergency-unavailable" : undefined}>
          <span aria-hidden="true">!</span> {emergencyMode ? "Sair do modo emergência" : "Modo emergência"}
        </button>
        {!selected && <span className="sr-only" id="emergency-unavailable">Cadastre um familiar para usar o modo emergência.</span>}
      </header>

      <section className="app-intro" id="inicio">
        <p>Dados de saúde da família, organizados neste dispositivo.</p>
      </section>

      <section className="workspace" id="familiares">
        <aside className="family-panel">
          <div className="panel-title">
            <div><p className="eyebrow">Minha rede</p><h2>Familiares</h2></div>
            <div className="family-panel-actions"><span>{family.length}</span><button className="add-relative-compact" type="button" onClick={openAddRelative}><span aria-hidden="true">＋</span> Adicionar</button></div>
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
            {!emergencyMode && <div className="record-actions">
              <div className="updated"><span aria-hidden="true">✓</span> Dados salvos neste dispositivo</div>
              <button className="edit-button" type="button" onClick={openEditRelative}><span aria-hidden="true">✎</span> Editar familiar</button>
              <div className="more-options" ref={moreOptionsRef}>
                <button className="more-options-button" type="button" aria-label="Mais opções para este familiar" aria-haspopup="menu" aria-expanded={showMoreOptions} onClick={() => setShowMoreOptions((current) => !current)}>⋯</button>
                {showMoreOptions && <div className="more-options-menu" role="menu" aria-label="Mais opções"><button className="delete-menu-item" type="button" role="menuitem" onClick={deleteRelative}>Excluir familiar</button></div>}
              </div>
            </div>}
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
              <div><p className="eyebrow">{emergencyMode ? "Consulta rápida" : "Uso contínuo"}</p><h3>{emergencyMode ? "Medicamentos em uso" : "Medicamentos"}</h3></div>
              {!emergencyMode && <div className="medication-heading-actions">
                <span>{selected.medications.length} {selected.medications.length === 1 ? "medicamento" : "medicamentos"}</span>
                <button type="button" onClick={() => setShowMedicationForm(true)}><span aria-hidden="true">＋</span> Adicionar</button>
              </div>}
            </div>
            {selected.medications.length ? (
              <div className="medication-list">
                {selected.medications.map((medication, index) => (
                  <div className="medication-row" key={`${medication.name}-${medication.dosage}-${index}`}>
                    <span className="pill-icon" aria-hidden="true">◐</span>
                    <div><strong>{medication.name}</strong><small>{medicationTiming(medication)}</small></div>
                    <b>{medication.dosage}</b>
                    {!emergencyMode && <button className="remove-medication" type="button" aria-label={`Remover ${medication.name}`} title={`Remover ${medication.name}`} onClick={() => removeMedication(index)}>×</button>}
                  </div>
                ))}
              </div>
            ) : <div className="empty-medications">{emergencyMode ? "Nenhum medicamento informado." : "Nenhum medicamento cadastrado."}</div>}
          </section>

          {selected.notes && <section className="notes"><strong>Observação importante</strong><p>{selected.notes}</p></section>}
        </article> : (
          <article className="medical-record empty-family-record">
            <div><span aria-hidden="true">＋</span><p className="eyebrow">Nenhum familiar cadastrado</p><h2>Comece sua rede de cuidados</h2><p>Adicione um familiar para organizar os dados essenciais de saúde.</p><button className="submit-button" type="button" onClick={openAddRelative}>Adicionar familiar</button></div>
          </article>
        )}
      </section>

      <footer><span>familycare</span><p>Seus dados permanecem apenas neste dispositivo nesta versão.</p><button type="button" onClick={() => setShowPrivacy(true)}>Como protegemos seus dados</button></footer>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => { setShowForm(false); setEditingId(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">{editingId ? "Atualizar cadastro" : "Nova pessoa"}</p><h2 id="form-title">{editingId ? "Editar familiar" : "Adicionar familiar"}</h2></div><button type="button" aria-label="Fechar" onClick={() => { setShowForm(false); setEditingId(null); }}>×</button></div>
            <RelativeForm relative={editingRelative} isEditing={Boolean(editingId)} onSave={saveRelative} onCancel={() => { setShowForm(false); setEditingId(null); }} />
          </section>
        </div>
      )}

      {showMedicationForm && selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowMedicationForm(false)}>
          <section className="modal medication-modal" role="dialog" aria-modal="true" aria-labelledby="medication-form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">{selected.name}</p><h2 id="medication-form-title">Adicionar medicamento</h2></div><button type="button" aria-label="Fechar" onClick={() => setShowMedicationForm(false)}>×</button></div>
            <form onSubmit={addMedication}>
              <MedicationFields autoFocus />
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

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

const starterFamily: Relative[] = [
  {
    id: "antonio",
    name: "Antônio Almeida",
    relation: "Pai",
    birthDate: "1958-03-12",
    bloodType: "A+",
    conditions: ["Hipertensão", "Diabetes tipo 2"],
    allergies: ["Dipirona"],
    medications: [
      { name: "Losartana", dosage: "50 mg", schedule: "1x ao dia, pela manhã" },
      { name: "Metformina", dosage: "850 mg", schedule: "Após almoço e jantar" },
      { name: "AAS", dosage: "100 mg", schedule: "1x ao dia" },
    ],
    notes: "Histórico de AVC isquêmico em 2024.",
    color: "#277f7b",
  },
  {
    id: "lucia",
    name: "Lúcia Almeida",
    relation: "Mãe",
    birthDate: "1962-08-24",
    bloodType: "O+",
    conditions: ["Hipotireoidismo"],
    allergies: [],
    medications: [{ name: "Levotiroxina", dosage: "50 mcg", schedule: "Em jejum, pela manhã" }],
    notes: "",
    color: "#8a6fbc",
  },
  {
    id: "marina",
    name: "Marina Almeida",
    relation: "Irmã",
    birthDate: "1991-11-07",
    bloodType: "A-",
    conditions: [],
    allergies: ["Amoxicilina"],
    medications: [],
    notes: "",
    color: "#d7855e",
  },
];

const colors = ["#277f7b", "#8a6fbc", "#d7855e", "#3b6aa0", "#a26371"];

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
  const [family, setFamily] = useState<Relative[]>(starterFamily);
  const [selectedId, setSelectedId] = useState(starterFamily[0].id);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("familycare-family");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Relative[];
        if (parsed.length) {
          setFamily(parsed);
          setSelectedId(parsed[0].id);
        }
      } catch {
        window.localStorage.removeItem("familycare-family");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("familycare-family", JSON.stringify(family));
  }, [family, hydrated]);

  const selected = family.find((person) => person.id === selectedId) ?? family[0];
  const filtered = useMemo(
    () => family.filter((person) => `${person.name} ${person.relation}`.toLowerCase().includes(query.toLowerCase())),
    [family, query],
  );

  function addRelative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const conditions = String(data.get("conditions") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const allergies = String(data.get("allergies") || "").split(",").map((item) => item.trim()).filter(Boolean);
    const medicationName = String(data.get("medication") || "").trim();
    const person: Relative = {
      id: crypto.randomUUID(),
      name: String(data.get("name")),
      relation: String(data.get("relation")),
      birthDate: String(data.get("birthDate")),
      bloodType: String(data.get("bloodType")),
      conditions,
      allergies,
      medications: medicationName
        ? [{ name: medicationName, dosage: String(data.get("dosage") || "Não informada"), schedule: String(data.get("schedule") || "Não informado") }]
        : [],
      notes: String(data.get("notes") || ""),
      color: colors[family.length % colors.length],
    };
    setFamily((current) => [...current, person]);
    setSelectedId(person.id);
    setShowForm(false);
  }

  if (!selected) return null;

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
        <button className="add-button" type="button" onClick={() => setShowForm(true)}>
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
                className={person.id === selected.id ? "person-card selected" : "person-card"}
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

        <article className="medical-record">
          <div className="record-header">
            <div className="identity">
              <span className="avatar avatar-large" style={{ backgroundColor: selected.color }}>{initials(selected.name)}</span>
              <div><span className="relation-label">{selected.relation}</span><h2>{selected.name}</h2><p>{formatDate(selected.birthDate)} · {ageFrom(selected.birthDate)} anos</p></div>
            </div>
            <div className="updated"><span aria-hidden="true">✓</span> Dados salvos neste dispositivo</div>
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
            <div className="section-heading"><div><p className="eyebrow">Uso contínuo</p><h3>Medicamentos</h3></div><span>{selected.medications.length} {selected.medications.length === 1 ? "medicamento" : "medicamentos"}</span></div>
            {selected.medications.length ? (
              <div className="medication-list">
                {selected.medications.map((medication) => (
                  <div className="medication-row" key={`${medication.name}-${medication.dosage}`}>
                    <span className="pill-icon" aria-hidden="true">◐</span>
                    <div><strong>{medication.name}</strong><small>{medication.schedule}</small></div>
                    <b>{medication.dosage}</b>
                  </div>
                ))}
              </div>
            ) : <div className="empty-medications">Nenhum medicamento cadastrado.</div>}
          </section>

          {selected.notes && <section className="notes"><strong>Observação importante</strong><p>{selected.notes}</p></section>}
        </article>
      </section>

      <footer><span>familycare</span><p>Seus dados permanecem apenas neste dispositivo nesta versão.</p><button type="button" onClick={() => setShowPrivacy(true)}>Como protegemos seus dados</button></footer>

      {showForm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowForm(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><p className="eyebrow">Nova pessoa</p><h2 id="form-title">Adicionar familiar</h2></div><button type="button" aria-label="Fechar" onClick={() => setShowForm(false)}>×</button></div>
            <form onSubmit={addRelative}>
              <div className="form-grid">
                <label>Nome completo<input name="name" required placeholder="Ex.: Carlos Almeida" /></label>
                <label>Parentesco<input name="relation" required placeholder="Ex.: Avô" /></label>
                <label>Data de nascimento<input name="birthDate" type="date" required /></label>
                <label>Tipo sanguíneo<select name="bloodType" required defaultValue=""><option value="" disabled>Selecione</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Não sei"].map((type) => <option key={type}>{type}</option>)}</select></label>
                <label className="full">Comorbidades, separadas por vírgula<input name="conditions" placeholder="Hipertensão, diabetes" /></label>
                <label className="full">Alergias, separadas por vírgula<input name="allergies" placeholder="Dipirona, amoxicilina" /></label>
              </div>
              <fieldset><legend>Primeiro medicamento, opcional</legend><div className="form-grid three"><label>Nome<input name="medication" placeholder="Losartana" /></label><label>Dose<input name="dosage" placeholder="50 mg" /></label><label>Horário<input name="schedule" placeholder="Pela manhã" /></label></div></fieldset>
              <label>Observações<textarea name="notes" placeholder="Histórico clínico ou orientação importante" /></label>
              <div className="form-actions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="submit-button" type="submit">Salvar familiar</button></div>
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

export function MedicationFields() {
  return (
    <div className="form-grid medication-fields">
      <label>
        <span className="field-label-text">Nome</span>
        <input name="name" required placeholder="Ex.: Losartana" />
      </label>
      <label>
        Dosagem ou apresentação
        <input name="dosage" placeholder="Ex.: 50 mg" />
      </label>
      <label className="full">
        Orientação de uso
        <input
          name="orientation"
          placeholder="Ex.: Tomar a cada 8 horas por 7 dias"
        />
      </label>
    </div>
  );
}

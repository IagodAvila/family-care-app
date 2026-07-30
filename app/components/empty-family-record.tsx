type EmptyFamilyRecordProps = {
  onAddRelative: () => void;
};

export function EmptyFamilyRecord({ onAddRelative }: EmptyFamilyRecordProps) {
  return (
    <article className="medical-record empty-family-record">
      <div>
        <span aria-hidden="true">＋</span>
        <p className="eyebrow">Nenhum familiar cadastrado</p>
        <h2>Comece sua rede de cuidados</h2>
        <p>Adicione um familiar para organizar os dados essenciais de saúde.</p>
        <button className="submit-button" type="button" onClick={onAddRelative}>
          Adicionar familiar
        </button>
      </div>
    </article>
  );
}

type AppFooterProps = {
  onOpenPrivacy: () => void;
};

export function AppFooter({ onOpenPrivacy }: AppFooterProps) {
  return (
    <footer>
      <span>familycare</span>
      <p>Seus dados permanecem apenas neste dispositivo nesta versão.</p>
      <button type="button" onClick={onOpenPrivacy}>
        Como protegemos seus dados
      </button>
    </footer>
  );
}

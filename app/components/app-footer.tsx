type AppFooterProps = {
  onOpenPrivacy: () => void;
};

export function AppFooter({ onOpenPrivacy }: AppFooterProps) {
  return (
    <footer>
      <span>familycare</span>
      <p>Seus dados ficam protegidos na sua conta, atrás de login.</p>
      <button type="button" onClick={onOpenPrivacy}>
        Como protegemos seus dados
      </button>
    </footer>
  );
}

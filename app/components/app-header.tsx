import type { CurrentUser } from "@/hooks/use-family-store";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type AppHeaderProps = {
  emergencyMode: boolean;
  hasSelectedRelative: boolean;
  user: CurrentUser | null;
  onLogout: () => void;
  onOpenMembers: () => void;
  onOpenPrivacy: () => void;
  onToggleEmergency: () => void;
};

export function AppHeader({
  emergencyMode,
  hasSelectedRelative,
  user,
  onLogout,
  onOpenMembers,
  onOpenPrivacy,
  onToggleEmergency,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <a className="brand" href="#inicio" aria-label="FamilyCare, início">
        <span className="brand-mark" aria-hidden="true">+</span>
        <span>family<span>care</span></span>
      </a>

      <nav className="desktop-nav" aria-label="Navegação principal">
        <a className="active" href="#familiares">Familiares</a>
        <button type="button" onClick={onOpenMembers}>Membros</button>
        <button type="button" onClick={onOpenPrivacy}>Privacidade</button>
      </nav>

      <button
        className={emergencyMode ? "emergency-top-button active" : "emergency-top-button"}
        type="button"
        onClick={onToggleEmergency}
        disabled={!hasSelectedRelative}
        aria-pressed={emergencyMode}
        aria-label={emergencyMode ? "Sair do modo emergência" : "Ativar modo emergência"}
        aria-describedby={!hasSelectedRelative ? "emergency-unavailable" : undefined}
      >
        <span className="emergency-icon" aria-hidden="true">⚠</span>
        {emergencyMode ? (
          <>
            <span className="emergency-label-full">Sair do modo emergência</span>
            <span className="emergency-label-mobile">Sair da emergência</span>
          </>
        ) : "Modo emergência"}
      </button>

      <ThemeToggle />

      {user && <UserMenu user={user} onLogout={onLogout} />}

      {!hasSelectedRelative && (
        <span className="sr-only" id="emergency-unavailable">
          Cadastre um familiar para usar o modo emergência.
        </span>
      )}
    </header>
  );
}

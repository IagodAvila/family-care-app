import type { CurrentUser, FamilyMembership } from "@/hooks/use-family-store";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type AppHeaderProps = {
  user: CurrentUser | null;
  familyId: string | null;
  families: FamilyMembership[];
  onSwitchFamily: (id: string) => void;
  onImportFromFamily: (id: string) => void;
  onLogout: () => void;
  onOpenMembers: () => void;
  onOpenPrivacy: () => void;
};

export function AppHeader({
  user,
  familyId,
  families,
  onSwitchFamily,
  onImportFromFamily,
  onLogout,
  onOpenMembers,
  onOpenPrivacy,
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

      <div className="topbar-actions">
        <ThemeToggle />
        {user && (
          <UserMenu
            user={user}
            familyId={familyId}
            families={families}
            onSwitchFamily={onSwitchFamily}
            onImportFromFamily={onImportFromFamily}
            onLogout={onLogout}
            onOpenMembers={onOpenMembers}
            onOpenPrivacy={onOpenPrivacy}
          />
        )}
      </div>
    </header>
  );
}

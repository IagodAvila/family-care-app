"use client";

import { useEffect, useRef, useState } from "react";
import { getInitials } from "@/lib/family-format";
import type { CurrentUser } from "@/hooks/use-family-store";

type UserMenuProps = {
  user: CurrentUser;
  onLogout: () => void;
};

/**
 * Compact account menu: a fixed-size avatar button (photo or initials, never
 * grows with the user's name) that opens a dropdown with account actions.
 * Replaces showing the name + a "Sair" button inline in the topbar, which
 * could push past the edge of the screen on narrow devices. Follows the same
 * dismissable-popover pattern as the "more options" menu in medical-record.tsx.
 */
export function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);
  const label = user.displayName ?? user.emailNormalized;

  useEffect(() => {
    if (!open) return;
    logoutRef.current?.focus();

    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }

      if (event instanceof MouseEvent && !menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [open]);

  function logout() {
    setOpen(false);
    onLogout();
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu-button"
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-controls="user-menu-popover"
        aria-expanded={open}
        aria-label={`Menu da conta de ${label}`}
        onClick={() => setOpen((current) => !current)}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Google avatar URL, not a local asset.
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">{getInitials(label)}</span>
        )}
      </button>

      {open && (
        <div className="user-menu-popover" id="user-menu-popover" role="menu">
          <div className="user-menu-identity">
            <strong>{user.displayName ?? "Minha conta"}</strong>
            <small>{user.emailNormalized}</small>
          </div>
          <button className="user-menu-item" ref={logoutRef} type="button" role="menuitem" onClick={logout}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

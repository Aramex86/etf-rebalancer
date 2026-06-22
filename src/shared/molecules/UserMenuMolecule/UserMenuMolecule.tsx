// src/shared/molecules/UserMenuMolecule/UserMenuMolecule.tsx
// Displays the authenticated user's avatar/name with a dropdown menu
// (Dashboard / Rules / Predictions / Sign out),
// or a "Войти через Google" login button when unauthenticated.

"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import {
  colors,
  spacing,
  typography,
  radius,
  shadows,
} from "@/shared/ui/tokens";

/** A single navigation entry in the dropdown. */
interface NavEntry {
  label: string;
  href: string;
  icon: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { label: "Дашборд", href: "/", icon: "📊" },
  { label: "Правила", href: "/rules", icon: "⚙️" },
  { label: "Прогнозы", href: "/predictions", icon: "📈" },
];

export function UserMenuMolecule() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close dropdown on route change.
  useEffect(() => {
    // Defer to avoid synchronous setState in effect body.
    queueMicrotask(() => setIsOpen(false));
  }, [pathname]);

  if (status === "loading") {
    return (
      <div
        style={{
          padding: `${spacing[2]} ${spacing[4]}`,
          fontSize: typography.fontSize.sm,
          color: colors.neutral[500],
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        Загрузка…
      </div>
    );
  }

  if (!session) {
    return (
      <ButtonAtom size="sm" onClick={() => signIn("google")}>
        Войти через Google
      </ButtonAtom>
    );
  }

  const user = session.user;
  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "?";

  /** Style for each dropdown menu item. */
  const menuItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    padding: `${spacing[3]} ${spacing[4]}`,
    minHeight: 44, // mobile tap target ≥ 44px
    fontSize: typography.fontSize.sm,
    color: isActive ? colors.brand[700] : colors.neutral[700],
    backgroundColor: isActive ? colors.brand[50] : "transparent",
    textDecoration: "none",
    cursor: "pointer",
    border: "none",
    width: "100%",
    textAlign: "left",
    fontFamily: typography.fontFamily.sans.join(", "),
    fontWeight: isActive
      ? typography.fontWeight.semibold
      : typography.fontWeight.regular,
  });

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex" }}
    >
      {/* Toggle button: avatar + name + chevron */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[2],
          padding: `${spacing[1]} ${spacing[3]}`,
          minHeight: 40,
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: radius.full,
          backgroundColor: colors.neutral[0],
          cursor: "pointer",
          fontFamily: typography.fontFamily.sans.join(", "),
        }}
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? "avatar"}
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.full,
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.full,
              backgroundColor: colors.brand[500],
              color: colors.neutral[0],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: typography.fontSize.xs,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            {initial}
          </div>
        )}
        <span
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.neutral[700],
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user?.name ?? user?.email}
        </span>
        <span
          style={{
            fontSize: typography.fontSize.xs,
            color: colors.neutral[400],
            transition: "transform 150ms",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 200,
            backgroundColor: colors.neutral[0],
            border: `1px solid ${colors.neutral[200]}`,
            borderRadius: radius.md,
            boxShadow: shadows.lg,
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {/* Navigation links */}
          {NAV_ENTRIES.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              style={menuItemStyle(pathname === entry.href)}
            >
              <span>{entry.icon}</span>
              <span>{entry.label}</span>
            </Link>
          ))}

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: colors.neutral[200],
              margin: 0,
            }}
          />

          {/* Sign out */}
          <button
            type="button"
            onClick={() => signOut()}
            style={{
              ...menuItemStyle(false),
              color: colors.danger[700],
            }}
          >
            <span>🚪</span>
            <span>Выйти</span>
          </button>
        </div>
      )}
    </div>
  );
}

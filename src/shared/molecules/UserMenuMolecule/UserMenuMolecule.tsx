// src/shared/molecules/UserMenuMolecule/UserMenuMolecule.tsx
// Displays the authenticated user's avatar/name with a logout button,
// or a "Войти через Google" login button when unauthenticated.

"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { ButtonAtom } from "@/shared/atoms/ButtonAtom";
import { colors, spacing, typography, radius } from "@/shared/ui/tokens";

export function UserMenuMolecule() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div
        style={{
          padding: `${spacing[2]} ${spacing[4]}`,
          fontSize: typography.fontSize.sm,
          color: colors.neutral[500],
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[3],
      }}
    >
      {user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.image}
          alt={user.name ?? "avatar"}
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.full,
            backgroundColor: colors.brand[500],
            color: colors.neutral[0],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: typography.fontSize.sm,
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
          maxWidth: 150,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {user?.name ?? user?.email}
      </span>
      <ButtonAtom size="sm" variant="secondary" onClick={() => signOut()}>
        Выйти
      </ButtonAtom>
    </div>
  );
}

// src/app/predictions/page.tsx

"use client";

import { PredictionsFeature } from "@/features/predictions";
import { UserMenuMolecule } from "@/shared/molecules/UserMenuMolecule";
import { colors, spacing } from "@/shared/ui/tokens";

export default function PredictionsPage() {
  return (
    <>
      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          padding: `${spacing[2]} ${spacing[4]}`,
          borderBottom: `1px solid ${colors.neutral[200]}`,
          backgroundColor: colors.neutral[0],
        }}
      >
        <UserMenuMolecule />
      </header>
      <main
        style={{
          minHeight: "100vh",
          backgroundColor: colors.neutral[50],
          padding: `${spacing[6]} ${spacing[4]}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <PredictionsFeature />
        </div>
      </main>
    </>
  );
}

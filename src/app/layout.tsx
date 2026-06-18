import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/shared/lib/SessionProvider";
import { UserMenuMolecule } from "@/shared/molecules/UserMenuMolecule";
import { colors, spacing } from "@/shared/ui/tokens";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ETF Rebalancer",
  description: "Feature-sliced ETF rebalancer app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <header
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              padding: `${spacing[2]} ${spacing[4]}`,
              borderBottom: `1px solid ${colors.neutral[200]}`,
            }}
          >
            <UserMenuMolecule />
          </header>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

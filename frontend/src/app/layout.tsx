import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { UserProvider } from "@/context/UserContext";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "LienRho Clearinghouse · CSI ORIGIN 2026 PS-5",
  description: "Working-capital multi-attribute clearinghouse for Indian MSMEs and Capital Providers",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning className="antialiased bg-[#F8FAFC] text-[#0F172A] selection:bg-emerald-600 selection:text-white">
        <UserProvider>
          <AppShell>{children}</AppShell>
        </UserProvider>
      </body>
    </html>
  );
}

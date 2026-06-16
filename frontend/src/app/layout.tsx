import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jojo Client Success Portal",
  description: "Internal portal for managing the Jojo AI Receptionist client lifecycle",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}

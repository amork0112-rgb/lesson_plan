import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { DataProvider } from "@/context/store";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Frage Admin Console",
  description: "Internal management system for Frage Academy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased h-screen overflow-hidden bg-gray-50`}>
        <div className="flex h-full">
          <DataProvider>
            <Sidebar />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </DataProvider>
        </div>
      </body>
    </html>
  );
}

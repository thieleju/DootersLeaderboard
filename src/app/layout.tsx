import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { auth } from "~/server/auth";
import { TRPCReactProvider } from "~/trpc/react";
import Header from "./_components/header";
import Footer from "./_components/footer";

export const metadata: Metadata = {
  title: "Dooters Leaderboard",
  description: "Leaderboard and statistics",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-gray-900">
        <TRPCReactProvider session={session}>
          <Header />
          <main className="min-h-[calc(100dvh-4rem)] pb-16">
            <div className="container-max py-8">{children}</div>
          </main>
          <Footer />
        </TRPCReactProvider>
      </body>
    </html>
  );
}

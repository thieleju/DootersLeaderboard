"use client";

import { useState } from "react";

import BackHomeLink from "../_components/back-home-link";
import PlayersTable from "../_components/players-table";

export default function PlayersPage() {
  const [showBackLink, setShowBackLink] = useState(false);

  return (
    <div className="mt-6 mb-20 space-y-4">
      <div className="flex h-5 items-center">
        {showBackLink ? <BackHomeLink /> : null}
      </div>

      <PlayersTable delay={1} onInitialReady={() => setShowBackLink(true)} />
    </div>
  );
}

"use client";

import { useState } from "react";

import BackHomeLink from "./back-home-link";
import QuestsTable from "./quests-table";

interface QuestsPageClientProps {
  onInitialReady?: () => void;
}

export default function QuestsPageClient({
  onInitialReady
}: QuestsPageClientProps) {
  const [showBackLink, setShowBackLink] = useState(false);

  return (
    <div className="mt-6 mb-20 space-y-4">
      <div className="flex h-5 items-center">
        {showBackLink ? <BackHomeLink /> : null}
      </div>

      <QuestsTable
        delay={1}
        onInitialReady={() => {
          setShowBackLink(true);
          onInitialReady?.();
        }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";

import BackHomeLink from "./back-home-link";
import ModerationRunsTable from "./moderation-runs-table";

interface RunsPageClientProps {
  onInitialReady?: () => void;
}

export default function RunsPageClient({
  onInitialReady
}: RunsPageClientProps) {
  const [showBackLink, setShowBackLink] = useState(false);

  return (
    <div className="mt-6 mb-20 space-y-4">
      <div className="flex h-5 items-center">
        {showBackLink ? <BackHomeLink /> : null}
      </div>

      <ModerationRunsTable
        delay={1}
        onInitialReady={() => {
          setShowBackLink(true);
          onInitialReady?.();
        }}
      />
    </div>
  );
}

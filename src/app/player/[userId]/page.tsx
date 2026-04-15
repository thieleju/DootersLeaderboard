"use client";

import { use, useState } from "react";

import BackHomeLink from "~/app/_components/back-home-link";
import PlayerProfileView from "~/app/_components/player-profile-view";

interface PlayerPageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default function PlayerPage({ params }: PlayerPageProps) {
  const [showBackLink, setShowBackLink] = useState(false);
  const { userId } = use(params);

  return (
    <div className="mt-6 mb-20 space-y-4">
      <div className="flex h-5 items-center">
        {showBackLink ? <BackHomeLink /> : null}
      </div>

      <PlayerProfileView
        userId={userId}
        onInitialReady={() => setShowBackLink(true)}
      />
    </div>
  );
}

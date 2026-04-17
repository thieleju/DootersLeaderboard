"use client";

import { useState } from "react";

import BackHomeLink from "./back-home-link";
import AdminBotNotificationsCard from "./admin-bot-notifications-card";
import AdminUsersTable from "./admin-users-table";

interface AdminPageClientProps {
  onInitialReady?: () => void;
}

export default function AdminPageClient({
  onInitialReady
}: AdminPageClientProps) {
  const [showBackLink, setShowBackLink] = useState(false);

  return (
    <div className="mt-6 mb-20 space-y-4">
      <div className="flex h-5 items-center">
        {showBackLink ? <BackHomeLink /> : null}
      </div>

      <AdminUsersTable
        delay={1}
        onInitialReady={() => {
          setShowBackLink(true);
          onInitialReady?.();
        }}
      />

      <AdminBotNotificationsCard delay={1.1} />
    </div>
  );
}

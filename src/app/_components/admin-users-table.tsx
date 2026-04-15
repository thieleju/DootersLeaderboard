"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";

import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";
import DataTable, { DataTableLoadingState } from "./data-table";

interface AdminUsersTableProps {
  delay?: number;
  onInitialReady?: () => void;
}

const roleLabelByRole = {
  runner: "Runner",
  moderator: "Moderator",
  admin: "Admin",
} as const;

const roleToneClassByRole = {
  runner: "border-gray-700 bg-white/5 text-gray-300",
  moderator: "border-amber-300/30 bg-amber-400/10 text-amber-300",
  admin: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
} as const;

const roleButtonClassByRole = {
  runner:
    "border-gray-700 bg-white/5 text-gray-300 hover:border-gray-500 hover:text-white",
  moderator:
    "border-amber-300/30 bg-amber-400/10 text-amber-300 hover:border-amber-200 hover:bg-amber-400/20",
  admin:
    "border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:border-cyan-200 hover:bg-cyan-400/20",
} as const;

export default function AdminUsersTable({
  delay = 0,
  onInitialReady,
}: AdminUsersTableProps) {
  const adminQuery = api.admin.listUsers.useQuery(undefined, {
    staleTime: Infinity,
  });
  const utils = api.useUtils();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!onInitialReady) return;
    if (adminQuery.isLoading) return;

    const rowCount = adminQuery.data?.length ?? 0;
    const totalDelayMs = Math.min(900, 320 + rowCount * 20);
    const timeout = window.setTimeout(() => onInitialReady(), totalDelayMs);

    return () => window.clearTimeout(timeout);
  }, [adminQuery.data, adminQuery.isLoading, onInitialReady]);

  const updateRoleMutation = api.admin.updateUserRole.useMutation({
    onSuccess: async () => {
      setUpdatingUserId(null);
      await Promise.all([
        utils.admin.listUsers.invalidate(),
        utils.players.list.invalidate(),
        utils.players.profile.invalidate(),
      ]);
    },
    onError: () => {
      setUpdatingUserId(null);
    },
  });

  return (
    <AnimatedCard delay={delay} className="p-6 shadow-2xl shadow-black/20">
      <DataTable
        title="Admin"
        description="Manage user roles"
        icon={<ShieldCheck className="h-6 w-6" />}
        iconColor="emerald"
        columns={[
          { key: "user", label: "User" },
          { key: "role", label: "Role", className: "text-center" },
          { key: "actions", label: "Actions", className: "text-center" },
        ]}
      >
        {adminQuery.isLoading ? (
          <DataTableLoadingState columnCount={3} label="Loading users..." />
        ) : (
          <motion.tbody
            key="admin-users-rows"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {(adminQuery.data ?? []).map((user, index) => (
              <motion.tr
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.02 }}
                className="border-b border-gray-800/70 text-sm transition-colors hover:bg-white/5"
              >
                <td className="px-3 py-4 align-middle">
                  <Link
                    href={`/profile/${user.id}`}
                    className="inline-flex items-center gap-3 text-gray-200 transition-colors hover:text-amber-300"
                  >
                    <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-700 bg-white/5">
                      {user.image ? (
                        <Image
                          src={user.image}
                          alt={user.displayName}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound className="h-4 w-4 text-gray-400" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {user.displayName}
                      </span>
                      <span className="block truncate text-xs text-gray-400">
                        {user.username || user.id}
                      </span>
                    </span>
                  </Link>
                </td>

                <td className="px-3 py-4 text-center align-middle">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roleToneClassByRole[user.role]}`}
                  >
                    {roleLabelByRole[user.role]}
                  </span>
                </td>

                <td className="px-3 py-4 text-center align-middle">
                  <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-2">
                    {(
                      Object.keys(roleLabelByRole) as Array<
                        keyof typeof roleLabelByRole
                      >
                    ).map((role) => (
                      <button
                        key={role}
                        type="button"
                        disabled={
                          updatingUserId === user.id || user.role === role
                        }
                        onClick={() => {
                          setUpdatingUserId(user.id);
                          updateRoleMutation.mutate({
                            userId: user.id,
                            role,
                          });
                        }}
                        className={`inline-flex min-w-[5.5rem] items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          user.role === role
                            ? roleButtonClassByRole[role]
                            : "border-gray-700 bg-white/5 text-gray-300 hover:border-amber-400 hover:text-amber-300"
                        }`}
                      >
                        {updatingUserId === user.id && user.role !== role
                          ? "Saving..."
                          : roleLabelByRole[role]}
                      </button>
                    ))}
                  </div>
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        )}
      </DataTable>

      {!adminQuery.isLoading && (adminQuery.data?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700 bg-white/2 p-6 text-center text-sm text-gray-400">
          No users found.
        </div>
      ) : null}
    </AnimatedCard>
  );
}

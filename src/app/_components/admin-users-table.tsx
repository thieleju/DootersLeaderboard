"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";
import DataTable, { DataTableLoadingState } from "./data-table";
import { getRelativeTime } from "./data-table";
import { capitalizeFirst, formatFullDateTime } from "./helpers";

interface AdminUsersTableProps {
  delay?: number;
  onInitialReady?: () => void;
}

const roleLabelByRole = {
  runner: "Runner",
  moderator: "Moderator",
  admin: "Admin"
} as const;

const roleToneClassByRole = {
  runner: "border-gray-700 bg-white/5 text-gray-300",
  moderator: "border-amber-300/30 bg-amber-400/10 text-amber-300",
  admin: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
} as const;

const roleButtonClassByRole = {
  runner:
    "border-gray-700 bg-white/5 text-gray-300 hover:border-gray-500 hover:text-white",
  moderator:
    "border-amber-300/30 bg-amber-400/10 text-amber-300 hover:border-amber-200 hover:bg-amber-400/20",
  admin:
    "border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:border-cyan-200 hover:bg-cyan-400/20"
} as const;

export default function AdminUsersTable({
  delay = 0,
  onInitialReady
}: AdminUsersTableProps) {
  const adminQuery = api.admin.listUsers.useQuery(undefined, {
    staleTime: Infinity
  });
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [savingProfileUserId, setSavingProfileUserId] = useState<string | null>(
    null
  );
  const [profileDrafts, setProfileDrafts] = useState<
    Record<string, { displayName: string; name: string; image: string }>
  >({});

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
        utils.players.profile.invalidate()
      ]);
    },
    onError: () => {
      setUpdatingUserId(null);
    }
  });

  const updateUserProfileMutation = api.admin.updateUserProfile.useMutation({
    onSuccess: async () => {
      setSavingProfileUserId(null);
      await Promise.all([
        utils.admin.listUsers.invalidate(),
        utils.players.list.invalidate(),
        utils.players.profile.invalidate()
      ]);
    },
    onError: () => {
      setSavingProfileUserId(null);
    }
  });

  const getDraft = (user: {
    id: string;
    displayName: string;
    username: string;
    image: string | null;
  }) => {
    return (
      profileDrafts[user.id] ?? {
        displayName: user.displayName,
        name: user.username,
        image: user.image ?? ""
      }
    );
  };

  const setDraftField = (
    userId: string,
    field: "displayName" | "name" | "image",
    value: string,
    fallback: { displayName: string; name: string; image: string }
  ) => {
    setProfileDrafts((prev) => {
      const current = prev[userId] ?? fallback;
      return {
        ...prev,
        [userId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  const hasProfileChanges = (
    user: {
      id: string;
      displayName: string;
      username: string;
      image: string | null;
    },
    draft: { displayName: string; name: string; image: string }
  ) => {
    return (
      draft.displayName.trim() !== (user.displayName ?? "").trim() ||
      draft.name.trim() !== (user.username ?? "").trim() ||
      draft.image.trim() !== (user.image ?? "").trim()
    );
  };

  return (
    <AnimatedCard delay={delay} className="p-6 shadow-2xl shadow-black/20">
      <DataTable
        title="Admin"
        description="Manage users and roles"
        icon={<ShieldCheck className="h-6 w-6" />}
        iconColor="emerald"
        columns={[
          { key: "user", label: "User" },
          { key: "profile", label: "Profile" },
          { key: "role", label: "Role", className: "text-center" },
          {
            key: "last-active",
            label: "Last Active",
            className: "text-center"
          },
          { key: "actions", label: "Actions", className: "text-center" }
        ]}
      >
        {adminQuery.isLoading ? (
          <DataTableLoadingState columnCount={5} label="Loading users..." />
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
                {(() => {
                  const draft = getDraft(user);
                  const hasChanges = hasProfileChanges(user, draft);
                  const isSavingProfile = savingProfileUserId === user.id;

                  return (
                    <>
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

                      <td className="px-3 py-4 align-middle">
                        <div className="mx-auto grid w-full max-w-sm gap-2">
                          <input
                            type="text"
                            value={draft.displayName}
                            onChange={(event) =>
                              setDraftField(
                                user.id,
                                "displayName",
                                event.target.value,
                                {
                                  displayName: user.displayName,
                                  name: user.username,
                                  image: user.image ?? ""
                                }
                              )
                            }
                            placeholder="Display name"
                            className="w-full rounded-md border border-gray-700 bg-white/5 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(event) =>
                              setDraftField(
                                user.id,
                                "name",
                                event.target.value,
                                {
                                  displayName: user.displayName,
                                  name: user.username,
                                  image: user.image ?? ""
                                }
                              )
                            }
                            placeholder="Name"
                            className="w-full rounded-md border border-gray-700 bg-white/5 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={draft.image}
                            onChange={(event) =>
                              setDraftField(
                                user.id,
                                "image",
                                event.target.value,
                                {
                                  displayName: user.displayName,
                                  name: user.username,
                                  image: user.image ?? ""
                                }
                              )
                            }
                            placeholder="Image link"
                            className="w-full rounded-md border border-gray-700 bg-white/5 px-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={!hasChanges || isSavingProfile}
                            onClick={() => {
                              setSavingProfileUserId(user.id);
                              updateUserProfileMutation.mutate({
                                userId: user.id,
                                displayName: draft.displayName,
                                name: draft.name,
                                image: draft.image
                              });
                            }}
                            className="inline-flex w-full items-center justify-center rounded-md border border-gray-700 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingProfile ? "Saving..." : "Save profile"}
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roleToneClassByRole[user.role]}`}
                        >
                          {roleLabelByRole[user.role]}
                        </span>
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        <div className="inline-flex items-center gap-2 text-gray-300">
                          <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                          <div>
                            <div className="text-sm text-gray-200">
                              {(user.lastSeenAtMs ?? user.lastLoginAtMs)
                                ? capitalizeFirst(
                                    getRelativeTime(
                                      user.lastSeenAtMs ??
                                        user.lastLoginAtMs ??
                                        0
                                    )
                                  )
                                : "Never"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(user.lastSeenAtMs ?? user.lastLoginAtMs)
                                ? formatFullDateTime(
                                    user.lastSeenAtMs ?? user.lastLoginAtMs ?? 0
                                  )
                                : "No login recorded"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-2">
                          {(
                            Object.keys(roleLabelByRole) as Array<
                              keyof typeof roleLabelByRole
                            >
                          ).map((role) => {
                            const isSelf = session?.user.id === user.id;

                            return (
                              <button
                                key={role}
                                type="button"
                                disabled={
                                  isSelf ||
                                  updatingUserId === user.id ||
                                  user.role === role
                                }
                                onClick={() => {
                                  setUpdatingUserId(user.id);
                                  updateRoleMutation.mutate({
                                    userId: user.id,
                                    role
                                  });
                                }}
                                className={`inline-flex min-w-[5.5rem] items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                  isSelf
                                    ? "border-gray-700 bg-white/5 text-gray-500"
                                    : user.role === role
                                      ? roleButtonClassByRole[role]
                                      : "border-gray-700 bg-white/5 text-gray-300 hover:border-amber-400 hover:text-amber-300"
                                }`}
                              >
                                {isSelf
                                  ? "Locked"
                                  : updatingUserId === user.id &&
                                      user.role !== role
                                    ? "Saving..."
                                    : roleLabelByRole[role]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </>
                  );
                })()}
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

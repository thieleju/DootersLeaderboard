"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";
import AnimatedCard from "./animated-card";
import DataTable, {
  DataTableLoadingState,
  getRelativeTime
} from "./data-table";
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
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

  const sortedUsers = [...(adminQuery.data ?? [])].sort((left, right) => {
    const leftLastActive = left.lastSeenAtMs ?? left.lastLoginAtMs ?? -1;
    const rightLastActive = right.lastSeenAtMs ?? right.lastLoginAtMs ?? -1;
    return rightLastActive - leftLastActive;
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
          { key: "role", label: "Role", className: "text-center" },
          { key: "user", label: "User" },
          { key: "last-login", label: "Last Login", className: "text-center" },
          { key: "last-active", label: "Last Active", className: "text-center" }
        ]}
      >
        {adminQuery.isLoading ? (
          <DataTableLoadingState columnCount={4} label="Loading users..." />
        ) : (
          <motion.tbody
            key="admin-users-rows"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {sortedUsers.map((user, index) => {
              const isExpanded = expandedUserId === user.id;
              const draft = getDraft(user);
              const hasChanges = hasProfileChanges(user, draft);
              const isSavingProfile = savingProfileUserId === user.id;

              return (
                <AnimatePresence key={user.id} initial={false}>
                  <motion.tr
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className={`group cursor-pointer border-b border-gray-800/70 text-sm transition-colors ${
                      isExpanded ? "bg-white/6" : "hover:bg-white/5"
                    }`}
                    onClick={() => {
                      setExpandedUserId((current) =>
                        current === user.id ? null : user.id
                      );
                    }}
                  >
                    <td className="px-3 py-4 text-center align-middle">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${roleToneClassByRole[user.role]}`}
                      >
                        {user.role === "runner"
                          ? "Runner"
                          : user.role === "moderator"
                            ? "Moderator"
                            : "Admin"}
                      </span>
                    </td>

                    <td className="px-3 py-4 align-middle">
                      <Link
                        href={`/profile/${user.id}`}
                        onClick={(event) => event.stopPropagation()}
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
                      <div className="inline-flex items-center gap-2 text-gray-300">
                        <div>
                          <div className="text-sm text-gray-200">
                            {user.lastLoginAtMs
                              ? capitalizeFirst(
                                  getRelativeTime(user.lastLoginAtMs)
                                )
                              : "Never"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.lastLoginAtMs
                              ? formatFullDateTime(user.lastLoginAtMs)
                              : "No login recorded"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-4 text-center align-middle">
                      <div className="inline-flex items-center gap-2 text-gray-300">
                        <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                        <div>
                          <div className="text-sm text-gray-200">
                            {user.lastSeenAtMs
                              ? capitalizeFirst(
                                  getRelativeTime(user.lastSeenAtMs)
                                )
                              : "Never"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.lastSeenAtMs
                              ? formatFullDateTime(user.lastSeenAtMs)
                              : "No activity recorded"}
                          </div>
                        </div>
                      </div>
                    </td>
                  </motion.tr>

                  {isExpanded ? (
                    <motion.tr
                      initial={{
                        opacity: 0,
                        height: 0,
                        pointerEvents: "none"
                      }}
                      animate={{
                        opacity: 1,
                        height: "auto",
                        pointerEvents: "auto"
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                        pointerEvents: "none"
                      }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="border-b border-gray-800/70 bg-white/[0.03]"
                    >
                      <td colSpan={4} className="px-0 py-0">
                        <div className="grid gap-4 overflow-visible bg-gray-900 px-6 py-6 md:grid-cols-2">
                          <div className="space-y-4">
                            <div>
                              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                Display name
                              </span>
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
                                onClick={(event) => event.stopPropagation()}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                Name
                              </span>
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
                                onClick={(event) => event.stopPropagation()}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                            <div>
                              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                Image link
                              </span>
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
                                onClick={(event) => event.stopPropagation()}
                                className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={!hasChanges || isSavingProfile}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSavingProfileUserId(user.id);
                                updateUserProfileMutation.mutate({
                                  userId: user.id,
                                  displayName: draft.displayName,
                                  name: draft.name,
                                  image: draft.image
                                });
                              }}
                              className="w-full rounded-lg border border-gray-700 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSavingProfile ? "Saving..." : "Save profile"}
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <span className="text-xs tracking-[0.16em] text-gray-500 uppercase">
                                Role
                              </span>
                              <div
                                className="mt-3 flex flex-wrap gap-2"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {(
                                  Object.keys(roleLabelByRole) as Array<
                                    keyof typeof roleLabelByRole
                                  >
                                ).map((role) => {
                                  const isSelf = session?.user.id === user.id;
                                  const isUpdating = updatingUserId === user.id;
                                  const isCurrent = user.role === role;

                                  return (
                                    <button
                                      key={role}
                                      type="button"
                                      disabled={
                                        isSelf || isUpdating || isCurrent
                                      }
                                      onClick={() => {
                                        setUpdatingUserId(user.id);
                                        updateRoleMutation.mutate({
                                          userId: user.id,
                                          role
                                        });
                                      }}
                                      className={`inline-flex min-w-[5.5rem] flex-1 items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        isSelf
                                          ? "border-gray-700 bg-white/5 text-gray-500"
                                          : isCurrent
                                            ? roleButtonClassByRole[role]
                                            : "border-gray-700 bg-white/5 text-gray-300 hover:border-amber-400 hover:text-amber-300"
                                      }`}
                                    >
                                      {isSelf
                                        ? "Locked"
                                        : isUpdating && !isCurrent
                                          ? "Saving..."
                                          : roleLabelByRole[role]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ) : null}
                </AnimatePresence>
              );
            })}
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

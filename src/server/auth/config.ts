import { eq } from "drizzle-orm";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  accounts,
  botNotificationQueue,
  sessions,
  users,
  verificationTokens
} from "~/server/db/schema";
import type { UserRole } from "~/server/types/leaderboard";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
      displayName: string;
      username: string;
    } & DefaultSession["user"];
  }

  interface User {
    displayName?: string;
    username?: string;
    role?: UserRole;
  }
}

function isDiscordAdminAccount(accountId?: string | null) {
  return Boolean(env.DISCORD_ADMIN_ID && accountId === env.DISCORD_ADMIN_ID);
}

type DiscordProfilePayload = {
  id: string;
  avatar?: string | null;
  global_name?: string | null;
  username?: string | null;
};

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  // debug: process.env.NODE_ENV !== "production",
  trustHost: true,
  pages: {
    error: "/auth/error"
  },
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
      authorization: {
        params: {
          scope: "identify"
        }
      },
      profile(profile) {
        const discordProfile = profile as DiscordProfilePayload;
        const avatar = discordProfile.avatar
          ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png?size=128`
          : null;
        const displayName =
          discordProfile.global_name ??
          discordProfile.username ??
          discordProfile.id;
        const role = isDiscordAdminAccount(discordProfile.id)
          ? "admin"
          : "runner";

        return {
          id: discordProfile.id,
          displayName,
          name: discordProfile.username ?? discordProfile.id,
          email: null,
          image: avatar,
          role
        };
      }
    })
    /**
     * ...add more providers here.
     *
     * Most other providers require a bit more work than the Discord provider. For example, the
     * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
     * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
     *
     * @see https://next-auth.js.org/providers/github
     */
  ],
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens
  }),
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        displayName: user.displayName ?? session.user.name ?? "Profile",
        name: user.username ?? "",
        role: user.role ?? "runner"
      }
    })
  },
  events: {
    async signIn({ user, profile, account }) {
      if (account?.provider !== "discord" || !user.id) return;

      // Check if user already exists (to detect first login)
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      const isFirstLogin = existingUser.length === 0;

      const activityAt = new Date();
      const discordProfile = profile as
        | {
            id: string;
            global_name?: string | null;
            username?: string | null;
            avatar?: string | null;
          }
        | undefined;

      const displayName =
        discordProfile?.global_name ??
        discordProfile?.username ??
        user.name ??
        "Profile";
      const username = discordProfile?.username ?? user.name ?? displayName;
      const avatar = discordProfile?.avatar
        ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png?size=128`
        : null;
      const role = isDiscordAdminAccount(account.providerAccountId)
        ? "admin"
        : (user.role ?? "runner");

      await db
        .insert(users)
        .values({
          id: user.id,
          name: username,
          displayName,
          image: avatar,
          role,
          lastLoginAt: activityAt,
          lastSeenAt: activityAt
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            name: username,
            displayName,
            image: avatar,
            role,
            lastLoginAt: activityAt,
            lastSeenAt: activityAt
          }
        });

      // Queue bot notification for first login
      if (isFirstLogin) {
        await db.insert(botNotificationQueue).values({
          eventKey: "user_first_login",
          userId: user.id,
          dataJson: JSON.stringify({
            userId: user.id,
            displayName,
            username
          })
        });
      }
    }
  }
} satisfies NextAuthConfig;

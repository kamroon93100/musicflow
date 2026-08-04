"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type Credentials = z.infer<typeof credentialsSchema>;

/**
 * Email + password login. Server Actions can write cookies, so the session
 * set by createSupabaseServerClient persists and we redirect to /. Errors
 * return a friendly message to the form — never thrown to the client.
 */
export async function login(values: Credentials) {
  const parsed = credentialsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error: "Enter a valid email and a password of at least 8 characters.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect("/");
}

/**
 * Email + password signup. Email confirmation is OFF for dev, so signUp
 * returns a session + user immediately. The `users` mirror row is upserted
 * through the same anon client — the RLS INSERT policy (id = auth.uid())
 * allows it without a service-role key. onConflict: "id" makes the insert
 * idempotent against a duplicate submit racing the first one.
 */
export async function signup(values: Credentials) {
  const parsed = credentialsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error: "Enter a valid email and a password of at least 8 characters.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    return { error: error.message };
  }

  const user = data.user;
  if (user) {
    const { error: insertError } = await supabase
      .from("users")
      .upsert(
        { id: user.id, email: user.email ?? parsed.data.email },
        { onConflict: "id" },
      );

    if (insertError) {
      return {
        error: `Account created, but profile sync failed: ${insertError.message}`,
      };
    }
  }

  redirect("/");
}

/** Signs out and returns to the login page. */
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Current authenticated user, or null. Used by the useUser hook. */
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
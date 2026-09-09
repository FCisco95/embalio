"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSignupAllowed, SIGNUP_CLOSED_MESSAGE } from "@/lib/auth/signup-allowlist";

export interface AuthFormState {
  error?: string;
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." } as const;
  if (password.length < 8) return { error: "Password must be at least 8 characters." } as const;
  return { email, password } as const;
}

export async function signInAction(_prev: AuthFormState | undefined, formData: FormData): Promise<AuthFormState | undefined> {
  const creds = readCredentials(formData);
  if ("error" in creds) return { error: creds.error };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(creds);
  if (error) return { error: error.message };

  redirect("/");
}

export async function signUpAction(_prev: AuthFormState | undefined, formData: FormData): Promise<AuthFormState | undefined> {
  const creds = readCredentials(formData);
  if ("error" in creds) return { error: creds.error };
  // Public URL, Deployment Protection off: sign-up is closed unless the email
  // is on AUTH_SIGNUP_ALLOWLIST. Checked here, not only in the UI — the
  // action is a public POST endpoint whether or not the card renders.
  if (!isSignupAllowed(creds.email, process.env.AUTH_SIGNUP_ALLOWLIST)) return { error: SIGNUP_CLOSED_MESSAGE };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signUp(creds);
  if (error) return { error: error.message };

  redirect("/setup");
}

export async function signOutAction(): Promise<void> {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

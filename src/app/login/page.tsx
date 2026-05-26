"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const [email, setEmail] = useState("");
  const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return (
    <div className="p-6 max-w-sm space-y-3">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <Input placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button onClick={async () => {
        await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        alert("Check your email");
      }}>Send magic link</Button>
    </div>
  );
}

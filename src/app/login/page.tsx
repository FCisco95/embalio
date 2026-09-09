import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSessionUser } from "@/server/auth";

export const metadata = { title: "Login" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Sign in to Embalio</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            The app now runs behind Supabase cookie sessions. Sign in with an existing owner account or create one and continue through setup.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

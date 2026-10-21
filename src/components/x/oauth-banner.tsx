import type { ReactNode } from "react";

const at = (h?: string) => `@${(h ?? "?").replace(/^@/, "")}`;

/**
 * One-line outcome of the X OAuth round trip, read from `/profiles?x=...` (set by
 * /api/x/oauth/callback). Plain <a> for the force link: it is a redirecting route handler
 * and must not be prefetched.
 */
export function XOAuthBanner({
  x,
  handle,
  expected,
  profile,
}: {
  x?: string;
  handle?: string;
  expected?: string;
  profile?: string;
}) {
  let line: ReactNode;
  let tone = "text-muted-foreground";
  switch (x) {
    case "connected":
      line = "Conta X ligada.";
      break;
    case "denied":
      line = "Autorização recusada no X. Nada foi ligado.";
      break;
    case "error":
      line = "Não foi possível ligar a conta X. Tenta de novo.";
      tone = "text-destructive";
      break;
    case "already-linked":
      line = `${at(handle)} já está ligada a outro perfil.`;
      tone = "text-destructive";
      break;
    case "mismatch":
      line = (
        <>
          Autorizaste {at(handle)}, mas este perfil é {at(expected)}. Abre numa janela privada com a conta certa e tenta de novo.
          {profile && (
            <>
              {" "}
              <a
                href={`/api/x/oauth/start?profile=${encodeURIComponent(profile)}&force=1`}
                className="text-primary underline underline-offset-4"
              >
                Ligar mesmo assim
              </a>
            </>
          )}
        </>
      );
      tone = "text-destructive";
      break;
    case "account-changed":
      line = `Este perfil já está ligado a outra conta X (autorizaste ${at(handle)}). Desliga a atual primeiro e volta a ligar.`;
      tone = "text-destructive";
      break;
    default:
      return null;
  }
  return (
    <p role="status" className={`text-[13px] ${tone}`}>
      {line}
    </p>
  );
}

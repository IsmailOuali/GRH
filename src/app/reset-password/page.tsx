import Link from "next/link";
import { XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { hashResetToken } from "@/lib/reset-tokens";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const record = token
    ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } })
    : null;
  const valid = !!record && !record.usedAt && record.expiresAt > new Date();

  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10">
      {valid && token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto mb-3 size-10 text-red-500" />
          <h1 className="text-lg font-semibold text-slate-900">Lien invalide ou expiré</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ce lien de réinitialisation n&apos;est plus valable. Contactez votre administrateur pour en
            recevoir un nouveau.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Retour à la connexion
          </Link>
        </div>
      )}
    </div>
  );
}

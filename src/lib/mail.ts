import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP transport built from environment variables. Kept as a lazily-created
 * singleton so we don't reconnect on every request.
 *
 * Required env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Optional:
 *   SMTP_SECURE ("true" for port 465; defaults to false / STARTTLS on 587)
 */
let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM,
  );
}

function getTransporter(): Transporter {
  if (!isMailConfigured()) {
    throw new Error("SMTP n'est pas configuré (variables SMTP_* manquantes).");
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendPasswordResetEmail(to: string, name: string, link: string): Promise<void> {
  const html = `
    <div style="font-family: system-ui, sans-serif; color: #1e293b; line-height: 1.6;">
      <p>Bonjour ${name},</p>
      <p>Une réinitialisation de votre mot de passe Fair'Up OS a été demandée par votre administrateur.</p>
      <p>
        <a href="${link}"
           style="display:inline-block; background:#4f46e5; color:#fff; padding:10px 18px;
                  border-radius:8px; text-decoration:none; font-weight:600;">
          Choisir un nouveau mot de passe
        </a>
      </p>
      <p style="font-size:13px; color:#64748b;">
        Ce lien est valable 1 heure et à usage unique. Si vous n'êtes pas à l'origine de cette demande,
        ignorez cet email.
      </p>
    </div>`;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Réinitialisation de votre mot de passe — Fair'Up OS",
    html,
    text: `Bonjour ${name},\n\nRéinitialisez votre mot de passe via ce lien (valable 1 heure) :\n${link}\n`,
  });
}

import "server-only";
import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export async function sendAuthEmail(to: string, subject: string, url: string) {
  if (process.env.SMTP_URL) {
    await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
      from: process.env.EMAIL_FROM ?? "Finora <hola@localhost>",
      to,
      subject,
      text: `${subject}\n\nAbrí este enlace para continuar: ${url}\n\nSi no lo solicitaste, ignorá este mensaje.`,
    });
    return;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("Configurá SMTP_URL para entregar emails.");
  const directory = resolve(process.cwd(), "../../.local/mail");
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, `${crypto.randomUUID()}.json`),
    JSON.stringify({ to, subject, url, createdAt: new Date().toISOString() }),
    { mode: 0o600 },
  );
}

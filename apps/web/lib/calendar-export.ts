import { formatMoney, type Currency, type Obligation } from "@finora/core";

function escapeText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r", "");
}
// RFC 5545 lines fold at 75 UTF-8 octets, without splitting a code point.
function fold(line: string) {
  const lines: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) {
      lines.push(current);
      current = " ";
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}
export function calendarExport(events: Obligation[], currency: Currency) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Finora//Calendario financiero//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events.flatMap((event) => {
        const end = new Date(`${event.date}T12:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        return [
          "BEGIN:VEVENT",
          `UID:${encodeURIComponent(event.key)}@finora.local`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`,
          `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll("-", "")}`,
          `SUMMARY:${escapeText(event.description)}`,
          `DESCRIPTION:${escapeText(`${event.type === "income" ? "Ingreso esperado" : "Pago pendiente"}: ${formatMoney(event.amountMinor, currency)}. Exportado desde Finora; confirmar el pago en la aplicación.`)}`,
          "TRANSP:TRANSPARENT",
          "END:VEVENT",
        ];
      }),
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}

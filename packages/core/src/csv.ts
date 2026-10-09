export function parseCsv(text: string): {
  headers: string[];
  rows: string[][];
} {
  if (text.length > 512000) throw new Error("El archivo supera 500 KB.");
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/)[0] ?? "";
  const separator = firstLine.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let index = 0; index < clean.length; index++) {
    const char = clean[index]!;
    if (char === '"') {
      if (quoted && clean[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (quoted) {
        quoted = false;
        closed = true;
      } else if (!cell && !closed) quoted = true;
      else throw new Error("Comillas inválidas en el CSV.");
    } else if (
      !quoted &&
      (char === separator || char === "\n" || char === "\r")
    ) {
      row.push(cell);
      cell = "";
      closed = false;
      if (char !== separator) {
        if (char === "\r" && clean[index + 1] === "\n") index++;
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
      }
    } else {
      if (closed && !/^\s$/.test(char))
        throw new Error("Contenido después de una celda entre comillas.");
      if (!closed) cell += char;
    }
  }
  if (quoted) throw new Error("Una celda quedó sin cerrar.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim()) ?? [];
  if (
    !headers.length ||
    rows.length > 2000 ||
    new Set(headers).size !== headers.length
  )
    throw new Error(
      "El CSV necesita encabezados únicos y hasta 2000 movimientos.",
    );
  if (rows.some((r) => r.length !== headers.length))
    throw new Error("Hay filas con distinta cantidad de columnas.");
  return { headers, rows };
}

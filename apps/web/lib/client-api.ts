export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "No pudimos conectar con el servidor." }));
  if (!response.ok) {
    if (response.status === 401) window.location.assign("/ingresar");
    throw new Error(data.error ?? "No pudimos completar la operación.");
  }
  return data as T;
}
export function decimalInput(minor: string) {
  const value = BigInt(minor),
    absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n},${(absolute % 100n).toString().padStart(2, "0")}`;
}
export function dateLabel(date: string, full = false) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: full ? "long" : "short",
    ...(full ? { year: "numeric" } : {}),
  }).format(new Date(`${date}T12:00:00`));
}

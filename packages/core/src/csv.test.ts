import { describe, it, expect } from "vitest";
import { parseCsv } from "./csv";
describe("importación CSV", () => {
  it("admite comas y saltos dentro de campos entre comillas", () => {
    expect(
      parseCsv(
        'date,description,amount\r\n2026-10-09,"Café, pan",10.20\r\n2026-10-09,"Dos\nlineas",11',
      ),
    ).toEqual({
      headers: ["date", "description", "amount"],
      rows: [
        ["2026-10-09", "Café, pan", "10.20"],
        ["2026-10-09", "Dos\nlineas", "11"],
      ],
    });
  });
  it("admite BOM, punto y coma y coma decimal", () => {
    expect(parseCsv("\uFEFFfecha;importe\n2026-10-09;10,20").rows[0]).toEqual([
      "2026-10-09",
      "10,20",
    ]);
  });
  it("rechaza comillas abiertas y columnas inconsistentes", () => {
    expect(() => parseCsv('a,b\n"ab,20')).toThrow();
    expect(() => parseCsv("a,b\n1,2,3")).toThrow();
  });
});

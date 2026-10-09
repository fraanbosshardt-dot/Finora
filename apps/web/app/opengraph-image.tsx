import { ImageResponse } from "next/og";
export const alt = "Finora · Sabé cuánto podés gastar antes de gastar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#f7f8fa",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: 80,
        color: "#111827",
      }}
    >
      <div style={{ color: "#0f766e", fontSize: 44, fontWeight: 700 }}>
        finora.
      </div>
      <div
        style={{
          fontSize: 74,
          fontWeight: 700,
          marginTop: 70,
          lineHeight: 1.15,
        }}
      >
        Sabé cuánto podés gastar.
      </div>
      <div style={{ fontSize: 74, fontWeight: 700, color: "#0f766e" }}>
        Antes de gastar.
      </div>
      <div style={{ fontSize: 28, marginTop: 40, color: "#667085" }}>
        Tu dinero, con claridad.
      </div>
    </div>,
    size,
  );
}

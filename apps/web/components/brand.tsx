import Link from "next/link";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Finora inicio">
      <span className="brand-icon">f</span>finora
      <span className="brand-dot">.</span>
    </Link>
  );
}

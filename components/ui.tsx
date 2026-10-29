import type { Supplier } from "@/lib/types";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden
      className="brand-mark"
    >
      <path
        d="M5.5 3.5h11.2L22 8.8v15.7H5.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M16.7 3.5v5.3H22" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.2 12.3h9.1M9.2 16.1h9.1M9.2 19.9h5.7" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="21.5" cy="6.5" r="3.4" fill="var(--stamp)" />
      <circle cx="21.5" cy="6.5" r="2.3" stroke="var(--paper)" strokeWidth="0.7" opacity="0.7" />
    </svg>
  );
}

export function SupplierMark({ supplier, size = 34 }: { supplier: Supplier; size?: number }) {
  return (
    <span
      className="supplier-mark"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${supplier.accent} 14%, var(--paper-raised))`,
        color: supplier.accent,
      }}
      aria-hidden
    >
      {supplier.shortName.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function Stamp({
  children,
  tone = "red",
  rotate = -3,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "ink";
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={`stamp stamp-${tone} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "live" }: { tone?: "live" | "done" | "warn" | "idle" }) {
  return <span className={`dot ${tone === "live" ? "dot-live" : tone === "done" ? "dot-done" : tone === "warn" ? "dot-warn" : ""}`} />;
}

export function FileTab({ children, tone = "paper" }: { children: React.ReactNode; tone?: "paper" | "dark" }) {
  return <span className={`file-tab file-tab-${tone}`}>{children}</span>;
}

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Placeholder({
  label,
  ratio,
  className = "",
  style,
}: {
  label?: string;
  ratio?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`placeholder ${className}`} style={style} role="img" aria-label={label || "placeholder image"}>
      {label && <span className="mono placeholder-label">{label}</span>}
      {ratio && <span className="mono placeholder-ratio">{ratio}</span>}
    </div>
  );
}

export function Button({
  variant = "primary",
  full,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger-ghost" | "dashed";
  full?: boolean;
}) {
  return (
    <button
      className={`btn btn-${variant} ${full ? "btn-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({
  selected,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button className={`chip ${selected ? "chip-selected" : ""} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="section-label">{children}</div>;
}

export function Spinner({ size = 80 }: { size?: number }) {
  return (
    <div
      className="spinner"
      style={{ width: size, height: size, borderWidth: Math.max(2, size / 40) }}
      aria-label="Loading"
      role="status"
    />
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

export function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="score-ring"
      style={{
        background: `conic-gradient(var(--accent) 0 ${score}%, rgba(255,255,255,.08) ${score}% 100%)`,
      }}
    >
      <div className="score-ring-inner mono">{score}</div>
    </div>
  );
}

export function CreditPill({ credits, onClick }: { credits: string; onClick?: () => void }) {
  return (
    <button className="credit-pill" onClick={onClick} aria-label="Billing and subscription">
      <span className="credit-dot" />
      <span className="mono">{credits}</span>
    </button>
  );
}

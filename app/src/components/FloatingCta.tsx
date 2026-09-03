export function FloatingCta({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="floating-cta-wrap">
      <button className="floating-cta" onClick={onClick}>
        {label}
      </button>
    </div>
  );
}

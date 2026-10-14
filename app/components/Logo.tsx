export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20 88V47a30 30 0 0 1 60 0v41"
        stroke="var(--brand-maroon)"
        strokeWidth="11"
        fill="none"
      />
      <path d="M44 14h12l-4 24h-4z" fill="var(--brand-maroon)" />
      <rect x="12" y="86" width="76" height="9" fill="var(--brand-maroon)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="h-9 w-px" style={{ background: "var(--brand-maroon)", opacity: 0.4 }} />
      <div className="leading-none">
        <div className="wordmark text-[19px] font-semibold">Realty Enhanced</div>
        <div className="wordmark-sub text-[8.5px] mt-1 opacity-80">
          Intelligent assistant
        </div>
      </div>
    </div>
  );
}

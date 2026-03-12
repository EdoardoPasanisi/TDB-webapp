type OpenDetailsHintProps = {
  label?: string;
};

export function OpenDetailsHint({ label = 'Dettagli' }: OpenDetailsHintProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,130,0,0.45)] bg-[rgba(255,130,0,0.14)] px-3 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" aria-hidden="true" />
      <span className="ui-muted font-[var(--font-weight-semibold)] text-[var(--text)]">{label}</span>
      <span className="text-[var(--text)] leading-none" aria-hidden="true">
        →
      </span>
    </span>
  );
}

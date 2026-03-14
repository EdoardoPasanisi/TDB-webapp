type OpenDetailsHintProps = {
  label?: string;
};

export function OpenDetailsHint({ label = 'Dettagli' }: OpenDetailsHintProps) {
  return (
    <span className="ui-openDetailsHint">
      <span className="ui-openDetailsHint__dot" aria-hidden="true" />
      <span className="ui-openDetailsHint__label">{label}</span>
      <span className="ui-openDetailsHint__arrow" aria-hidden="true">
        →
      </span>
    </span>
  );
}

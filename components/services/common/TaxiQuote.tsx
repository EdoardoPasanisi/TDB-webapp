type TaxiQuoteProps = {
  km: number;
  priceEur: number;
};

export function TaxiQuote({ km, priceEur }: TaxiQuoteProps) {
  return (
    <div className="ui-panelInset ui-taxiQuote p-3 space-y-1">
      <div className="ui-body">
        Distanza: <span className="font-[var(--font-weight-semibold)]">{km.toFixed(1)} km</span>
      </div>
      <div className="ui-body">
        Prezzo: <span className="font-[var(--font-weight-semibold)]">{priceEur.toFixed(2)} €</span>
      </div>
    </div>
  );
}

'use client';

import type { AdminBookingDetail } from '@/lib/admin/types';
import {
  formatAccommodationTypeLabel,
  formatDateTime,
  formatEuro,
  formatTaxiOptionLabel,
} from '@/components/admin/shared';

// Riepilogo prenotazione pensione ottimizzato per la stampa.
// Gerarchia: arrivo/partenza, pet, proprietario e totale GRANDI; sistemazione,
// altri servizi (incl. taxi) e terapia in evidenza media; il resto più piccolo.
export function PrintPensioneCard({ detail }: { detail: AdminBookingDetail }) {
  const petNames = detail.dogs.map((dog) => dog.name).join(' · ') || 'Pet';
  const therapyDogs = detail.dogs.filter((dog) => dog.extras?.therapyActive);

  const extrasLines: string[] = [];
  for (const dog of detail.dogs) {
    const e = dog.extras;
    if (!e) continue;
    const parts: string[] = [];
    if (e.grooming) parts.push('Toelettatura');
    if (e.vaccine) parts.push('Vaccinazione');
    if ((e.trackingSessions ?? 0) > 0) parts.push(`Ricerca olfattiva x${e.trackingSessions}`);
    if ((e.fitnessSessions ?? 0) > 0) parts.push(`Fitness x${e.fitnessSessions}`);
    if ((e.walkSessions ?? 0) > 0) parts.push(`Passeggiate x${e.walkSessions}`);
    if ((e.trekkingSessions ?? 0) > 0) parts.push(`Trekking x${e.trekkingSessions}`);
    if (parts.length) extrasLines.push(`${dog.name}: ${parts.join(', ')}`);
  }
  if (detail.taxi.enabled) {
    extrasLines.push(`Taxi dog: ${formatTaxiOptionLabel(detail.taxi.option) ?? 'attivo'}`);
  }

  return (
    <article className="print-card">
      <div className="print-hero">
        <div className="print-hero-item">
          <div className="print-label">Arrivo</div>
          <div className="print-big">{formatDateTime(detail.startAt)}</div>
        </div>
        <div className="print-hero-item">
          <div className="print-label">Partenza</div>
          <div className="print-big">{detail.endAt ? formatDateTime(detail.endAt) : '—'}</div>
        </div>
      </div>

      <div className="print-hero">
        <div className="print-hero-item">
          <div className="print-label">Pet</div>
          <div className="print-big">{petNames}</div>
        </div>
        <div className="print-hero-item">
          <div className="print-label">Proprietario</div>
          <div className="print-big">{detail.user.fullName}</div>
        </div>
      </div>

      <div className="print-total">
        <span className="print-label">Saldo / Totale</span>
        <span className="print-total-value">{detail.totalPrice !== null ? formatEuro(detail.totalPrice) : '—'}</span>
      </div>

      <div className="print-section">
        <div className="print-section-title">Sistemazione</div>
        {detail.dogs.map((dog) => (
          <div key={dog.dogId} className="print-row">
            <strong>{dog.name}</strong>: {formatAccommodationTypeLabel(dog.pricing.accommodationType) ?? '—'}
          </div>
        ))}
      </div>

      <div className="print-section">
        <div className="print-section-title">Altri servizi</div>
        {extrasLines.length ? (
          extrasLines.map((line) => (
            <div key={line} className="print-row">{line}</div>
          ))
        ) : (
          <div className="print-row print-muted">Nessun servizio extra</div>
        )}
      </div>

      {therapyDogs.length ? (
        <div className="print-section">
          <div className="print-section-title">Terapia</div>
          {therapyDogs.map((dog) => (
            <div key={dog.dogId} className="print-row">
              <strong>{dog.name}</strong>: {dog.extras?.therapyNotes?.trim() || 'Terapia attiva'}
            </div>
          ))}
        </div>
      ) : null}

      <div className="print-section print-minor">
        <div className="print-row">Telefono: {detail.user.phone ?? '—'}</div>
        <div className="print-row">
          Indirizzo servizi: {[detail.user.dogAddressLine, detail.user.dogZipCode, detail.user.dogCity, detail.user.dogProvince]
            .map((v) => (v ?? '').trim())
            .filter(Boolean)
            .join(', ') || '—'}
        </div>
        {detail.dogs.map((dog) => (
          <div key={dog.dogId} className="print-row">
            {dog.name} — microchip: {dog.microchip ?? '—'}
          </div>
        ))}
        {detail.notes ? <div className="print-row">Note: {detail.notes}</div> : null}
      </div>
    </article>
  );
}

// FILE: components/profile/ProfileDetails.tsx
import type { FormEvent } from 'react';
import type { Profile as ProfileRow } from '@/types/profile';
import type { ProfileFormState } from '@/types/forms';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface ProfileDetailsProps {
  userEmail: string;
  profile: ProfileRow | null;
  profileEditing: boolean;
  profileForm: ProfileFormState;
  savingProfile: boolean;

  onChangeText: (field: keyof ProfileFormState, value: string) => void;
  onToggle: (field: keyof ProfileFormState, value: boolean) => void;
  onSubmit: (event: FormEvent) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
}

function formatAddressLine(
  address_line?: string | null,
  zip_code?: string | null,
  city?: string | null,
  province?: string | null
): string {
  const parts: string[] = [];
  if (address_line) parts.push(address_line);
  const cityLine = [zip_code, city].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (province) parts.push(`(${province})`);
  return parts.join(', ');
}

const inputBase =
  'w-full h-11 rounded-[var(--radius)] border border-[var(--border)] bg-white px-3 text-[length:var(--font-size-md)] text-[var(--text)] ' +
  'focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/30';

const labelBase = 'block ui-label';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="ui-muted shrink-0">{label}</span>
      <span className="ui-body font-[var(--font-weight-semibold)] text-right break-words">{value || '—'}</span>
    </div>
  );
}

export function ProfileDetails({
  userEmail,
  profile,
  profileEditing,
  profileForm,
  savingProfile,
  onChangeText,
  onToggle,
  onSubmit,
  onStartEdit,
  onCancelEdit,
}: ProfileDetailsProps) {
  const ownerNamePreview = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();

  const homeAddressPreview = formatAddressLine(
    profile?.address_line ?? null,
    profile?.zip_code ?? null,
    profile?.city ?? null,
    profile?.province ?? null
  );

  const dogAddressPreview = formatAddressLine(
    profile?.dog_address_line ?? null,
    profile?.dog_zip_code ?? null,
    profile?.dog_city ?? null,
    profile?.dog_province ?? null
  );

  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeader
          title="Dati personali"
          subtitle={profile ? 'Gestisci i tuoi dati per servizi e documenti' : 'Completa i tuoi dati per continuare'}
          action={
            !profileEditing ? (
              <Button variant="secondary" onClick={onStartEdit}>
                {profile ? 'Modifica' : 'Completa'}
              </Button>
            ) : null
          }
        />

        {!profileEditing ? (
          <div className="space-y-3">
            {profile ? (
              <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white divide-y divide-[var(--border)] overflow-hidden">
                <div className="p-3 space-y-2">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Contatti</p>
                  <DetailRow label="Nome e cognome" value={ownerNamePreview || '—'} />
                  <DetailRow label="Telefono" value={profile.phone ?? '—'} />
                  <DetailRow label="Email" value={profile.email ?? userEmail ?? '—'} />
                </div>

                <div className="p-3 space-y-2">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Indirizzi</p>
                  <DetailRow label="Casa" value={homeAddressPreview || '—'} />
                  <DetailRow label="Ritiro/servizi" value={dogAddressPreview || '—'} />
                </div>

                <div className="p-3 space-y-2">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Anagrafica</p>
                  <DetailRow label="Codice fiscale" value={profile.fiscal_code ?? '—'} />
                  <DetailRow label="Data di nascita" value={profile.birth_date ?? '—'} />
                </div>
              </div>
            ) : (
              <p className="ui-body">
                Non hai ancora completato i tuoi dati. Tocca “Completa” per inserirli.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelBase}>Nome</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={(e) => onChangeText('first_name', e.target.value)}
                  className={inputBase}
                />
              </div>

              <div className="space-y-1">
                <label className={labelBase}>Cognome</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={(e) => onChangeText('last_name', e.target.value)}
                  className={inputBase}
                />
              </div>

              <div className="space-y-1">
                <label className={labelBase}>Telefono</label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => onChangeText('phone', e.target.value)}
                  className={inputBase}
                />
              </div>

              <div className="space-y-1">
                <label className={labelBase}>Email (per contatti)</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => onChangeText('email', e.target.value)}
                  className={inputBase}
                />
              </div>

              {/* Indirizzo casa */}
              <div className="space-y-2 sm:col-span-2">
                <p className="ui-body font-[var(--font-weight-semibold)]">Indirizzo di casa</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className={labelBase}>Via / indirizzo</label>
                    <input
                      type="text"
                      value={profileForm.address_line}
                      onChange={(e) => onChangeText('address_line', e.target.value)}
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Città</label>
                    <input
                      type="text"
                      value={profileForm.city}
                      onChange={(e) => onChangeText('city', e.target.value)}
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>CAP</label>
                    <input
                      type="text"
                      value={profileForm.zip_code}
                      onChange={(e) => onChangeText('zip_code', e.target.value)}
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Provincia</label>
                    <input
                      type="text"
                      value={profileForm.province}
                      onChange={(e) => onChangeText('province', e.target.value)}
                      className={inputBase}
                    />
                  </div>
                </div>
              </div>

              {/* Indirizzo ritiro/servizi */}
              <div className="space-y-2 sm:col-span-2">
                <p className="ui-body font-[var(--font-weight-semibold)]">Indirizzo ritiro/servizi</p>

                <label className="flex items-center gap-2 ui-body">
                  <input
                    type="checkbox"
                    checked={profileForm.dog_address_same_as_home}
                    onChange={(e) => onToggle('dog_address_same_as_home', e.target.checked)}
                    className="h-4 w-4 accent-[var(--brand-accent)]"
                  />
                  Usa l&apos;indirizzo di casa
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className={labelBase}>Via / indirizzo</label>
                    <input
                      type="text"
                      value={profileForm.dog_address_line}
                      onChange={(e) => onChangeText('dog_address_line', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={`${inputBase} disabled:bg-gray-100`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Città</label>
                    <input
                      type="text"
                      value={profileForm.dog_city}
                      onChange={(e) => onChangeText('dog_city', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={`${inputBase} disabled:bg-gray-100`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>CAP</label>
                    <input
                      type="text"
                      value={profileForm.dog_zip_code}
                      onChange={(e) => onChangeText('dog_zip_code', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={`${inputBase} disabled:bg-gray-100`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Provincia</label>
                    <input
                      type="text"
                      value={profileForm.dog_province}
                      onChange={(e) => onChangeText('dog_province', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={`${inputBase} disabled:bg-gray-100`}
                    />
                  </div>
                </div>
              </div>

              {/* CF */}
              <div className="sm:col-span-2">
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-3 space-y-2">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Codice fiscale</p>
                  <input
                    type="text"
                    value={profileForm.fiscal_code}
                    onChange={(e) => {
                      onChangeText('fiscal_code', e.target.value);
                    }}
                    className={`${inputBase} uppercase`}
                    placeholder="RSSMRA80A01H501U"
                  />
                  <p className="ui-muted">Usato per liberatoria/servizi.</p>
                </div>
              </div>

              {/* Birth date */}
              <div className="sm:col-span-2">
                <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-3 space-y-2">
                  <p className="ui-body font-[var(--font-weight-semibold)]">Data di nascita</p>
                  <input
                    type="date"
                    value={profileForm.birth_date}
                    onChange={(e) => onChangeText('birth_date', e.target.value)}
                    className={inputBase}
                  />
                  <p className="ui-muted">Usata per liberatoria/servizi.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" disabled={savingProfile}>
                {savingProfile ? 'Salvataggio…' : 'Salva'}
              </Button>

              <Button type="button" variant="secondary" onClick={onCancelEdit}>
                Annulla
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

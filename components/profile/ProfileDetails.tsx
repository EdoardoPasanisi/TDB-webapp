// FILE: components/profile/ProfileDetails.tsx
import type { FormEvent, ReactNode } from 'react';
import type { AddressSuggestion } from '@/lib/address/addressSearch';
import type { Profile as ProfileRow } from '@/types/profile';
import type { ProfileFormState } from '@/types/forms';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

type AddressAutocompleteConfig = {
  active: boolean;
  loading: boolean;
  error: string | null;
  suggestions: AddressSuggestion[];
  onFocus: () => void;
  onBlur: () => void;
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
};

interface ProfileDetailsProps {
  userEmail: string;
  profile: ProfileRow | null;
  profileEditing: boolean;
  profileForm: ProfileFormState;
  savingProfile: boolean;
  canEdit?: boolean;
  residenceAddressAutocomplete?: AddressAutocompleteConfig;
  serviceAddressAutocomplete?: AddressAutocompleteConfig;

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

const inputBase = 'ui-control ui-input';

const labelBase = 'block ui-label';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="ui-muted shrink-0">{label}</span>
      <span className="ui-body font-[var(--font-weight-semibold)] text-right break-words">{value || '—'}</span>
    </div>
  );
}

function DetailsBlock({
  title,
  subtitle,
  toneClass = '',
  children,
}: {
  title: string;
  subtitle?: string | null;
  toneClass?: string;
  children: ReactNode;
}) {
  return (
    <div className={`ui-panelInset rounded-[var(--radius)] p-4 space-y-3 ${toneClass}`.trim()}>
      <div className="space-y-1">
        <div className="ui-body font-[var(--font-weight-bold)]">{title}</div>
        {subtitle ? <div className="ui-muted">{subtitle}</div> : null}
      </div>
      {children}
    </div>
  );
}

function AddressSuggestions({
  config,
}: {
  config?: AddressAutocompleteConfig;
}) {
  if (!config?.active) return null;

  return (
    <div className="ui-panelInset overflow-hidden">
      {config.loading ? (
        <div className="px-3 py-2 ui-muted">Sto cercando l’indirizzo…</div>
      ) : config.error ? (
        <div className="px-3 py-2 ui-dangerText">{config.error}</div>
      ) : config.suggestions.length > 0 ? (
        <div className="divide-y divide-[rgba(255,255,255,0.08)]">
          {config.suggestions.map((suggestion) => (
            <button
              key={[
                suggestion.dog_address_line,
                suggestion.dog_city,
                suggestion.dog_zip_code,
                suggestion.dog_province,
              ].join('|')}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => config.onSelectSuggestion(suggestion)}
              className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-[rgba(255,130,0,0.08)]"
            >
              <div className="space-y-1">
                <div className="ui-body font-[var(--font-weight-semibold)]">
                  {suggestion.dog_address_line}
                </div>
                <div className="ui-muted">{suggestion.label}</div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 ui-muted">
          Nessun indirizzo trovato. Puoi continuare a compilarlo a mano.
        </div>
      )}
    </div>
  );
}

export function ProfileDetails({
  userEmail,
  profile,
  profileEditing,
  profileForm,
  savingProfile,
  canEdit = true,
  residenceAddressAutocomplete,
  serviceAddressAutocomplete,
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
            canEdit && !profileEditing ? (
              <Button variant="secondary" onClick={onStartEdit}>
                {profile ? 'Modifica' : 'Completa'}
              </Button>
            ) : null
          }
        />

        {!profileEditing ? (
          <div className="space-y-3">
            {profile ? (
              <div className="grid grid-cols-1 gap-3">
                <DetailsBlock
                  title="Contatti"
                  subtitle="Dati usati per comunicazioni e conferme."
                  toneClass="border-[rgba(255,130,0,0.22)] bg-[linear-gradient(180deg,rgba(255,130,0,0.08),rgba(20,24,23,0.94))]"
                >
                  <div className="space-y-2">
                    <DetailRow label="Nome e cognome" value={ownerNamePreview || '—'} />
                    <DetailRow label="Telefono" value={profile.phone ?? '—'} />
                    <DetailRow label="Email" value={profile.email ?? userEmail ?? '—'} />
                  </div>
                </DetailsBlock>

                <DetailsBlock
                  title="Residenza"
                  subtitle="Riferimento anagrafico principale."
                  toneClass="border-[rgba(59,130,246,0.22)] bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(20,24,23,0.94))]"
                >
                  <DetailRow label="Indirizzo" value={homeAddressPreview || '—'} />
                </DetailsBlock>

                <DetailsBlock
                  title="Indirizzo ritiro/servizi"
                  subtitle="Usato per taxi dog e servizi collegati."
                  toneClass="border-[rgba(34,197,94,0.22)] bg-[linear-gradient(180deg,rgba(34,197,94,0.08),rgba(20,24,23,0.94))]"
                >
                  <DetailRow label="Indirizzo" value={dogAddressPreview || '—'} />
                </DetailsBlock>

                <DetailsBlock
                  title="Anagrafica"
                  subtitle="Dati richiesti per liberatoria e gestione servizi."
                  toneClass="border-[rgba(168,85,247,0.22)] bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(20,24,23,0.94))]"
                >
                  <div className="space-y-2">
                    <DetailRow label="Codice fiscale" value={profile.fiscal_code ?? '—'} />
                    <DetailRow label="Data di nascita" value={profile.birth_date ?? '—'} />
                  </div>
                </DetailsBlock>
              </div>
            ) : (
              <p className="ui-body">
                Non hai ancora completato i tuoi dati. Tocca “Completa” per inserirli.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-4">
              <DetailsBlock
                title="Contatti"
                subtitle="Le informazioni principali del proprietario."
                toneClass="border-[rgba(255,130,0,0.22)] bg-[linear-gradient(180deg,rgba(255,130,0,0.08),rgba(20,24,23,0.94))]"
              >
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
                </div>
              </DetailsBlock>

              <DetailsBlock
                title="Residenza"
                subtitle="Riferimento principale dell’anagrafica."
                toneClass="border-[rgba(59,130,246,0.22)] bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(20,24,23,0.94))]"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className={labelBase}>Via / indirizzo</label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={profileForm.address_line}
                        onChange={(e) => onChangeText('address_line', e.target.value)}
                        onFocus={residenceAddressAutocomplete?.onFocus}
                        onBlur={residenceAddressAutocomplete?.onBlur}
                        className={inputBase}
                        placeholder="Inizia a scrivere la via"
                        autoComplete="off"
                      />
                      <AddressSuggestions config={residenceAddressAutocomplete} />
                      <p className="ui-muted">
                        Seleziona un suggerimento per compilare automaticamente città, CAP e provincia.
                      </p>
                    </div>
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
              </DetailsBlock>

              <DetailsBlock
                title="Indirizzo ritiro/servizi"
                subtitle="Usato per taxi dog e servizi che richiedono un indirizzo operativo."
                toneClass="border-[rgba(34,197,94,0.22)] bg-[linear-gradient(180deg,rgba(34,197,94,0.08),rgba(20,24,23,0.94))]"
              >
                <label className="flex items-center gap-2 ui-body">
                  <input
                    type="checkbox"
                    checked={profileForm.dog_address_same_as_home}
                    onChange={(e) => onToggle('dog_address_same_as_home', e.target.checked)}
                    className="ui-checkbox"
                  />
                  Usa l&apos;indirizzo di casa
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className={labelBase}>Via / indirizzo</label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={profileForm.dog_address_line}
                        onChange={(e) => onChangeText('dog_address_line', e.target.value)}
                        onFocus={serviceAddressAutocomplete?.onFocus}
                        onBlur={serviceAddressAutocomplete?.onBlur}
                        disabled={profileForm.dog_address_same_as_home}
                        className={inputBase}
                        placeholder="Inizia a scrivere la via"
                        autoComplete="off"
                      />
                      {!profileForm.dog_address_same_as_home ? (
                        <>
                          <AddressSuggestions config={serviceAddressAutocomplete} />
                          <p className="ui-muted">
                            Seleziona un suggerimento per compilare automaticamente città, CAP e provincia.
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Città</label>
                    <input
                      type="text"
                      value={profileForm.dog_city}
                      onChange={(e) => onChangeText('dog_city', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>CAP</label>
                    <input
                      type="text"
                      value={profileForm.dog_zip_code}
                      onChange={(e) => onChangeText('dog_zip_code', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Provincia</label>
                    <input
                      type="text"
                      value={profileForm.dog_province}
                      onChange={(e) => onChangeText('dog_province', e.target.value)}
                      disabled={profileForm.dog_address_same_as_home}
                      className={inputBase}
                    />
                  </div>
                </div>
              </DetailsBlock>

              <DetailsBlock
                title="Anagrafica"
                subtitle="Dati richiesti per documenti e liberatoria."
                toneClass="border-[rgba(168,85,247,0.22)] bg-[linear-gradient(180deg,rgba(168,85,247,0.08),rgba(20,24,23,0.94))]"
              >
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <label className={labelBase}>Codice fiscale</label>
                    <input
                      type="text"
                      value={profileForm.fiscal_code}
                      onChange={(e) => {
                        onChangeText('fiscal_code', e.target.value);
                      }}
                      className={`${inputBase} uppercase`}
                      placeholder="RSSMRA80A01H501U"
                    />
                    <p className="ui-muted">Usato per liberatoria e servizi.</p>
                  </div>

                  <div className="space-y-1">
                    <label className={labelBase}>Data di nascita</label>
                    <input
                      type="date"
                      value={profileForm.birth_date}
                      onChange={(e) => onChangeText('birth_date', e.target.value)}
                      className={inputBase}
                    />
                    <p className="ui-muted">Usata per liberatoria e servizi.</p>
                  </div>
                </div>
              </DetailsBlock>
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

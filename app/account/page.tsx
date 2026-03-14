// FILE: app/account/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { Profile as ProfileRow } from '@/types/profile';
import { ProfileDetails } from '@/components/profile/ProfileDetails';
import type { ProfileFormState } from '@/types/forms';
import { isValidItalianFiscalCode, sanitizeFiscalCode } from '@/lib/validation/italy';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

const ID_DOC_BUCKET = 'identity-documents';
const PROFILE_SELECT =
  'user_id, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';
const DOC_ACTION_WIDTH_CLASS = 'w-[132px]';
const DOC_DOWNLOAD_LINK_CLASS =
  'ui-btn ui-btnTone-secondary w-[132px]';

type UserDocumentKind = 'ID_DOCUMENT' | 'WAIVER_SIGNED';
type UserDocumentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

type UserDocumentRow = {
  id: string;
  user_id: string;
  kind: UserDocumentKind;
  path: string;
  created_at: string;
  status: UserDocumentStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  staff_note: string | null;
};

const EMPTY_FORM: ProfileFormState = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',

  address_line: '',
  city: '',
  zip_code: '',
  province: '',

  fiscal_code: '',
  birth_date: '',

  dog_address_same_as_home: true,
  dog_address_line: '',
  dog_city: '',
  dog_zip_code: '',
  dog_province: '',

  show_first_name_on_dog_card: true,
  show_last_name_on_dog_card: true,

  show_phone_on_dog_card: true,
  show_email_on_dog_card: false,
  show_address_on_dog_card: false,
  show_dog_address_on_dog_card: false,
};

function coalesceBool(value: boolean | null | undefined, fallback: boolean): boolean {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function inferDogAddressSameAsHome(row: ProfileRow | null): boolean {
  if (!row) return true;

  const hasAnyDogAddress =
    !!row.dog_address_line || !!row.dog_city || !!row.dog_zip_code || !!row.dog_province;

  if (!hasAnyDogAddress) return true;

  const eq = (a: string | null, b: string | null) => (a ?? '').trim() === (b ?? '').trim();

  return (
    eq(row.dog_address_line, row.address_line) &&
    eq(row.dog_city, row.city) &&
    eq(row.dog_zip_code, row.zip_code) &&
    eq(row.dog_province, row.province)
  );
}

function getFileExt(file: File): string {
  const originalName = file.name || 'file';
  const extMatch = originalName.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (extMatch?.[1]) return extMatch[1];
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function safeUuid(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function initFormFromProfile(row: ProfileRow | null, fallbackEmail: string | null): ProfileFormState {
  const dogSame = inferDogAddressSameAsHome(row);

  const home = {
    address_line: row?.address_line ?? '',
    city: row?.city ?? '',
    zip_code: row?.zip_code ?? '',
    province: row?.province ?? '',
  };

  const dog = {
    dog_address_line: row?.dog_address_line ?? (dogSame ? home.address_line : ''),
    dog_city: row?.dog_city ?? (dogSame ? home.city : ''),
    dog_zip_code: row?.dog_zip_code ?? (dogSame ? home.zip_code : ''),
    dog_province: row?.dog_province ?? (dogSame ? home.province : ''),
  };

  return {
    first_name: row?.first_name ?? '',
    last_name: row?.last_name ?? '',
    phone: row?.phone ?? '',
    email: row?.email ?? fallbackEmail ?? '',

    ...home,

    fiscal_code: row?.fiscal_code ?? '',
    birth_date: row?.birth_date ?? '',

    dog_address_same_as_home: dogSame,
    ...dog,

    show_first_name_on_dog_card: coalesceBool(row?.show_first_name_on_dog_card, true),
    show_last_name_on_dog_card: coalesceBool(row?.show_last_name_on_dog_card, true),

    show_phone_on_dog_card: coalesceBool(row?.show_phone_on_dog_card, true),
    show_email_on_dog_card: coalesceBool(row?.show_email_on_dog_card, false),
    show_address_on_dog_card: coalesceBool(row?.show_address_on_dog_card, false),
    show_dog_address_on_dog_card: coalesceBool(row?.show_dog_address_on_dog_card, false),
  };
}

export default function AccountPage() {
  const router = useRouter();
  const { user, loading: authLoading, error: authError } = useCurrentUser({
    redirectToIfUnauthenticated: '/login',
    enableRedirects: true,
  });

  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fiscalCodeWarning, setFiscalCodeWarning] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Documento identità (preview dell’ultimo caricato)
  const [idDocUploading, setIdDocUploading] = useState(false);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [idDocSignedUrl, setIdDocSignedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Stato “accettazioni” (MVP)
  const [latestIdDoc, setLatestIdDoc] = useState<UserDocumentRow | null>(null);
  const [latestWaiverSigned, setLatestWaiverSigned] = useState<UserDocumentRow | null>(null);

  // Liberatoria firmata (upload)
  const [waiverUploading, setWaiverUploading] = useState(false);
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const [waiverSignedUrl, setWaiverSignedUrl] = useState<string | null>(null);
  const waiverFileInputRef = useRef<HTMLInputElement | null>(null);

  const [showIdDocumentSection, setShowIdDocumentSection] = useState(false);
  const [showWaiverSection, setShowWaiverSection] = useState(false);

  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);

  const idDocIsPdf = useMemo(() => {
    const path = profile?.id_document_path ?? '';
    return path.toLowerCase().endsWith('.pdf');
  }, [profile?.id_document_path]);

  const waiverMissingFields = useMemo(() => {
    const missing: string[] = [];

    const first = (profile?.first_name ?? '').trim();
    const last = (profile?.last_name ?? '').trim();
    const cf = sanitizeFiscalCode(profile?.fiscal_code ?? '').trim();

    if (!first) missing.push('Nome');
    if (!last) missing.push('Cognome');
    if (!cf) missing.push('Codice fiscale');

    return missing;
  }, [profile?.first_name, profile?.last_name, profile?.fiscal_code]);

  const canGenerateWaiver = waiverMissingFields.length === 0;

  const refreshSignedUrl = useCallback(async (path: string | null, setter: (url: string | null) => void) => {
    if (!path) {
      setter(null);
      return;
    }

    const { data, error: e } = await supabase.storage.from(ID_DOC_BUCKET).createSignedUrl(path, 60 * 10);
    if (e) {
      console.error('createSignedUrl errore:', e);
      setter(null);
      return;
    }
    setter(data.signedUrl);
  }, []);

  const loadLatestUserDocument = useCallback(async (userId: string, kind: UserDocumentKind) => {
    const { data, error: e } = await supabase
      .from('user_documents')
      .select('id, user_id, kind, path, created_at, status, accepted_at, rejected_at, staff_note')
      .eq('user_id', userId)
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1);

    if (e) {
      console.error('loadLatestUserDocument error:', e);
      return null;
    }

    const row = (data?.[0] as UserDocumentRow | undefined) ?? null;
    return row;
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoadingData(false);
      return;
    }

    const load = async () => {
      setLoadingData(true);
      setError(null);
      setIdDocError(null);
      setIdDocSignedUrl(null);
      setWaiverError(null);
      setWaiverSignedUrl(null);

      try {
        const { data, error: e } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('user_id', user.id)
          .maybeSingle();

        if (e) setError(e.message);

        const row = (data as ProfileRow | null) ?? null;
        setProfile(row);
        setForm(initFormFromProfile(row, user.email ?? null));

        if (row?.id_document_path) {
          await refreshSignedUrl(row.id_document_path, setIdDocSignedUrl);
        }

        const [idDocRow, waiverRow] = await Promise.all([
          loadLatestUserDocument(user.id, 'ID_DOCUMENT'),
          loadLatestUserDocument(user.id, 'WAIVER_SIGNED'),
        ]);

        setLatestIdDoc(idDocRow);
        setLatestWaiverSigned(waiverRow);

        if (waiverRow?.path) {
          await refreshSignedUrl(waiverRow.path, setWaiverSignedUrl);
        }
      } catch (err) {
        console.error(err);
        setError('Errore nel caricamento del profilo.');
      } finally {
        setLoadingData(false);
      }
    };

    void load();
  }, [authLoading, user, loadLatestUserDocument, refreshSignedUrl]);

  const onChangeText = (field: keyof ProfileFormState, value: string) => {
    setForm((prev) => {
      let nextValue = value;
      if (field === 'fiscal_code') nextValue = sanitizeFiscalCode(value);

      const next: ProfileFormState = { ...prev, [field]: nextValue } as ProfileFormState;

      if (prev.dog_address_same_as_home) {
        if (field === 'address_line') next.dog_address_line = next.address_line;
        if (field === 'city') next.dog_city = next.city;
        if (field === 'zip_code') next.dog_zip_code = next.zip_code;
        if (field === 'province') next.dog_province = next.province;
      }

      return next;
    });
  };

  const onToggle = (field: keyof ProfileFormState, value: boolean) => {
    setForm((prev) => {
      const next: ProfileFormState = { ...prev, [field]: value } as ProfileFormState;

      if (field === 'dog_address_same_as_home' && value === true) {
        next.dog_address_line = prev.address_line;
        next.dog_city = prev.city;
        next.dog_zip_code = prev.zip_code;
        next.dog_province = prev.province;
      }

      return next;
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      const dogAddress = form.dog_address_same_as_home
        ? {
            dog_address_line: form.address_line || null,
            dog_city: form.city || null,
            dog_zip_code: form.zip_code || null,
            dog_province: form.province || null,
          }
        : {
            dog_address_line: form.dog_address_line || null,
            dog_city: form.dog_city || null,
            dog_zip_code: form.dog_zip_code || null,
            dog_province: form.dog_province || null,
          };
      setFiscalCodeWarning(null);

      const cfClean = sanitizeFiscalCode(form.fiscal_code);
      const cfProvided = cfClean.length > 0;
      const cfValid = !cfProvided ? true : isValidItalianFiscalCode(cfClean);

      if (cfProvided && !cfValid) {
        setFiscalCodeWarning(
          'Il Codice Fiscale inserito non sembra nel formato corretto (16 caratteri). Non lo abbiamo salvato.'
        );
      }

      const payload = {
        user_id: user.id,

        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,

        address_line: form.address_line || null,
        city: form.city || null,
        zip_code: form.zip_code || null,
        province: form.province || null,

        email: form.email || user.email || null,

        fiscal_code: cfProvided ? (cfValid ? cfClean : (profile?.fiscal_code ?? null)) : null,

        birth_date: form.birth_date || null,

        ...dogAddress,

        show_first_name_on_dog_card: form.show_first_name_on_dog_card,
        show_last_name_on_dog_card: form.show_last_name_on_dog_card,

        show_phone_on_dog_card: form.show_phone_on_dog_card,
        show_email_on_dog_card: form.show_email_on_dog_card,
        show_address_on_dog_card: form.show_address_on_dog_card,
        show_dog_address_on_dog_card: form.show_dog_address_on_dog_card,
      };

      const { data, error: e } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'user_id' })
        .select(PROFILE_SELECT)
        .single();

      if (e) {
        setError(e.message);
        return;
      }

      const updated = data as ProfileRow;
      setProfile(updated);
      setForm(initFormFromProfile(updated, user.email ?? null));
      setEditing(false);

      if (cfProvided && !cfValid) {
        window.alert(
          'Attenzione: il Codice Fiscale inserito non è nel formato corretto. Non lo abbiamo salvato.'
        );
      }
    } catch (err) {
      console.error(err);
      setError('Errore nel salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  const uploadIdentityDocument = async (file: File) => {
    if (!user) return;

    setIdDocUploading(true);
    setIdDocError(null);

    try {
      const ext = getFileExt(file);
      const token = safeUuid();
      const path = `${user.id}/id-documents/${token}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(ID_DOC_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        console.error('Upload documento errore:', uploadError);
        setIdDocError(uploadError.message);
        return;
      }

      const { error: docRowErr } = await supabase.from('user_documents').insert({
        user_id: user.id,
        kind: 'ID_DOCUMENT',
        path,
        status: 'PENDING',
      });

      if (docRowErr) {
        console.error('Insert user_documents (ID_DOCUMENT) errore:', docRowErr);
        setIdDocError('Documento caricato, ma non è stato possibile registrarlo per l’accettazione.');
      }

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            id_document_path: path,
            id_document_uploaded_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select(PROFILE_SELECT)
        .single();

      if (updateError || !updated) {
        console.error('Update profilo doc errore:', updateError);
        setIdDocError(updateError?.message ?? 'Impossibile aggiornare il profilo.');
        return;
      }

      setProfile(updated as ProfileRow);
      await refreshSignedUrl(path, setIdDocSignedUrl);

      const latest = await loadLatestUserDocument(user.id, 'ID_DOCUMENT');
      setLatestIdDoc(latest);
    } catch (err) {
      console.error(err);
      setIdDocError('Errore durante il caricamento del documento.');
    } finally {
      setIdDocUploading(false);
    }
  };

  const uploadSignedWaiver = async (file: File) => {
    if (!user) return;

    setWaiverUploading(true);
    setWaiverError(null);

    try {
      const ext = getFileExt(file);
      const token = safeUuid();
      const path = `${user.id}/waivers/${token}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(ID_DOC_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        console.error('Upload liberatoria firmata errore:', uploadError);
        setWaiverError(uploadError.message);
        return;
      }

      const { error: insErr } = await supabase.from('user_documents').insert({
        user_id: user.id,
        kind: 'WAIVER_SIGNED',
        path,
        status: 'PENDING',
      });

      if (insErr) {
        console.error('Insert user_documents (WAIVER_SIGNED) errore:', insErr);
        setWaiverError('Liberatoria caricata, ma non è stato possibile registrarla per l’accettazione.');
      }

      const latest = await loadLatestUserDocument(user.id, 'WAIVER_SIGNED');
      setLatestWaiverSigned(latest);

      await refreshSignedUrl(path, setWaiverSignedUrl);
    } catch (err) {
      console.error(err);
      setWaiverError('Errore durante il caricamento della liberatoria firmata.');
    } finally {
      setWaiverUploading(false);
    }
  };

  if (authLoading || loadingData) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento...</p>
      </main>
    );
  }

  if (!user) return null;

  const idDocStatusLabel =
    latestIdDoc?.status === 'ACCEPTED'
      ? 'Confermato'
      : latestIdDoc?.status === 'REJECTED'
      ? 'Da ricaricare'
      : latestIdDoc
      ? 'In attesa di conferma'
      : profile?.id_document_path
      ? 'In attesa di conferma'
      : 'Non caricato';

  const waiverStatusLabel =
    latestWaiverSigned?.status === 'ACCEPTED'
      ? 'Confermato'
      : latestWaiverSigned?.status === 'REJECTED'
      ? 'Da ricaricare'
      : latestWaiverSigned
      ? 'In attesa di conferma'
      : 'Non caricato';

  const topError = error ?? authError?.message ?? null;

  return (
    <main className="ui-page min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-4 space-y-4">
        {topError ? (
          <div className="ui-error">
            {topError}
          </div>
        ) : null}

        {fiscalCodeWarning ? (
          <div className="ui-alertWarn">
            {fiscalCodeWarning}
          </div>
        ) : null}

        <ProfileDetails
          userEmail={profile?.email ?? user.email ?? ''}
          profile={profile}
          profileEditing={editing}
          profileForm={form}
          savingProfile={saving}
          onChangeText={onChangeText}
          onToggle={onToggle}
          onSubmit={onSubmit}
          onStartEdit={() => setEditing(true)}
            onCancelEdit={() => {
              setEditing(false);
              setForm(initFormFromProfile(profile, user.email ?? null));
            }}
        />

        {/* Documento identità */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="Documento di identità"
              subtitle={idDocStatusLabel}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowIdDocumentSection((v) => {
                      const next = !v;

                      const path = profile?.id_document_path ?? null;
                      if (next && path && !idDocSignedUrl) {
                        void refreshSignedUrl(path, setIdDocSignedUrl);
                      }

                      return next;
                    });
                  }}
                >
                  {showIdDocumentSection ? 'Nascondi' : 'Mostra'}
                </Button>
              }
            />

            {showIdDocumentSection ? (
              <div className="space-y-3">
                {idDocError ? (
                  <div className="ui-error">
                    {idDocError}
                  </div>
                ) : null}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadIdentityDocument(file);
                    e.currentTarget.value = '';
                  }}
                />

                <div className="ui-panelInset p-3 space-y-2">
                  <p className="ui-body">
                    <span className="font-medium">Stato:</span> {idDocStatusLabel}
                  </p>

                  {profile?.id_document_path ? (
                    <p className="ui-muted">
                      File: <span className="font-mono">{profile.id_document_path.split('/').pop()}</span>
                    </p>
                  ) : (
                    <p className="ui-muted">Nessun file caricato.</p>
                  )}

                  {profile?.id_document_uploaded_at ? (
                    <p className="ui-muted">
                      Ultimo upload: {new Date(profile.id_document_uploaded_at).toLocaleString()}
                    </p>
                  ) : null}

                  {profile?.id_document_path ? (
                    <p className="ui-muted">
                      {idDocIsPdf ? 'Formato: PDF' : 'Formato: immagine'}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    className={DOC_ACTION_WIDTH_CLASS}
                    disabled={idDocUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profile?.id_document_path ? 'Sostituisci' : 'Carica'}
                  </Button>

                  {profile?.id_document_path ? (
                    idDocSignedUrl ? (
                      <a
                        href={idDocSignedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={DOC_DOWNLOAD_LINK_CLASS}
                      >
                        Scarica
                      </a>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void refreshSignedUrl(profile.id_document_path ?? null, setIdDocSignedUrl)}
                      >
                        Genera link
                      </Button>
                    )
                  ) : null}

                  {idDocUploading ? (
                    <p className="ui-muted">Caricamento…</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Liberatoria */}
        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="Liberatoria"
              subtitle={waiverStatusLabel}
              action={
                <Button variant="secondary" onClick={() => setShowWaiverSection((v) => !v)}>
                  {showWaiverSection ? 'Nascondi' : 'Mostra'}
                </Button>
              }
            />

            {showWaiverSection ? (
              <div className="space-y-4">
                {/* Parte 1: generazione */}
                <div className="ui-panelInset p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="ui-body font-[var(--font-weight-semibold)]">Liberatoria da firmare</p>
                      <p className="ui-muted mt-1">
                        Genera la liberatoria precompilata, scaricala e firmala.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      disabled={!canGenerateWaiver}
                      onClick={() => router.push('/account/waiver')}
                      title={canGenerateWaiver ? 'Apri liberatoria' : 'Completa i dati richiesti'}
                    >
                      Genera
                    </Button>
                  </div>

                  {!canGenerateWaiver ? (
                    <div className="ui-alertWarn">
                      <p className="ui-body font-medium">
                        Per generare la liberatoria mancano:
                      </p>
                      <ul className="list-disc pl-5 ui-body mt-1">
                        {waiverMissingFields.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <p className="ui-muted mt-2">
                        Compila e salva i dati del profilo qui sopra.
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Parte 2: liberatoria firmata */}
                <div className="space-y-3">
                  {waiverError ? (
                    <div className="ui-error">
                      {waiverError}
                    </div>
                  ) : null}

                  <input
                    ref={waiverFileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void uploadSignedWaiver(file);
                      e.currentTarget.value = '';
                    }}
                  />

                  <div className="ui-panelInset p-3 space-y-2">
                    <p className="ui-body">
                      <span className="font-medium">Stato:</span> {waiverStatusLabel}
                    </p>

                    {latestWaiverSigned?.path ? (
                      <p className="ui-muted">
                        File:{' '}
                        <span className="font-mono">
                          {latestWaiverSigned.path.split('/').pop()}
                        </span>
                      </p>
                    ) : (
                      <p className="ui-muted">Nessun file caricato.</p>
                    )}

                    {latestWaiverSigned?.created_at ? (
                      <p className="ui-muted">
                        Ultimo upload: {new Date(latestWaiverSigned.created_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      className={DOC_ACTION_WIDTH_CLASS}
                      disabled={waiverUploading}
                      onClick={() => waiverFileInputRef.current?.click()}
                    >
                      {latestWaiverSigned?.path ? 'Sostituisci' : 'Carica'}
                    </Button>

                    {latestWaiverSigned?.path ? (
                      waiverSignedUrl ? (
                        <a
                          href={waiverSignedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={DOC_DOWNLOAD_LINK_CLASS}
                        >
                          Scarica
                        </a>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void refreshSignedUrl(latestWaiverSigned.path, setWaiverSignedUrl)}
                        >
                          Genera link
                        </Button>
                      )
                    ) : null}

                    {waiverUploading ? (
                      <p className="ui-muted">Caricamento…</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

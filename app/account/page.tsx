// FILE: app/account/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { AddressSearchApiResponse, AddressSuggestion } from '@/lib/address/addressSearch';
import { humanizeErrorMessage } from '@/lib/errors/humanize';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import type { Profile as ProfileRow } from '@/types/profile';
import { ProfileDetails } from '@/components/profile/ProfileDetails';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import type { ProfileFormState } from '@/types/forms';
import { updateProfileForCurrentUser } from '@/lib/account/profileApi';
import { deleteProfilePhoto, uploadProfilePhoto } from '@/lib/account/profilePhotoApi';
import { isValidItalianFiscalCode, sanitizeFiscalCode } from '@/lib/validation/italy';
import { uploadIdentityDocumentSides } from '@/lib/account/documentApi';
import {
  MAX_PROFILE_PHOTO_BYTES,
  MAX_USER_DOCUMENT_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
  USER_DOCUMENT_MIME_TYPES,
  validateUploadFile,
} from '@/lib/validation/uploads';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DocumentViewer, type DocumentViewerSource } from '@/components/ui/DocumentViewer';

const ID_DOC_BUCKET = 'identity-documents';
const PROFILE_SELECT =
  'user_id, photo_path, first_name, last_name, phone, address_line, city, zip_code, province, email, fiscal_code, birth_date, dog_address_line, dog_city, dog_zip_code, dog_province, id_document_path, id_document_uploaded_at, id_document_back_path, id_document_back_uploaded_at, show_first_name_on_dog_card, show_last_name_on_dog_card, show_phone_on_dog_card, show_email_on_dog_card, show_address_on_dog_card, show_dog_address_on_dog_card';
const DOC_ACTION_WIDTH_CLASS = 'w-[132px]';
const ADDRESS_SEARCH_MIN_CHARS = 3;
const ADDRESS_SEARCH_DEBOUNCE_MS = 350;

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

// Le immagini vengono ricompresse lato client prima dell'upload, quindi in fase
// di selezione accettiamo file "grezzi" più grandi (foto ad alta risoluzione):
// il limite reale di 10MB resta applicato dopo la compressione, lato server.
const MAX_RAW_IMAGE_BYTES = 40 * 1024 * 1024;

function validateUserDocument(file: File): string | null {
  const isImage = file.type.startsWith('image/');
  return validateUploadFile({
    file,
    allowedMimeTypes: USER_DOCUMENT_MIME_TYPES,
    maxBytes: isImage ? MAX_RAW_IMAGE_BYTES : MAX_USER_DOCUMENT_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa PDF, JPG, PNG o WebP.',
    tooLargeMessage: isImage
      ? 'La foto è troppo grande. Limite massimo: 40MB.'
      : 'Il file è troppo grande. Limite massimo: 10MB.',
  });
}

function validateProfilePhoto(file: File): string | null {
  return validateUploadFile({
    file,
    allowedMimeTypes: PROFILE_PHOTO_MIME_TYPES,
    maxBytes: MAX_PROFILE_PHOTO_BYTES,
    invalidTypeMessage: 'Formato non valido. Usa JPG, PNG o WebP.',
    tooLargeMessage: 'La foto è troppo grande. Limite massimo: 5MB.',
  });
}

function buildInitials(first?: string | null, last?: string | null, email?: string | null): string {
  const a = (first ?? '').trim().slice(0, 1).toUpperCase();
  const b = (last ?? '').trim().slice(0, 1).toUpperCase();
  const pair = `${a}${b}`.trim();
  if (pair) return pair;

  const localPart = (email ?? '').trim().split('@')[0] ?? '';
  const normalized = localPart.replace(/[^a-z0-9]+/gi, ' ').trim();
  if (!normalized) return 'TU';

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
  }

  return normalized.replace(/\s+/g, '').slice(0, 2).toUpperCase() || 'TU';
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

function useAddressAutocompleteSearch(query: string, enabled: boolean) {
  const debouncedQuery = useDebouncedValue(query, ADDRESS_SEARCH_DEBOUNCE_MS);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  const active = enabled && focused && query.trim().length >= ADDRESS_SEARCH_MIN_CHARS;

  useEffect(() => {
    if (!active) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const trimmedQuery = debouncedQuery.trim();
    if (trimmedQuery.length < ADDRESS_SEARCH_MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/address-search?q=${encodeURIComponent(trimmedQuery)}`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const json = (await response.json().catch(() => null)) as AddressSearchApiResponse | null;

        if (!response.ok || !json?.ok) {
          throw new Error(
            json && !json.ok && json.error
              ? json.error
              : 'Ricerca indirizzo non disponibile in questo momento.'
          );
        }

        if (cancelled) return;
        setSuggestions(json.items);
      } catch (err) {
        if (controller.signal.aborted || cancelled) return;
        setSuggestions([]);
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Ricerca indirizzo non disponibile in questo momento.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, debouncedQuery]);

  return {
    active,
    loading,
    error,
    suggestions,
    setFocused,
  };
}

export default function AccountPage() {
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

  // Documento identità — fronte + retro
  const [idDocConfirming, setIdDocConfirming] = useState(false);
  const [idDocError, setIdDocError] = useState<string | null>(null);
  const [documentViewer, setDocumentViewer] = useState<DocumentViewerSource | null>(null);
  const [idDocFrontSignedUrl, setIdDocFrontSignedUrl] = useState<string | null>(null);
  const [idDocBackSignedUrl, setIdDocBackSignedUrl] = useState<string | null>(null);
  // File scelti localmente (non ancora caricati) + anteprima object URL
  const [idDocFrontFile, setIdDocFrontFile] = useState<File | null>(null);
  const [idDocBackFile, setIdDocBackFile] = useState<File | null>(null);
  const [idDocFrontPreview, setIdDocFrontPreview] = useState<string | null>(null);
  const [idDocBackPreview, setIdDocBackPreview] = useState<string | null>(null);
  const idDocFrontInputRef = useRef<HTMLInputElement | null>(null);
  const idDocBackInputRef = useRef<HTMLInputElement | null>(null);

  // Foto profilo
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState<string | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Stato “accettazioni” (MVP)
  const [latestIdDoc, setLatestIdDoc] = useState<UserDocumentRow | null>(null);

  const [showIdDocumentSection, setShowIdDocumentSection] = useState(false);

  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const homeAddressAutocomplete = useAddressAutocompleteSearch(form.address_line, editing);
  const serviceAddressAutocomplete = useAddressAutocompleteSearch(
    form.dog_address_line,
    editing && !form.dog_address_same_as_home
  );

  const idDocFrontIsPdf = useMemo(
    () => (profile?.id_document_path ?? '').toLowerCase().endsWith('.pdf'),
    [profile?.id_document_path]
  );
  const idDocBackIsPdf = useMemo(
    () => (profile?.id_document_back_path ?? '').toLowerCase().endsWith('.pdf'),
    [profile?.id_document_back_path]
  );

  // Revoca gli object URL delle anteprime locali allo smontaggio.
  useEffect(() => {
    return () => {
      if (idDocFrontPreview) URL.revokeObjectURL(idDocFrontPreview);
      if (idDocBackPreview) URL.revokeObjectURL(idDocBackPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ownerDisplayName = useMemo(
    () => `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
    [profile?.first_name, profile?.last_name]
  );
  const ownerInitials = useMemo(
    () => buildInitials(profile?.first_name, profile?.last_name, profile?.email ?? user?.email ?? null),
    [profile?.first_name, profile?.last_name, profile?.email, user?.email]
  );

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
      setProfilePhotoError(null);
      setIdDocError(null);
      setIdDocFrontSignedUrl(null);
      setIdDocBackSignedUrl(null);

      try {
        const { data, error: e } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('user_id', user.id)
          .maybeSingle();

        if (e) setError(humanizeErrorMessage(e, 'Non siamo riusciti a caricare il profilo.'));

        const row = (data as ProfileRow | null) ?? null;
        setProfile(row);
        setForm(initFormFromProfile(row, user.email ?? null));

        if (row?.id_document_path) {
          await refreshSignedUrl(row.id_document_path, setIdDocFrontSignedUrl);
        }
        if (row?.id_document_back_path) {
          await refreshSignedUrl(row.id_document_back_path, setIdDocBackSignedUrl);
        }

        const idDocRow = await loadLatestUserDocument(user.id, 'ID_DOCUMENT');
        setLatestIdDoc(idDocRow);
    } catch (err) {
      console.error(err);
      setError(humanizeErrorMessage(err, 'Errore nel caricamento del profilo.'));
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

  const applyResidenceAddressSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      setForm((prev) => {
        const next: ProfileFormState = {
          ...prev,
          address_line: suggestion.dog_address_line,
          city: suggestion.dog_city,
          zip_code: suggestion.dog_zip_code,
          province: suggestion.dog_province,
        };

        if (prev.dog_address_same_as_home) {
          next.dog_address_line = suggestion.dog_address_line;
          next.dog_city = suggestion.dog_city;
          next.dog_zip_code = suggestion.dog_zip_code;
          next.dog_province = suggestion.dog_province;
        }

        return next;
      });
      homeAddressAutocomplete.setFocused(false);
    },
    [homeAddressAutocomplete]
  );

  const applyServiceAddressSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      setForm((prev) => ({
        ...prev,
        dog_address_line: suggestion.dog_address_line,
        dog_city: suggestion.dog_city,
        dog_zip_code: suggestion.dog_zip_code,
        dog_province: suggestion.dog_province,
      }));
      serviceAddressAutocomplete.setFocused(false);
    },
    [serviceAddressAutocomplete]
  );

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

      const updated = await updateProfileForCurrentUser(payload);
      setProfile(updated);
      setForm(initFormFromProfile(updated, user.email ?? null));
      homeAddressAutocomplete.setFocused(false);
      serviceAddressAutocomplete.setFocused(false);
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

  // Seleziona un file per un lato (fronte/retro) SENZA caricarlo: mostra solo
  // l'anteprima locale. Il caricamento avviene con "Conferma".
  const selectIdDocSide = (side: 'front' | 'back', file: File) => {
    const validationError = validateUserDocument(file);
    if (validationError) {
      setIdDocError(validationError);
      return;
    }
    setIdDocError(null);

    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    if (side === 'front') {
      setIdDocFrontPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
      setIdDocFrontFile(file);
    } else {
      setIdDocBackPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return preview;
      });
      setIdDocBackFile(file);
    }
  };

  const clearIdDocLocalSelection = () => {
    setIdDocFrontPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIdDocBackPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setIdDocFrontFile(null);
    setIdDocBackFile(null);
  };

  const confirmIdentityDocument = async () => {
    if (!user) return;
    if (!idDocFrontFile && !idDocBackFile) return;

    setIdDocConfirming(true);
    setIdDocError(null);

    try {
      const { profile: updatedProfile } = await uploadIdentityDocumentSides({
        front: idDocFrontFile,
        back: idDocBackFile,
      });

      if (updatedProfile) {
        setProfile(updatedProfile);
        await Promise.all([
          refreshSignedUrl(updatedProfile.id_document_path, setIdDocFrontSignedUrl),
          refreshSignedUrl(updatedProfile.id_document_back_path, setIdDocBackSignedUrl),
        ]);
      }

      clearIdDocLocalSelection();

      const latest = await loadLatestUserDocument(user.id, 'ID_DOCUMENT');
      setLatestIdDoc(latest);
    } catch (err) {
      console.error(err);
      setIdDocError(
        err instanceof Error ? err.message : 'Errore durante il caricamento del documento.'
      );
    } finally {
      setIdDocConfirming(false);
    }
  };

  const uploadOwnerPhoto = async (file: File) => {
    setProfilePhotoUploading(true);
    setProfilePhotoError(null);

    try {
      const validationError = validateProfilePhoto(file);
      if (validationError) {
        setProfilePhotoError(validationError);
        return;
      }

      const { profile: updatedProfile } = await uploadProfilePhoto(file);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    } catch (err) {
      console.error(err);
      setProfilePhotoError(humanizeErrorMessage(err, 'Errore durante il caricamento della foto profilo.'));
    } finally {
      setProfilePhotoUploading(false);
    }
  };

  const removeOwnerPhoto = async () => {
    if (!profile?.photo_path) return;

    setProfilePhotoUploading(true);
    setProfilePhotoError(null);

    try {
      const { profile: updatedProfile } = await deleteProfilePhoto();
      if (updatedProfile) {
        setProfile(updatedProfile);
      } else {
        setProfile((current) => (current ? { ...current, photo_path: null } : current));
      }
    } catch (err) {
      console.error(err);
      setProfilePhotoError(humanizeErrorMessage(err, 'Errore durante la rimozione della foto profilo.'));
    } finally {
      setProfilePhotoUploading(false);
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

  const hasFrontStored = !!profile?.id_document_path;
  const hasBackStored = !!profile?.id_document_back_path;
  const idDocFrontAvailable = hasFrontStored || !!idDocFrontFile;
  const idDocBackAvailable = hasBackStored || !!idDocBackFile;
  const idDocHasNewFiles = !!idDocFrontFile || !!idDocBackFile;
  const canConfirmIdDoc =
    idDocFrontAvailable && idDocBackAvailable && idDocHasNewFiles && !idDocConfirming;

  const idDocStatusLabel = !hasFrontStored && !hasBackStored
    ? 'Non caricato'
    : !hasFrontStored || !hasBackStored
    ? 'Incompleto (manca un lato)'
    : latestIdDoc?.status === 'ACCEPTED'
    ? 'Confermato'
    : latestIdDoc?.status === 'REJECTED'
    ? 'Da ricaricare'
    : 'In attesa di conferma';

  const topError = error ?? (authError ? humanizeErrorMessage(authError, 'Accesso non disponibile.') : null);

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

        <Card>
          <CardContent className="space-y-3">
            <SectionHeader
              title="Foto profilo"
              subtitle={
                profile?.photo_path
                  ? 'Viene mostrata nel banner del tuo profilo.'
                  : 'Aggiungi una foto del proprietario.'
              }
            />

            {profilePhotoError ? (
              <div className="ui-error">{profilePhotoError}</div>
            ) : null}

            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void uploadOwnerPhoto(file);
                e.currentTarget.value = '';
              }}
            />

            <div className="ui-panelInset p-3">
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  photoPath={profile?.photo_path ?? null}
                  alt={ownerDisplayName || 'Profilo utente'}
                  initials={ownerInitials}
                  size={80}
                  className="ui-mediaFrame ui-mediaFrame--circle h-20 w-20 shrink-0 overflow-hidden object-cover"
                  fallbackClassName="ui-mediaFrame ui-mediaFrame--circle flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden bg-[rgba(255,130,0,0.14)] text-[22px] font-[var(--font-weight-bold)]"
                />

                <div className="min-w-0">
                  <div className="ui-body font-[var(--font-weight-semibold)]">
                    {ownerDisplayName || 'Profilo proprietario'}
                  </div>
                  <div className="ui-muted mt-1">
                    {profile?.photo_path
                      ? 'La foto è attiva e visibile nel banner del profilo.'
                      : 'Nessuna foto caricata.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                className={DOC_ACTION_WIDTH_CLASS}
                disabled={profilePhotoUploading}
                onClick={() => profilePhotoInputRef.current?.click()}
              >
                {profile?.photo_path ? 'Sostituisci' : 'Carica'}
              </Button>

              {profile?.photo_path ? (
                <Button
                  type="button"
                  variant="secondary"
                  className={DOC_ACTION_WIDTH_CLASS}
                  disabled={profilePhotoUploading}
                  onClick={() => void removeOwnerPhoto()}
                >
                  Rimuovi
                </Button>
              ) : null}

              {profilePhotoUploading ? <p className="ui-muted">Caricamento…</p> : null}
            </div>
          </CardContent>
        </Card>

        <ProfileDetails
          userEmail={profile?.email ?? user.email ?? ''}
          profile={profile}
          profileEditing={editing}
          profileForm={form}
          savingProfile={saving}
          onChangeText={onChangeText}
          onToggle={onToggle}
          onSubmit={onSubmit}
          residenceAddressAutocomplete={{
            active: homeAddressAutocomplete.active,
            loading: homeAddressAutocomplete.loading,
            error: homeAddressAutocomplete.error,
            suggestions: homeAddressAutocomplete.suggestions,
            onFocus: () => homeAddressAutocomplete.setFocused(true),
            onBlur: () => {
              window.setTimeout(() => homeAddressAutocomplete.setFocused(false), 120);
            },
            onSelectSuggestion: applyResidenceAddressSuggestion,
          }}
          serviceAddressAutocomplete={{
            active: serviceAddressAutocomplete.active,
            loading: serviceAddressAutocomplete.loading,
            error: serviceAddressAutocomplete.error,
            suggestions: serviceAddressAutocomplete.suggestions,
            onFocus: () => serviceAddressAutocomplete.setFocused(true),
            onBlur: () => {
              window.setTimeout(() => serviceAddressAutocomplete.setFocused(false), 120);
            },
            onSelectSuggestion: applyServiceAddressSuggestion,
          }}
          onStartEdit={() => setEditing(true)}
          onCancelEdit={() => {
            homeAddressAutocomplete.setFocused(false);
            serviceAddressAutocomplete.setFocused(false);
            setEditing(false);
            setForm(initFormFromProfile(profile, user.email ?? null));
          }}
        />

        {/* Documento identità — fronte + retro */}
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
                      if (next) {
                        if (profile?.id_document_path && !idDocFrontSignedUrl) {
                          void refreshSignedUrl(profile.id_document_path, setIdDocFrontSignedUrl);
                        }
                        if (profile?.id_document_back_path && !idDocBackSignedUrl) {
                          void refreshSignedUrl(profile.id_document_back_path, setIdDocBackSignedUrl);
                        }
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
                {idDocError ? <div className="ui-error">{idDocError}</div> : null}

                <p className="ui-muted">
                  Carica entrambi i lati del documento (fronte e retro), poi premi
                  “Conferma” per inviarli.
                </p>

                {([
                  {
                    key: 'front' as const,
                    title: 'Fronte',
                    storedPath: profile?.id_document_path ?? null,
                    signedUrl: idDocFrontSignedUrl,
                    storedIsPdf: idDocFrontIsPdf,
                    localFile: idDocFrontFile,
                    localPreview: idDocFrontPreview,
                    inputRef: idDocFrontInputRef,
                  },
                  {
                    key: 'back' as const,
                    title: 'Retro',
                    storedPath: profile?.id_document_back_path ?? null,
                    signedUrl: idDocBackSignedUrl,
                    storedIsPdf: idDocBackIsPdf,
                    localFile: idDocBackFile,
                    localPreview: idDocBackPreview,
                    inputRef: idDocBackInputRef,
                  },
                ]).map((s) => {
                  const localIsPdf = !!s.localFile && !s.localPreview;
                  const imageSrc =
                    s.localPreview ?? (s.storedPath && !s.storedIsPdf ? s.signedUrl : null);
                  const isPdf = localIsPdf || (!s.localFile && !!s.storedPath && s.storedIsPdf);
                  const openUrl = s.localPreview ?? s.signedUrl ?? null;

                  return (
                    <div key={s.key} className="ui-panelInset p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="ui-body font-[var(--font-weight-semibold)]">{s.title}</p>
                        {s.localFile ? (
                          <span className="ui-muted">Nuovo file da confermare</span>
                        ) : s.storedPath ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(80,255,160,0.35)] bg-[rgba(80,255,160,0.12)] px-2.5 py-1 text-[13px] font-[var(--font-weight-semibold)] text-[#7dffb4]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M20 6L9 17l-5-5"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Documento caricato
                          </span>
                        ) : (
                          <span className="ui-muted">Mancante</span>
                        )}
                      </div>

                      {/* Anteprima */}
                      <div className="ui-mediaFrame flex min-h-[140px] items-center justify-center overflow-hidden rounded-[var(--radius)] bg-[rgba(255,255,255,0.04)]">
                        {imageSrc ? (
                          openUrl ? (
                            <button
                              type="button"
                              className="block w-full"
                              onClick={() =>
                                setDocumentViewer({
                                  src: openUrl,
                                  title: `Documento — ${s.title}`,
                                  isPdf: false,
                                })
                              }
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageSrc}
                                alt={`Documento — ${s.title.toLowerCase()}`}
                                className="max-h-48 w-full object-contain"
                              />
                            </button>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageSrc}
                              alt={`Documento — ${s.title.toLowerCase()}`}
                              className="max-h-48 w-full object-contain"
                            />
                          )
                        ) : isPdf ? (
                          openUrl ? (
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setDocumentViewer({
                                  src: openUrl,
                                  title: `Documento — ${s.title}`,
                                  isPdf: true,
                                })
                              }
                            >
                              Apri PDF
                            </Button>
                          ) : (
                            <span className="ui-muted">PDF: {s.localFile?.name}</span>
                          )
                        ) : (
                          <span className="ui-muted">Nessun file</span>
                        )}
                      </div>

                      <input
                        ref={s.inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) selectIdDocSide(s.key, file);
                          e.currentTarget.value = '';
                        }}
                      />

                      <Button
                        type="button"
                        variant="secondary"
                        className={DOC_ACTION_WIDTH_CLASS}
                        disabled={idDocConfirming}
                        onClick={() => s.inputRef.current?.click()}
                      >
                        {s.storedPath || s.localFile ? 'Sostituisci' : 'Carica'}
                      </Button>
                    </div>
                  );
                })}

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    className={DOC_ACTION_WIDTH_CLASS}
                    disabled={!canConfirmIdDoc}
                    onClick={() => void confirmIdentityDocument()}
                  >
                    {idDocConfirming ? 'Invio…' : 'Conferma'}
                  </Button>

                  {!idDocFrontAvailable || !idDocBackAvailable ? (
                    <p className="ui-muted">Carica sia fronte che retro per confermare.</p>
                  ) : !idDocHasNewFiles ? (
                    <p className="ui-muted">Nessuna modifica da confermare.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <DocumentViewer source={documentViewer} onClose={() => setDocumentViewer(null)} />
    </main>
  );
}

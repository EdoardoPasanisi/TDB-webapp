import { Card, CardContent } from '@/components/ui/Card';
import { DogPublicCard, type PublicDogCardDog, type PublicDogCardOwner } from '@/components/dogs/DogPublicCard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

function ErrorView({ message }: { message: string }) {
  return (
    <main className="ui-page min-h-screen p-4">
      <div className="mx-auto w-full max-w-xl pt-8">
        <Card>
          <CardContent className="space-y-2 text-center">
            <h1 className="ui-h2">Scheda non disponibile</h1>
            <p className="ui-body">{message}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function loadPublicDogCard(publicId: string): Promise<{
  dog: PublicDogCardDog;
  owner: PublicDogCardOwner | null;
} | null> {
  const { data: dogRows, error: dogError } = await supabaseAdmin
    .from('dogs')
    .select(
      `
        id, name, owner_id,
        updated_at,
        breed, sex, size_category,
        microchip, birth_date, notes,
        coat_color, temperament,
        photo_path,
        show_breed, show_sex, show_size, show_microchip, show_birth_date, show_notes,
        show_coat_color, show_temperament,
        weight_kg, origin_breeds, show_weight, show_origin_breeds,
        public_id, is_active
      `
    )
    .eq('public_id', publicId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1);

  if (dogError) throw new Error(dogError.message || 'Errore caricamento scheda.');
  const dogData = dogRows?.[0] ?? null;
  if (!dogData) return null;
  if ((dogData as { is_active?: boolean | null }).is_active === false) return null;

  const ownerId = (dogData as { owner_id?: string | null }).owner_id ?? null;
  if (!ownerId) {
    return {
      dog: dogData as PublicDogCardDog,
      owner: null,
    };
  }

  const { data: ownerData, error: ownerError } = await supabaseAdmin
    .from('profiles')
    .select(
      `
        user_id,
        first_name, last_name, phone, email,
        address_line, city, zip_code, province,
        dog_address_line, dog_city, dog_zip_code, dog_province,
        show_first_name_on_dog_card,
        show_last_name_on_dog_card,
        show_phone_on_dog_card,
        show_email_on_dog_card,
        show_address_on_dog_card,
        show_dog_address_on_dog_card
      `
    )
    .eq('user_id', ownerId)
    .maybeSingle();

  if (ownerError || !ownerData) {
    return {
      dog: dogData as PublicDogCardDog,
      owner: null,
    };
  }

  const owner: PublicDogCardOwner = {
    id: ownerData.user_id,
    first_name: ownerData.first_name,
    last_name: ownerData.last_name,
    phone: ownerData.phone,
    email: ownerData.email,
    address_line: ownerData.address_line,
    city: ownerData.city,
    zip_code: ownerData.zip_code,
    province: ownerData.province,
    dog_address_line: ownerData.dog_address_line,
    dog_city: ownerData.dog_city,
    dog_zip_code: ownerData.dog_zip_code,
    dog_province: ownerData.dog_province,
    show_first_name_on_dog_card: ownerData.show_first_name_on_dog_card,
    show_last_name_on_dog_card: ownerData.show_last_name_on_dog_card,
    show_phone_on_dog_card: ownerData.show_phone_on_dog_card,
    show_email_on_dog_card: ownerData.show_email_on_dog_card,
    show_address_on_dog_card: ownerData.show_address_on_dog_card,
    show_dog_address_on_dog_card: ownerData.show_dog_address_on_dog_card,
  };

  return {
    dog: dogData as PublicDogCardDog,
    owner,
  };
}

export default async function PublicDogCardPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawPublicId = resolvedParams?.publicId ?? '';

  let publicId = '';
  try {
    publicId = decodeURIComponent(rawPublicId).trim();
  } catch {
    return <ErrorView message="Scheda non valida." />;
  }

  if (!publicId) return <ErrorView message="Scheda non valida." />;

  const result = await loadPublicDogCard(publicId)
    .then((payload) => ({ payload, failed: false as const }))
    .catch((error) => {
      console.error('Errore public dog card:', error);
      return { payload: null, failed: true as const };
    });

  if (result.failed) return <ErrorView message="Errore inatteso." />;
  if (!result.payload) return <ErrorView message="Scheda non trovata." />;

  return (
    <main className="ui-page min-h-screen p-4">
      <div className="mx-auto w-full max-w-xl">
        <DogPublicCard dog={result.payload.dog} owner={result.payload.owner} showFooter />
      </div>
    </main>
  );
}

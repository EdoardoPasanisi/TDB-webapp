import Image from 'next/image';
import type { PetSpecies } from '@/types/dog';

// Icone PNG per il selettore tipo pet (stesso stile dei tasti servizi).
// I file vivono in /public: icon-pet-cane.png, icon-pet-gatto.png, icon-pet-altro.png.
const SPECIES_ICON: Record<PetSpecies, { src: string; alt: string }> = {
  DOG: { src: '/icon-pet-cane.png', alt: 'Cane' },
  CAT: { src: '/icon-pet-gatto.png', alt: 'Gatto' },
  OTHER: { src: '/icon-pet-altro.png', alt: 'Altro' },
};

export function PetSpeciesIcon({
  species,
  className = 'h-12 w-12',
}: {
  species: PetSpecies;
  className?: string;
}) {
  const icon = SPECIES_ICON[species];
  return (
    <Image
      src={icon.src}
      alt=""
      width={48}
      height={48}
      className={className}
      draggable={false}
    />
  );
}

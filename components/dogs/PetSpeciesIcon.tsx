import type { CSSProperties } from 'react';
import type { PetSpecies } from '@/types/dog';

// Icone line-art del selettore tipo pet. Sono renderizzate come "mask" e colorate
// con `currentColor`: così assumono il colore del contenitore (vedi .ui-petPickerIcon
// in globals.css) senza servire un PNG colorato per ogni tinta. I file vivono in
// /public: icon-pet-cane.png, icon-pet-gatto.png, icon-pet-altro.png (silhouette nere).
const SPECIES_ICON: Record<PetSpecies, { src: string; alt: string }> = {
  DOG: { src: '/icon-pet-cane.png', alt: 'Cane' },
  CAT: { src: '/icon-pet-gatto.png', alt: 'Gatto' },
  OTHER: { src: '/icon-pet-altro.png', alt: 'Altro' },
};

export function PetSpeciesIcon({
  species,
  className = 'h-10 w-10',
}: {
  species: PetSpecies;
  className?: string;
}) {
  const icon = SPECIES_ICON[species];
  const maskStyle: CSSProperties = {
    display: 'inline-block',
    backgroundColor: 'currentColor',
    WebkitMaskImage: `url(${icon.src})`,
    maskImage: `url(${icon.src})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };

  return <span role="img" aria-label={icon.alt} className={className} style={maskStyle} />;
}

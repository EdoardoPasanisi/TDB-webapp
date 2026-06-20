import type { PetSpecies } from '@/types/dog';

// Icone line-art per il selettore tipo pet. Usano stroke=currentColor così
// adottano il colore del riquadro (come i tasti servizi).
export function PetSpeciesIcon({
  species,
  className = 'h-12 w-12',
}: {
  species: PetSpecies;
  className?: string;
}) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  if (species === 'CAT') {
    return (
      <svg {...common}>
        <path d="M7.6 6.6 5.5 4.3c-.5-.6-1.4-.3-1.5.5L3.3 9" />
        <path d="M16.4 6.6 18.5 4.3c.5-.6 1.4-.3 1.5.5L20.7 9" />
        <path d="M12 6c2.8 0 5 1.4 5.8 3.8.7 2 .5 4.2-.8 5.8C15.6 17.4 13.9 18 12 18s-3.6-.6-5-2.4c-1.3-1.6-1.5-3.8-.8-5.8C7 7.4 9.2 6 12 6Z" />
        <path d="M8.7 11.5c.35-.7 1.15-.7 1.5 0" />
        <path d="M13.8 11.5c.35-.7 1.15-.7 1.5 0" />
        <path d="M11.2 13.6h1.6l-.8.9z" />
        <path d="M12 14.5c0 .9.8 1.4 1.6 1.1" />
        <path d="M12 14.5c0 .9-.8 1.4-1.6 1.1" />
        <path d="M7.2 11.4 4.3 10.9M7.2 13 4.5 13.8M16.8 11.4l2.9-.5M16.8 13l2.7.8" />
      </svg>
    );
  }

  if (species === 'OTHER') {
    return (
      <svg {...common}>
        <ellipse cx="6.3" cy="11" rx="1.7" ry="2.2" />
        <ellipse cx="9.7" cy="7.3" rx="1.7" ry="2.3" />
        <ellipse cx="14.3" cy="7.3" rx="1.7" ry="2.3" />
        <ellipse cx="17.7" cy="11" rx="1.7" ry="2.2" />
        <path d="M12 12.4c2.7 0 4.9 1.9 4.9 4.1 0 1.7-1.6 2.5-3.1 2-.6-.2-1.2-.4-1.8-.4s-1.2.2-1.8.4c-1.5.5-3.1-.3-3.1-2 0-2.2 2.2-4.1 4.9-4.1Z" />
      </svg>
    );
  }

  // DOG
  return (
    <svg {...common}>
      <path d="M8.2 5.6C6.3 4 3.8 4.2 2.8 6.6c-1 2.4-.6 5.6.9 6.8.7.5 1.7.4 2.4-.2" />
      <path d="M15.8 5.6C17.7 4 20.2 4.2 21.2 6.6c1 2.4.6 5.6-.9 6.8-.7.5-1.7.4-2.4-.2" />
      <path d="M12 4.2c2.1 0 3.5 1.4 4.2 3.8.8 2.7 1 6 .2 8.4-.8 2.4-2.5 3.6-4.4 3.6s-3.6-1.2-4.4-3.6c-.8-2.4-.6-5.7.2-8.4C8.5 5.6 9.9 4.2 12 4.2Z" />
      <path d="M9 11.2c.35-.7 1.15-.7 1.5 0" />
      <path d="M13.5 11.2c.35-.7 1.15-.7 1.5 0" />
      <path d="M11 15.2h2a1 1 0 0 1 .7 1.7l-1 1a1 1 0 0 1-1.4 0l-1-1A1 1 0 0 1 11 15.2Z" />
      <path d="M12 18v1.6" />
    </svg>
  );
}

// FILE: components/services/ServiceCards.tsx
'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

type ServiceKey = 'PENSIONE' | 'ASILO' | 'ADDESTRAMENTO' | 'CONSULENZA';

type ServiceCard = {
  key: ServiceKey;
  title: string;
  href: string;
};

const SERVICES: ServiceCard[] = [
  { key: 'PENSIONE', title: 'Pensione', href: '/services/pensione' },
  { key: 'ASILO', title: 'Asilo', href: '/services/asilo' },
  { key: 'ADDESTRAMENTO', title: 'Addestramento', href: '/services/addestramento' },
  { key: 'CONSULENZA', title: 'Consulenza', href: '/services/consulenza' },
];

function TileIcon({ k }: { k: ServiceKey }) {
  const base = "h-10 w-10";
  switch (k) {
    case "PENSIONE":
      return <Image src="/icon-pensione.png" alt="" width={40} height={40} className={base} draggable={false} />;
    case "ASILO":
      return <Image src="/icon-asilo.png" alt="" width={40} height={40} className={base} draggable={false} />;
    case "ADDESTRAMENTO":
      return <Image src="/icon-addestramento.png" alt="" width={40} height={40} className={base} draggable={false} />;
    case "CONSULENZA":
      return <Image src="/icon-consulenza.png" alt="" width={40} height={40} className={base} draggable={false} />;
    default:
      return null;
  }
}

function tileStyle(k: ServiceKey) {
  switch (k) {
    case 'PENSIONE':
      return { bg: 'rgba(146, 238, 179, 0.16)', fg: 'rgb(67, 201, 128)' };
    case 'ASILO':
      return { bg: 'rgba(171, 150, 255, 0.16)', fg: 'rgb(150, 120, 255)' };
    case 'ADDESTRAMENTO':
      return { bg: 'rgba(120, 210, 255, 0.16)', fg: 'rgb(120, 210, 255)' };
    case 'CONSULENZA':
      return { bg: 'rgba(255, 198, 120, 0.16)', fg: 'rgb(255, 178, 80)' };
    default:
      return { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text)' };
  }
}

export function ServiceCards() {
  const router = useRouter();

  return (
    <section className="space-y-3">
      <SectionHeader title="Servizi" subtitle="Scegli un servizio per prenotare" />

      {/* ✅ Mobile: 2 colonne quadrate */}
      <div className="grid grid-cols-2 gap-3">
        {SERVICES.map((s) => {
          const st = tileStyle(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => router.push(s.href)}
              className="w-full text-left"
              aria-label={`Apri servizio ${s.title}`}
            >
              <Card className="hover:bg-[var(--surface-2)]">
                <CardContent className="p-0">
                  <div className="aspect-square flex flex-col items-center justify-center gap-3 px-3">
                    <div
                      className="h-16 w-16 rounded-2xl flex items-center justify-center"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      <TileIcon k={s.key} />
                    </div>

                    {/* ✅ Nome visibile */}
                    <div className="text-center">
                      <div className="text-sm font-semibold text-[var(--text)] leading-tight">
                        {s.title}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </section>
  );
}

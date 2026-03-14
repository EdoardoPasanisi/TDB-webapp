// FILE: components/services/ServicePassCards.tsx
'use client';

import type { ServicePassGroupSummary } from '@/types/services';
import { getServiceLabel } from '@/types/services';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function ServicePassCards({
  passes,
  onFixDate,
}: {
  passes: ServicePassGroupSummary[];
  onFixDate: (passGroup: ServicePassGroupSummary) => void;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader title="Crediti" subtitle="Tocca una tessera per fissare una data" />

      {passes.length === 0 ? (
        <Card>
          <CardContent className="ui-muted">Nessun credito disponibile.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {passes.map((g) => {
            const label = getServiceLabel(g.serviceType, g.serviceVariant); // ✅ nome completo
            return (
              <button
                key={g.groupKey}
                type="button"
                onClick={() => onFixDate(g)}
                className="w-full text-left"
                aria-label={`Crediti ${label}. Tocca per fissare una data.`}
              >
                <Card className="ui-cardHover">
                  <CardContent className="p-0">
                    <div className="aspect-square flex flex-col items-center justify-center gap-3 px-3">
                      <div className="ui-fine text-center leading-snug line-clamp-3">
                        {label}
                      </div>

                      <div className="ui-accentCircle">
                        {g.creditsRemaining}
                      </div>

                      <div className="ui-fine text-center">
                        Tocca per fissare
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

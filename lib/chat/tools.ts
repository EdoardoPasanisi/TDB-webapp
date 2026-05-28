import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createOperatorHandoff } from '@/lib/chat/db';
import { getServiceLabel, type ServiceType, type ServiceVariant } from '@/types/services';
import type { Dog } from '@/types/dog';
import {
  ACCOMMODATION_PRICES,
  EXTRA_PRICES,
  GROOMING_BASE_BY_SIZE,
  GROOMING_MULTIPLIER_BY_DIFFICULTY,
  TAXI_PRICES_WITH_DISTANCE,
} from '@/lib/services/pensione/constants';
import { computeGroomingPriceForDog } from '@/lib/services/pensione/utils';
import type { ChatConversationRow, ChatHandoffReason } from '@/types/chat';

type UserDocumentRow = {
  id: string;
  kind: 'ID_DOCUMENT' | 'WAIVER_SIGNED';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  staff_note: string | null;
};

type PensioneBookingRow = {
  id: string;
  service_type: string | null;
  status: string | null;
  start_date: string;
  end_date: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  total_price: number | null;
  booking_dogs?: Array<{
    dogs?: { name: string | null } | Array<{ name: string | null }> | null;
  }> | null;
};

type SlotBookingRow = {
  id: string;
  service_type: ServiceType | null;
  service_variant: ServiceVariant | null;
  status: string | null;
  total_price: number | null;
  dog_ids: string[] | null;
  service_slots?: {
    start_at: string;
    end_at: string;
    service_type: ServiceType;
    service_variant: ServiceVariant | null;
  } | Array<{
    start_at: string;
    end_at: string;
    service_type: ServiceType;
    service_variant: ServiceVariant | null;
  }> | null;
};

type DogProfileRow = Pick<
  Dog,
  'id' | 'name' | 'breed' | 'size_category' | 'grooming_difficulty' | 'is_active'
>;

type ServiceProductLite = {
  id: string;
  service_type: ServiceType;
  service_variant: ServiceVariant | null;
  name: string;
  credits: number;
  price_eur: number;
  is_active: boolean;
};

function formatDogSizeLabel(value: Dog['size_category'] | null | undefined): string | null {
  if (value === 'toy') return 'Toy';
  if (value === 'piccola') return 'Piccola';
  if (value === 'media') return 'Media';
  if (value === 'grande') return 'Grande';
  if (value === 'gigante') return 'Gigante';
  return null;
}

function formatGroomingDifficultyLabel(value: Dog['grooming_difficulty'] | null | undefined): string | null {
  if (value === 1) return 'Bassa';
  if (value === 2) return 'Media';
  if (value === 3) return 'Alta';
  return null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function getDogNamesFromBookingDogs(
  bookingDogs: PensioneBookingRow['booking_dogs']
): string[] {
  return (bookingDogs ?? [])
    .map((row) => firstRelation(row.dogs)?.name ?? null)
    .filter((name): name is string => Boolean(name));
}

function normalizeServiceType(value: unknown): ServiceType | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (
    normalized === 'PENSIONE' ||
    normalized === 'ASILO' ||
    normalized === 'ADDESTRAMENTO' ||
    normalized === 'CONSULENZA'
  ) {
    return normalized;
  }
  return null;
}

function normalizeServiceVariant(value: unknown): ServiceVariant | null | undefined {
  if (value == null || String(value).trim() === '') return undefined;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === 'SESSION_60' || normalized === 'HALF' || normalized === 'FULL') {
    return normalized;
  }
  return null;
}

function normalizeIsoDate(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

export function getChatToolDefinitions() {
  return [
    {
      type: 'function',
      name: 'get_operational_hours',
      description:
        'Recupera le informazioni operative confermate su finestre orarie di ingresso/uscita e conteggio giorni pensione.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_service_pricing_reference',
      description:
        'Recupera i prezzi o i riferimenti tariffari confermati per pensione, asilo, addestramento, consulenza, taxi dog e toelettatura.',
      parameters: {
        type: 'object',
        properties: {
          serviceKey: {
            type: 'string',
            enum: ['PENSIONE', 'ASILO', 'ADDESTRAMENTO', 'CONSULENZA', 'TAXI_DOG', 'TOELETTATURA'],
          },
        },
        required: ['serviceKey'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_user_dogs_profile',
      description:
        'Recupera i cani attivi del cliente autenticato con taglia e difficolta di toelettatura.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_user_grooming_quotes',
      description:
        'Stima il prezzo toelettatura per i cani del cliente usando taglia e difficolta di lavaggio presenti nel sistema.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_user_document_status',
      description: 'Recupera lo stato dei documenti caricati dal cliente autenticato.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_user_bookings_status',
      description: 'Recupera le prenotazioni del cliente autenticato, sia pensione sia servizi a slot.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_user_service_passes',
      description: 'Recupera i pacchetti crediti del cliente autenticato.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'get_service_availability',
      description:
        'Recupera le disponibilita dei servizi a slot in un intervallo di date. Usare solo per ASILO, ADDESTRAMENTO o CONSULENZA.',
      parameters: {
        type: 'object',
        properties: {
          serviceType: {
            type: 'string',
            enum: ['ASILO', 'ADDESTRAMENTO', 'CONSULENZA'],
          },
          serviceVariant: {
            type: ['string', 'null'],
            enum: ['SESSION_60', 'HALF', 'FULL', null],
          },
          startDate: {
            type: 'string',
            description: 'Data iniziale in formato YYYY-MM-DD.',
          },
          endDate: {
            type: 'string',
            description: 'Data finale esclusiva o ultimo giorno da considerare, in formato YYYY-MM-DD.',
          },
        },
        required: ['serviceType', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'create_operator_handoff',
      description:
        'Passa la conversazione a un operatore umano quando il cliente lo chiede, quando la risposta non e affidabile o quando il tema e delicato.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: ['USER_REQUEST', 'MODEL_UNCERTAIN', 'SENSITIVE_TOPIC', 'SYSTEM_ERROR'],
          },
          summary: {
            type: 'string',
            description: 'Breve motivo leggibile per il gestionale.',
          },
        },
        required: ['reason', 'summary'],
        additionalProperties: false,
      },
    },
  ] as const;
}

async function getOperationalHours() {
  return {
    weeklySchedule: [
      {
        daysLabel: 'Lunedi-Sabato',
        morning: '09:00-13:00',
        afternoon: '15:00-18:00',
      },
      {
        daysLabel: 'Domenica',
        morning: '09:00-13:00',
        afternoon: null,
        note: 'La domenica pomeriggio la struttura e chiusa.',
      },
    ],
    practicalSummary: [
      'Dal lunedi al sabato ingresso e uscita sono disponibili 09:00-13:00 e 15:00-18:00.',
      'La domenica ingresso e uscita sono disponibili solo 09:00-13:00.',
      'La domenica pomeriggio la struttura e chiusa, quindi non sono possibili ritiri o consegne in quella fascia.',
      'E consigliato arrivare almeno 30 minuti prima della chiusura.',
    ],
    ingressoUscita: {
      mattina: '09:00-13:00',
      pomeriggio: '15:00-18:00',
      sunday: {
        mattina: '09:00-13:00',
        pomeriggio: null,
        note: 'La domenica pomeriggio la struttura è chiusa.',
      },
      recommendedArrivalBeforeCloseMinutes: 30,
    },
    pensione: {
      firstDayAlwaysCounted: true,
      checkoutBefore: '13:00',
      checkoutBeforeCountsDay: false,
      checkoutAfternoonCountsDay: true,
      note:
        'Il primo giorno si conta sempre. Il giorno di uscita non viene calcolato se il box viene liberato entro le 13:00; nel pomeriggio la giornata viene conteggiata per intero.',
    },
    source: ['lib/services/pensione/utils.ts', 'app/account/waiver/page.tsx', 'knowledge-base'],
  };
}

async function getServicePricingReference(args: { serviceKey: unknown }) {
  const serviceKey = String(args.serviceKey ?? '').trim().toUpperCase();

  if (serviceKey === 'PENSIONE') {
    return {
      serviceKey,
      accommodationPricesPerDay: Object.entries(ACCOMMODATION_PRICES).map(([key, value]) => ({
        code: key,
        label: value.label,
        pricePerDay: value.pricePerDay,
      })),
      extras: {
        vaccine: EXTRA_PRICES.VACCINE,
        tracking: EXTRA_PRICES.TRACKING,
        fitness: EXTRA_PRICES.FITNESS,
        walk: EXTRA_PRICES.WALK,
      },
      discounts: [
        { dogsCount: 1, accommodationDiscountPercent: 0 },
        { dogsCount: 2, accommodationDiscountPercent: 15 },
        { dogsCount: 3, accommodationDiscountPercent: 20, appliesAlsoToMoreDogs: true },
      ],
      checkoutRule:
        'Il primo giorno si conta sempre. Il giorno di uscita non viene calcolato se il box viene liberato entro le 13:00; nel pomeriggio la giornata viene conteggiata per intero.',
    };
  }

  if (serviceKey === 'TAXI_DOG') {
    return {
      serviceKey,
      pensioneTaxiPrices: Object.entries(TAXI_PRICES_WITH_DISTANCE).map(([band, prices]) => ({
        distanceBand: band,
        oneWay: prices.ONE_WAY,
        returnOnly: prices.RETURN_ONLY,
        roundTrip: prices.ROUND_TRIP,
      })),
      slotServicesTaxiPrices: [
        { distanceBand: 'LE_40KM', priceEur: 15 },
        { distanceBand: 'GT_40KM', priceEur: 25 },
      ],
      coverage:
        'Roma, litorale romano e zone intorno a Fiumicino e Palidoro.',
      availableFor: ['Pensione', 'Asilo'],
    };
  }

  if (serviceKey === 'TOELETTATURA') {
    return {
      serviceKey,
      pricingMethod:
        'Il prezzo viene stimato in base a taglia del cane e difficolta di lavaggio, poi arrotondato a 5 euro.',
      rangesBySize: Object.entries(GROOMING_BASE_BY_SIZE).map(([size, base]) => {
        const values = [1, 2, 3].map((difficulty) => {
          const raw =
            base * GROOMING_MULTIPLIER_BY_DIFFICULTY[difficulty as 1 | 2 | 3];
          return Math.round(raw / 5) * 5;
        });

        return {
          size,
          minPrice: Math.min(...values),
          maxPrice: Math.max(...values),
        };
      }),
    };
  }

  if (
    serviceKey === 'ASILO' ||
    serviceKey === 'ADDESTRAMENTO' ||
    serviceKey === 'CONSULENZA'
  ) {
    const serviceType = serviceKey as Extract<ServiceType, 'ASILO' | 'ADDESTRAMENTO' | 'CONSULENZA'>;
    const { data, error } = await supabaseAdmin
      .from('service_products')
      .select('id, service_type, service_variant, name, credits, price_eur, is_active')
      .eq('service_type', serviceType)
      .eq('is_active', true)
      .order('price_eur', { ascending: true });

    if (error) throw new Error(error.message);

    return {
      serviceKey,
      products: ((data ?? []) as ServiceProductLite[]).map((product) => ({
        id: product.id,
        serviceLabel: getServiceLabel(product.service_type, product.service_variant),
        name: product.name,
        credits: product.credits,
        priceEur: product.price_eur,
      })),
    };
  }

  return {
    ok: false,
    message: 'Servizio non supportato dal tool prezzi.',
  };
}

async function getUserDogsProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('dogs')
    .select('id, name, breed, size_category, grooming_difficulty, is_active')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  const dogs = (data ?? []) as DogProfileRow[];
  return {
    dogs: dogs.map((dog) => ({
      id: dog.id,
      name: dog.name,
      breed: dog.breed ?? null,
      size: dog.size_category,
      sizeLabel: formatDogSizeLabel(dog.size_category),
      groomingDifficulty: dog.grooming_difficulty,
      groomingDifficultyLabel: formatGroomingDifficultyLabel(dog.grooming_difficulty),
    })),
  };
}

async function getUserGroomingQuotes(userId: string) {
  const profile = await getUserDogsProfile(userId);
  const dogs = profile.dogs as Array<{
    id: string;
    name: string;
    breed: string | null;
    size: Dog['size_category'] | null;
    groomingDifficulty: Dog['grooming_difficulty'] | null;
  }>;

  return {
    dogs: dogs.map((dog) => ({
      id: dog.id,
      name: dog.name,
      breed: dog.breed,
      size: dog.size,
      sizeLabel: formatDogSizeLabel(dog.size),
      groomingDifficulty: dog.groomingDifficulty,
      groomingDifficultyLabel: formatGroomingDifficultyLabel(dog.groomingDifficulty),
      estimatedPriceEur: computeGroomingPriceForDog({
        id: dog.id,
        name: dog.name,
        photo_path: null,
        updated_at: null,
        size_category: dog.size,
        grooming_difficulty: dog.groomingDifficulty,
      }),
    })),
    note:
      'Stima automatica basata sui dati del cane presenti nel sistema. Se servono lavorazioni particolari o condizioni del mantello non standard, puo servire conferma operatore.',
  };
}

async function getUserDocumentStatus(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_documents')
    .select('id, kind, status, created_at, accepted_at, rejected_at, staff_note')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as UserDocumentRow[]).slice(0, 10);
  const latestByKind = new Map<string, UserDocumentRow>();
  for (const row of rows) {
    if (!latestByKind.has(row.kind)) latestByKind.set(row.kind, row);
  }

  return {
    documents: rows,
    latestByKind: Array.from(latestByKind.values()),
    hasPending: rows.some((row) => row.status === 'PENDING'),
  };
}

async function getUserBookingsStatus(userId: string) {
  const [pensioneRes, slotRes] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select(
        'id, service_type, status, start_date, end_date, arrival_time, departure_time, total_price, booking_dogs(dogs(name))'
      )
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('service_slot_bookings')
      .select(
        'id, service_type, service_variant, status, total_price, dog_ids, service_slots(start_at, end_at, service_type, service_variant)'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (pensioneRes.error) throw new Error(pensioneRes.error.message);
  if (slotRes.error) throw new Error(slotRes.error.message);

  const pensione = ((pensioneRes.data ?? []) as PensioneBookingRow[]).map((row) => ({
    id: row.id,
    serviceType: row.service_type ?? 'PENSIONE',
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    arrivalTime: row.arrival_time,
    departureTime: row.departure_time,
    totalPrice: row.total_price,
    dogNames: getDogNamesFromBookingDogs(row.booking_dogs),
  }));

  const slotBookings = ((slotRes.data ?? []) as SlotBookingRow[]).map((row) => {
    const slot = firstRelation(row.service_slots);
    const serviceType = row.service_type ?? slot?.service_type ?? null;
    const serviceVariant = row.service_variant ?? slot?.service_variant ?? null;

    return {
      id: row.id,
      serviceType,
      serviceVariant,
      serviceLabel: serviceType ? getServiceLabel(serviceType, serviceVariant) : 'Servizio',
      status: row.status,
      startAt: slot?.start_at ?? null,
      endAt: slot?.end_at ?? null,
      totalPrice: row.total_price,
      dogsCount: row.dog_ids?.length ?? 0,
    };
  });

  return {
    pensione,
    slotBookings,
    totalCount: pensione.length + slotBookings.length,
  };
}

async function getUserServicePasses(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('service_passes')
    .select(
      'id, service_type, service_variant, credits_total, credits_used, status, purchased_at, expires_at, unlocked_at'
    )
    .eq('user_id', userId)
    .order('purchased_at', { ascending: false });

  if (error) throw new Error(error.message);

  const passes = (data ?? []).map((row) => {
    const pass = row as {
      id: string;
      service_type: ServiceType;
      service_variant: ServiceVariant | null;
      credits_total: number;
      credits_used: number;
      status: string;
      purchased_at: string;
      expires_at: string | null;
      unlocked_at: string | null;
    };

    return {
      id: pass.id,
      serviceType: pass.service_type,
      serviceVariant: pass.service_variant,
      serviceLabel: getServiceLabel(pass.service_type, pass.service_variant),
      creditsTotal: pass.credits_total,
      creditsUsed: pass.credits_used,
      creditsRemaining: Math.max(0, pass.credits_total - pass.credits_used),
      status: pass.status,
      purchasedAt: pass.purchased_at,
      expiresAt: pass.expires_at,
      unlockedAt: pass.unlocked_at,
    };
  });

  return {
    passes,
    activeCount: passes.filter((pass) => pass.status === 'ACTIVE').length,
  };
}

async function getServiceAvailability(args: {
  serviceType: unknown;
  serviceVariant?: unknown;
  startDate: unknown;
  endDate: unknown;
}) {
  const serviceType = normalizeServiceType(args.serviceType);
  const serviceVariant = normalizeServiceVariant(args.serviceVariant);
  const startDate = normalizeIsoDate(args.startDate);
  const endDate = normalizeIsoDate(args.endDate);

  if (!serviceType || serviceType === 'PENSIONE') {
    return {
      ok: false,
      message: 'La disponibilita live e disponibile solo per ASILO, ADDESTRAMENTO e CONSULENZA.',
    };
  }
  if (!startDate || !endDate) {
    return {
      ok: false,
      message: 'Le date devono essere in formato YYYY-MM-DD.',
    };
  }

  let query = supabaseAdmin
    .from('service_slots_with_remaining')
    .select('id, service_type, service_variant, start_at, end_at, remaining_capacity, capacity')
    .eq('service_type', serviceType)
    .eq('is_active', true)
    .gt('remaining_capacity', 0)
    .gte('start_at', `${startDate}T00:00:00`)
    .lte('start_at', `${endDate}T23:59:59`)
    .order('start_at', { ascending: true })
    .limit(20);

  if (serviceVariant === null) {
    return {
      ok: false,
      message: 'La variante richiesta non e valida per questo servizio.',
    };
  }

  if (serviceVariant === undefined) {
    // Nessun filtro aggiuntivo.
  } else {
    query = query.eq('service_variant', serviceVariant);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return {
    ok: true,
    serviceType,
    serviceVariant: serviceVariant ?? null,
    serviceLabel: getServiceLabel(serviceType, serviceVariant ?? null),
    slots: (data ?? []).map((row) => {
      const slot = row as {
        id: string;
        start_at: string;
        end_at: string;
        remaining_capacity: number;
        capacity: number;
      };

      return {
        id: slot.id,
        startAt: slot.start_at,
        endAt: slot.end_at,
        remainingCapacity: slot.remaining_capacity,
        capacity: slot.capacity,
      };
    }),
  };
}

async function requestOperatorHandoff(args: {
  conversation: ChatConversationRow;
  reason: unknown;
  summary: unknown;
}) {
  const reason = String(args.reason ?? '').trim().toUpperCase() as ChatHandoffReason;
  const summary = String(args.summary ?? '').trim();

  if (
    reason !== 'USER_REQUEST' &&
    reason !== 'MODEL_UNCERTAIN' &&
    reason !== 'SENSITIVE_TOPIC' &&
    reason !== 'SYSTEM_ERROR'
  ) {
    throw new Error('Motivo handoff non valido.');
  }

  const conversation = await createOperatorHandoff({
    conversationId: args.conversation.id,
    reason,
    summary: summary || 'Richiesta operatore.',
  });

  return {
    ok: true,
    status: conversation.status,
    handoffReason: conversation.handoff_reason,
    handoffSummary: conversation.handoff_summary,
  };
}

export async function executeChatTool(args: {
  conversation: ChatConversationRow;
  userId: string;
  name: string;
  rawArguments: string;
}) {
  const parsedArguments = args.rawArguments ? JSON.parse(args.rawArguments) : {};

  if (args.name === 'get_operational_hours') {
    return getOperationalHours();
  }
  if (args.name === 'get_service_pricing_reference') {
    return getServicePricingReference(parsedArguments);
  }
  if (args.name === 'get_user_dogs_profile') {
    return getUserDogsProfile(args.userId);
  }
  if (args.name === 'get_user_grooming_quotes') {
    return getUserGroomingQuotes(args.userId);
  }
  if (args.name === 'get_user_document_status') {
    return getUserDocumentStatus(args.userId);
  }
  if (args.name === 'get_user_bookings_status') {
    return getUserBookingsStatus(args.userId);
  }
  if (args.name === 'get_user_service_passes') {
    return getUserServicePasses(args.userId);
  }
  if (args.name === 'get_service_availability') {
    return getServiceAvailability(parsedArguments);
  }
  if (args.name === 'create_operator_handoff') {
    return requestOperatorHandoff({
      conversation: args.conversation,
      reason: parsedArguments.reason,
      summary: parsedArguments.summary,
    });
  }

  throw new Error(`Tool non supportato: ${args.name}`);
}

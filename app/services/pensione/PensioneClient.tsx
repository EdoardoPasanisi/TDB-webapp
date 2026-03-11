// FILE: app/services/pensione/PensioneClient.tsx
'use client';

import { PensioneBookingForm } from '@/components/services/pensione/PensioneBookingForm';
import { usePensioneBooking } from '@/lib/services/pensione/hooks/usePensioneBooking';

export default function PensioneClient() {
  const {
    loading,
    saving,
    error,
    dogs,
    isSingleDog,
    effectiveSelectedDogIds,
    startDate,
    endDate,
    arrivalTime,
    departureTime,
    taxiOption,
    taxiDistanceBand,
    taxiDistance,
    notes,
    perDogForm,
    daysCount,
    pricing,
    setStartDate,
    setEndDate,
    setArrivalTime,
    setDepartureTime,
    setTaxiOption,
    setNotes,
    toggleDogSelection,
    updatePerDogField,
    editingBookingId,
    handleCancelEdit,
    submit,
  } = usePensioneBooking();

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-sm text-gray-700">Caricamento...</p>
      </main>
    );
  }

  return (
    <PensioneBookingForm
      title={`Prenotazione pensione${editingBookingId ? ' (modifica)' : ''}`}
      error={error}
      saving={saving}
      dogs={dogs}
      isSingleDog={isSingleDog}
      selectedDogIds={effectiveSelectedDogIds}
      startDate={startDate}
      endDate={endDate}
      arrivalTime={arrivalTime}
      departureTime={departureTime}
      taxiOption={taxiOption}
      taxiDistanceBand={taxiDistanceBand}
      taxiDistance={taxiDistance}
      notes={notes}
      perDogForm={perDogForm}
      daysCount={daysCount}
      pricing={pricing}
      onToggleDog={toggleDogSelection}
      onChangeStartDate={setStartDate}
      onChangeEndDate={setEndDate}
      onChangeArrivalTime={setArrivalTime}
      onChangeDepartureTime={setDepartureTime}
      onChangeTaxiOption={setTaxiOption}
      onChangeNotes={setNotes}
      onUpdatePerDogField={updatePerDogField}
      onCancelEdit={handleCancelEdit}
      onSubmit={submit}
      showCancelEdit={!!editingBookingId}
    />
  );
}

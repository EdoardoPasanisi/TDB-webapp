// FILE: app/services/pensione/PensioneClient.tsx
'use client';

import { PensioneBookingForm } from '@/components/services/pensione/PensioneBookingForm';
import { usePensioneBooking } from '@/lib/services/pensione/hooks/usePensioneBooking';

export default function PensioneClient() {
  const {
    loading,
    saving,
    error,
    blockedMessage,
    missingRequiredFields,
    missingPetFields,
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
    taxiServiceAddress,
    showTaxiServiceAddressEditor,
    notes,
    perDogForm,
    daysCount,
    pricing,
    setStartDate,
    setEndDate,
    setArrivalTime,
    setDepartureTime,
    setTaxiOption,
    updateTaxiServiceAddressField,
    setNotes,
    toggleDogSelection,
    updatePerDogField,
    editingBookingId,
    handleCancelEdit,
    handleRequiredProfileSaved,
    submit,
  } = usePensioneBooking();

  if (loading) {
    return (
      <main className="ui-page min-h-screen flex items-center justify-center">
        <p className="ui-muted">Caricamento...</p>
      </main>
    );
  }

  return (
    <PensioneBookingForm
      title={`Prenotazione pensione${editingBookingId ? ' (modifica)' : ''}`}
      error={error}
      blockedMessage={blockedMessage}
      missingRequiredFields={missingRequiredFields}
      missingPetFields={missingPetFields}
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
      taxiServiceAddress={taxiServiceAddress}
      showTaxiServiceAddressEditor={showTaxiServiceAddressEditor}
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
      onChangeTaxiServiceAddressField={updateTaxiServiceAddressField}
      onChangeNotes={setNotes}
      onUpdatePerDogField={updatePerDogField}
      onCancelEdit={handleCancelEdit}
      onCompleteRequiredProfile={handleRequiredProfileSaved}
      onSubmit={submit}
      showCancelEdit={!!editingBookingId}
    />
  );
}

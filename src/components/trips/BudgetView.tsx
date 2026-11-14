import React from 'react';
import { useBudgetCalculations } from './budget/useBudgetCalculations';
import { useBudgetActions } from './budget/useBudgetActions';
import { useBudgetSettings } from './budget/useBudgetSettings';
import { TripData } from '../../types/travel';
import { ReceiptPreviewModal } from './budget/ReceiptImage';
import { BudgetSummary } from './budget/BudgetSummary';
import { ExpenseLedger } from './budget/ExpenseLedger';
import { InvoiceEditorModal } from './budget/InvoiceEditorModal';
import { ExpenseReportModal } from './budget/ExpenseReportModal';
import { BudgetEditModals } from './budget/BudgetEditModals';

interface BudgetViewProps {
  trip: TripData;
  onUpdateTripBudget?: (updatedTrip: TripData) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  trip,
  onUpdateTripBudget,
  searchQuery = '',
  onClearSearch,
}) => {
  const budgetData = useBudgetCalculations(trip, searchQuery);
  const {
    currentAllocations,
    allActivities,
    totalActivityCosts,
    invoicesList,
    totalInvoicesCosts,
    totalBudget,
    spentBudget,
    remainingBudget,
    percentUsed,
    categories,
    expenseActivities,
    filteredInvoices,
    filteredActivities,
  } = budgetData;
  const budgetActions = useBudgetActions({
    trip,
    onUpdateTripBudget,
    totalActivityCosts,
    invoicesList,
    totalBudget,
    spentBudget,
  });
  const budgetSettings = useBudgetSettings({
    trip,
    onUpdateTripBudget,
    currentAllocations,
    totalInvoicesCosts,
    totalBudget,
    spentBudget,
  });
  const {
    isInvoiceModalOpen,
    setIsInvoiceModalOpen,
    activeTab,
    setActiveTab,
    editingInvoiceId,
    invTitle,
    setInvTitle,
    invAmount,
    setInvAmount,
    invCategory,
    setInvCategory,
    invVendor,
    setInvVendor,
    invNumber,
    setInvNumber,
    invDate,
    setInvDate,
    invDayIndex,
    setInvDayIndex,
    invNote,
    setInvNote,
    invReceiptImage,
    setInvReceiptImage,
    invReceiptId,
    setInvReceiptId,
    isUploadingReceipt,
    isSavingInvoice,
    receiptUploadError,
    previewReceiptInvoice,
    setPreviewReceiptInvoice,
    isReportPreviewOpen,
    setIsReportPreviewOpen,
    resetInvoiceForm,
    openCreateInvoiceModal,
    openEditInvoiceModal,
    handleReceiptFileChange,
    handleSaveInvoice,
    handleExportCsv,
    handleDeleteInvoice,
  } = budgetActions;
  const {
    isEditBudgetOpen,
    setIsEditBudgetOpen,
    isEditAllocationsOpen,
    setIsEditAllocationsOpen,
    editingActivity,
    setEditingActivity,
    editedCost,
    setEditedCost,
    newTotalBudget,
    setNewTotalBudget,
    allocTransport,
    setAllocTransport,
    allocHotel,
    setAllocHotel,
    allocMeal,
    setAllocMeal,
    allocSightseeing,
    setAllocSightseeing,
    allocContingency,
    setAllocContingency,
    handleEditTotalBudget,
    handleSaveCategoryAllocations,
    handleSaveActivityCost,
  } = budgetSettings;

  return (
    <div className="space-y-6">
      <BudgetSummary
        trip={trip}
        totalBudget={totalBudget}
        spentBudget={spentBudget}
        remainingBudget={remainingBudget}
        percentUsed={percentUsed}
        activityCount={allActivities.length}
        invoiceCount={invoicesList.length}
        categories={categories}
        handleExportCsv={handleExportCsv}
        setIsReportPreviewOpen={setIsReportPreviewOpen}
        setIsEditAllocationsOpen={setIsEditAllocationsOpen}
        setIsEditBudgetOpen={setIsEditBudgetOpen}
        openCreateInvoiceModal={openCreateInvoiceModal}
      />

      <ExpenseLedger
        trip={trip}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        invoices={invoicesList}
        expenseActivities={expenseActivities}
        filteredInvoices={filteredInvoices}
        filteredActivities={filteredActivities}
        onCreateInvoice={openCreateInvoiceModal}
        onPreviewReceipt={setPreviewReceiptInvoice}
        onEditInvoice={openEditInvoiceModal}
        onDeleteInvoice={handleDeleteInvoice}
        onEditActivity={(activity) => {
          setEditingActivity(activity);
          setEditedCost(activity.cost || 0);
        }}
      />

      <InvoiceEditorModal
        trip={trip}
        isOpen={isInvoiceModalOpen}
        editingInvoiceId={editingInvoiceId}
        onClose={() => { setIsInvoiceModalOpen(false); resetInvoiceForm(); }}
        onSubmit={handleSaveInvoice}
        title={invTitle} setTitle={setInvTitle}
        amount={invAmount} setAmount={setInvAmount}
        category={invCategory} setCategory={setInvCategory}
        vendor={invVendor} setVendor={setInvVendor}
        invoiceNumber={invNumber} setInvoiceNumber={setInvNumber}
        date={invDate} setDate={setInvDate}
        dayIndex={invDayIndex} setDayIndex={setInvDayIndex}
        note={invNote} setNote={setInvNote}
        receiptImage={invReceiptImage} setReceiptImage={setInvReceiptImage}
        receiptId={invReceiptId} setReceiptId={setInvReceiptId}
        isUploadingReceipt={isUploadingReceipt}
        isSavingInvoice={isSavingInvoice}
        receiptUploadError={receiptUploadError}
        onReceiptFileChange={handleReceiptFileChange}
      />

      <ReceiptPreviewModal
        tripId={trip.id}
        invoice={previewReceiptInvoice}
        onClose={() => setPreviewReceiptInvoice(null)}
      />

      <ExpenseReportModal
        isOpen={isReportPreviewOpen}
        trip={trip}
        totalBudget={totalBudget}
        spentBudget={spentBudget}
        remainingBudget={remainingBudget}
        invoices={invoicesList}
        expenseActivities={expenseActivities}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        onClose={() => setIsReportPreviewOpen(false)}
      />

      <BudgetEditModals
        isEditBudgetOpen={isEditBudgetOpen} setIsEditBudgetOpen={setIsEditBudgetOpen}
        newTotalBudget={newTotalBudget} setNewTotalBudget={setNewTotalBudget}
        onSaveTotalBudget={handleEditTotalBudget}
        isEditAllocationsOpen={isEditAllocationsOpen} setIsEditAllocationsOpen={setIsEditAllocationsOpen}
        allocTransport={allocTransport} setAllocTransport={setAllocTransport}
        allocHotel={allocHotel} setAllocHotel={setAllocHotel}
        allocMeal={allocMeal} setAllocMeal={setAllocMeal}
        allocSightseeing={allocSightseeing} setAllocSightseeing={setAllocSightseeing}
        allocContingency={allocContingency} setAllocContingency={setAllocContingency}
        onSaveAllocations={handleSaveCategoryAllocations}
        editingActivity={editingActivity} setEditingActivity={setEditingActivity}
        editedCost={editedCost} setEditedCost={setEditedCost}
        onSaveActivityCost={handleSaveActivityCost}
      />
    </div>
  );
};

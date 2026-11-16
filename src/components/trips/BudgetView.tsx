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
    totalAllocatedSum,
    allActivities,
    linkedActivityIds,
    actualSpentBudget,
    plannedCommittedBudget,
    pendingApprovalBudget,
    pendingApprovalCount,
    invoicesList,
    totalBudget,
    spentBudget,
    remainingBudget,
    overBudgetAmount,
    rawPercentUsed,
    isOverTotalBudget,
    isNearTotalBudget,
    categories,
    expenseActivities,
    filteredInvoices,
    filteredActivities,
  } = budgetData;
  const budgetActions = useBudgetActions({
    trip,
    onUpdateTripBudget,
    invoicesList,
  });
  const budgetSettings = useBudgetSettings({
    trip,
    onUpdateTripBudget,
    currentAllocations,
    totalBudget,
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
    handleDateChange,
    invDayIndex,
    handleDayIndexChange,
    invLinkedActivityId,
    handleLinkedActivityChange,
    invNote,
    setInvNote,
    invReceiptImage,
    setInvReceiptImage,
    invReceiptId,
    setInvReceiptId,
    isUploadingReceipt,
    isSavingInvoice,
    receiptUploadError,
    invoiceError,
    invoiceLimitReached,
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
    openEditBudgetModal,
    isEditAllocationsOpen,
    setIsEditAllocationsOpen,
    openEditAllocationsModal,
    handleResetAllocationsToDefault,
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
    allocValidationError,
    handleEditTotalBudget,
    handleSaveCategoryAllocations,
    handleSaveActivityCost,
  } = budgetSettings;

  const originalEditingInvoice = editingInvoiceId
    ? invoicesList.find((i) => i.id === editingInvoiceId) || null
    : null;

  return (
    <div className="space-y-6">
      <BudgetSummary
        trip={trip}
        totalBudget={totalBudget}
        totalAllocatedSum={totalAllocatedSum}
        spentBudget={spentBudget}
        actualSpentBudget={actualSpentBudget}
        plannedCommittedBudget={plannedCommittedBudget}
        pendingApprovalBudget={pendingApprovalBudget}
        pendingApprovalCount={pendingApprovalCount}
        remainingBudget={remainingBudget}
        overBudgetAmount={overBudgetAmount}
        rawPercentUsed={rawPercentUsed}
        isOverTotalBudget={isOverTotalBudget}
        isNearTotalBudget={isNearTotalBudget}
        activityCount={allActivities.length}
        invoiceCount={invoicesList.length}
        invoiceLimitReached={invoiceLimitReached}
        categories={categories}
        handleExportCsv={handleExportCsv}
        setIsReportPreviewOpen={setIsReportPreviewOpen}
        onOpenEditAllocations={openEditAllocationsModal}
        onOpenEditBudget={openEditBudgetModal}
        openCreateInvoiceModal={openCreateInvoiceModal}
      />

      <ExpenseLedger
        trip={trip}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        invoices={invoicesList}
        expenseActivities={expenseActivities}
        linkedActivityIds={linkedActivityIds}
        filteredInvoices={filteredInvoices}
        filteredActivities={filteredActivities}
        searchQuery={searchQuery}
        onClearSearch={onClearSearch}
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
        totalBudget={totalBudget}
        spentBudget={spentBudget}
        categories={categories}
        linkedActivityIds={linkedActivityIds}
        originalEditingInvoice={
          originalEditingInvoice
            ? {
                category: originalEditingInvoice.category,
                amount: originalEditingInvoice.amount,
                linkedActivityId: originalEditingInvoice.linkedActivityId,
              }
            : null
        }
        onClose={() => { setIsInvoiceModalOpen(false); resetInvoiceForm(); }}
        onSubmit={handleSaveInvoice}
        title={invTitle} setTitle={setInvTitle}
        amount={invAmount} setAmount={setInvAmount}
        category={invCategory} setCategory={setInvCategory}
        vendor={invVendor} setVendor={setInvVendor}
        invoiceNumber={invNumber} setInvoiceNumber={setInvNumber}
        date={invDate} onDateChange={handleDateChange}
        dayIndex={invDayIndex} onDayIndexChange={handleDayIndexChange}
        linkedActivityId={invLinkedActivityId} onLinkedActivityChange={handleLinkedActivityChange}
        note={invNote} setNote={setInvNote}
        receiptImage={invReceiptImage} setReceiptImage={setInvReceiptImage}
        receiptId={invReceiptId} setReceiptId={setInvReceiptId}
        isUploadingReceipt={isUploadingReceipt}
        isSavingInvoice={isSavingInvoice}
        receiptUploadError={receiptUploadError}
        invoiceError={invoiceError}
        invoiceLimitReached={invoiceLimitReached}
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
        actualSpentBudget={actualSpentBudget}
        plannedCommittedBudget={plannedCommittedBudget}
        remainingBudget={remainingBudget}
        invoices={invoicesList}
        expenseActivities={expenseActivities}
        linkedActivityIds={linkedActivityIds}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        onClose={() => setIsReportPreviewOpen(false)}
      />

      <BudgetEditModals
        totalBudget={totalBudget}
        hasCustomAllocations={Boolean(trip.customCategoryAllocations)}
        isEditBudgetOpen={isEditBudgetOpen} setIsEditBudgetOpen={setIsEditBudgetOpen}
        newTotalBudget={newTotalBudget} setNewTotalBudget={setNewTotalBudget}
        onSaveTotalBudget={handleEditTotalBudget}
        isEditAllocationsOpen={isEditAllocationsOpen} setIsEditAllocationsOpen={setIsEditAllocationsOpen}
        allocTransport={allocTransport} setAllocTransport={setAllocTransport}
        allocHotel={allocHotel} setAllocHotel={setAllocHotel}
        allocMeal={allocMeal} setAllocMeal={setAllocMeal}
        allocSightseeing={allocSightseeing} setAllocSightseeing={setAllocSightseeing}
        allocContingency={allocContingency} setAllocContingency={setAllocContingency}
        allocValidationError={allocValidationError}
        onSaveAllocations={handleSaveCategoryAllocations}
        onResetAllocationsToDefault={handleResetAllocationsToDefault}
        editingActivity={editingActivity} setEditingActivity={setEditingActivity}
        editedCost={editedCost} setEditedCost={setEditedCost}
        onSaveActivityCost={handleSaveActivityCost}
      />
    </div>
  );
};

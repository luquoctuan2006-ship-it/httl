import React, { useState } from 'react';
import type { Activity, TripData } from '../../../types/travel';

interface UseBudgetSettingsOptions {
  trip: TripData;
  onUpdateTripBudget?: (updatedTrip: TripData) => void;
  currentAllocations: NonNullable<TripData['customCategoryAllocations']>;
  totalInvoicesCosts: number;
  totalBudget: number;
  spentBudget: number;
}

export function useBudgetSettings({
  trip,
  onUpdateTripBudget,
  currentAllocations,
  totalInvoicesCosts,
  totalBudget,
  spentBudget,
}: UseBudgetSettingsOptions) {
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isEditAllocationsOpen, setIsEditAllocationsOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editedCost, setEditedCost] = useState<number>(0);
  const [newTotalBudget, setNewTotalBudget] = useState<number>(trip.budgetTotal || 48600000);
  const [allocTransport, setAllocTransport] = useState<number>(currentAllocations.transport || 13600000);
  const [allocHotel, setAllocHotel] = useState<number>(currentAllocations.hotel || 17000000);
  const [allocMeal, setAllocMeal] = useState<number>(currentAllocations.meal || 10700000);
  const [allocSightseeing, setAllocSightseeing] = useState<number>(currentAllocations.sightseeing || 4900000);
  const [allocContingency, setAllocContingency] = useState<number>(currentAllocations.contingency || 2400000);

  const handleEditTotalBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTotalBudget <= 0) return;

    const newRemaining = Math.max(0, newTotalBudget - spentBudget);
    const newPercent = Math.round((spentBudget / newTotalBudget) * 100);
    const updatedTrip: TripData = {
      ...trip,
      budgetTotal: newTotalBudget,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setIsEditBudgetOpen(false);
  };

  const handleSaveCategoryAllocations = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedTrip: TripData = {
      ...trip,
      customCategoryAllocations: {
        transport: allocTransport,
        hotel: allocHotel,
        meal: allocMeal,
        sightseeing: allocSightseeing,
        contingency: allocContingency,
      },
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setIsEditAllocationsOpen(false);
  };

  const handleSaveActivityCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    const updatedDays = trip.days.map((day) => ({
      ...day,
      activities: day.activities.map((act) =>
        act.id === editingActivity.id ? { ...act, cost: Math.max(0, editedCost) } : act
      ),
    }));

    const recalculatedActs = updatedDays.flatMap((day) => day.activities);
    const newActTotal = recalculatedActs.reduce((sum, activity) => sum + (activity.cost || 0), 0);
    const newSpent = newActTotal + totalInvoicesCosts;
    const newRemaining = Math.max(0, totalBudget - newSpent);
    const newPercent = Math.round((newSpent / totalBudget) * 100);
    const updatedTrip: TripData = {
      ...trip,
      days: updatedDays,
      budgetUsed: newSpent,
      budgetRemaining: newRemaining,
      budgetUsedPercent: newPercent,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setEditingActivity(null);
  };

  return {
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
  };
}

import React, { useEffect, useState } from 'react';
import type { Activity, TripData } from '../../../types/travel';
import {
  computeTripBudgetSummaryFields,
  resolveScaledAllocationsForBudget,
} from '../../../utils/budgetAlerts';

interface UseBudgetSettingsOptions {
  trip: TripData;
  onUpdateTripBudget?: (updatedTrip: TripData) => void;
  currentAllocations: NonNullable<TripData['customCategoryAllocations']>;
  totalBudget: number;
}

export function useBudgetSettings({
  trip,
  onUpdateTripBudget,
  currentAllocations,
  totalBudget,
}: UseBudgetSettingsOptions) {
  const [isEditBudgetOpen, setIsEditBudgetOpen] = useState(false);
  const [isEditAllocationsOpen, setIsEditAllocationsOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editedCost, setEditedCost] = useState<number>(0);
  const [newTotalBudget, setNewTotalBudget] = useState<number>(trip.budgetTotal || 0);
  const [allocTransport, setAllocTransport] = useState<number>(currentAllocations.transport ?? 0);
  const [allocHotel, setAllocHotel] = useState<number>(currentAllocations.hotel ?? 0);
  const [allocMeal, setAllocMeal] = useState<number>(currentAllocations.meal ?? 0);
  const [allocSightseeing, setAllocSightseeing] = useState<number>(currentAllocations.sightseeing ?? 0);
  const [allocContingency, setAllocContingency] = useState<number>(currentAllocations.contingency ?? 0);
  const [allocValidationError, setAllocValidationError] = useState<string | null>(null);

  // Đồng bộ form settings khi người dùng chuyển sang chuyến đi khác
  useEffect(() => {
    setNewTotalBudget(trip.budgetTotal || 0);
    setAllocTransport(currentAllocations.transport ?? 0);
    setAllocHotel(currentAllocations.hotel ?? 0);
    setAllocMeal(currentAllocations.meal ?? 0);
    setAllocSightseeing(currentAllocations.sightseeing ?? 0);
    setAllocContingency(currentAllocations.contingency ?? 0);
    setAllocValidationError(null);
    setIsEditBudgetOpen(false);
    setIsEditAllocationsOpen(false);
    setEditingActivity(null);
  }, [trip.id]);

  const openEditBudgetModal = () => {
    setNewTotalBudget(trip.budgetTotal || 0);
    setIsEditBudgetOpen(true);
  };

  const openEditAllocationsModal = () => {
    setAllocTransport(currentAllocations.transport ?? 0);
    setAllocHotel(currentAllocations.hotel ?? 0);
    setAllocMeal(currentAllocations.meal ?? 0);
    setAllocSightseeing(currentAllocations.sightseeing ?? 0);
    setAllocContingency(currentAllocations.contingency ?? 0);
    setAllocValidationError(null);
    setIsEditAllocationsOpen(true);
  };

  const handleResetAllocationsToDefault = () => {
    const base = trip.budgetTotal || 0;
    setAllocTransport(Math.round(base * 0.28));
    setAllocHotel(Math.round(base * 0.35));
    setAllocMeal(Math.round(base * 0.22));
    setAllocSightseeing(Math.round(base * 0.10));
    setAllocContingency(Math.round(base * 0.05));
    setAllocValidationError(null);
  };

  const handleEditTotalBudget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(newTotalBudget) || newTotalBudget <= 0) return;

    const cleanBudget = Math.round(newTotalBudget);
    const scaledCustomAllocations = resolveScaledAllocationsForBudget(trip, cleanBudget);
    const draftTrip: TripData = {
      ...trip,
      budgetTotal: cleanBudget,
      ...(scaledCustomAllocations ? { customCategoryAllocations: scaledCustomAllocations } : {}),
    };
    const updatedTrip: TripData = {
      ...draftTrip,
      ...computeTripBudgetSummaryFields(draftTrip),
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setIsEditBudgetOpen(false);
  };

  const handleSaveCategoryAllocations = (e: React.FormEvent) => {
    e.preventDefault();
    const safeVal = (v: number) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
    const nextAllocations = {
      transport: safeVal(allocTransport),
      hotel: safeVal(allocHotel),
      meal: safeVal(allocMeal),
      sightseeing: safeVal(allocSightseeing),
      contingency: safeVal(allocContingency),
    };
    const sum =
      nextAllocations.transport +
      nextAllocations.hotel +
      nextAllocations.meal +
      nextAllocations.sightseeing +
      nextAllocations.contingency;

    if (totalBudget > 0 && sum > totalBudget) {
      setAllocValidationError(
        `Tổng phân bổ 5 hạng mục (${sum.toLocaleString('vi-VN')} ₫) không được vượt quá tổng ngân sách tour (${totalBudget.toLocaleString('vi-VN')} ₫).`,
      );
      return;
    }

    setAllocValidationError(null);
    const updatedTrip: TripData = {
      ...trip,
      customCategoryAllocations: nextAllocations,
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setIsEditAllocationsOpen(false);
  };

  const handleSaveActivityCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    const cleanCost = Number.isFinite(editedCost) && editedCost >= 0 ? Math.round(editedCost) : 0;
    const updatedDays = trip.days.map((day) => ({
      ...day,
      activities: day.activities.map((act) =>
        act.id === editingActivity.id ? { ...act, cost: cleanCost } : act,
      ),
    }));

    const draftTrip: TripData = {
      ...trip,
      days: updatedDays,
    };
    const updatedTrip: TripData = {
      ...draftTrip,
      ...computeTripBudgetSummaryFields(draftTrip),
    };

    if (onUpdateTripBudget) {
      onUpdateTripBudget(updatedTrip);
    }

    setEditingActivity(null);
  };

  return {
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
  };
}

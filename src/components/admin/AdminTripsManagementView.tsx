import React, { useState } from 'react';
import type { TripData } from '../../types/travel';
import { AdminPlanningDataView } from './AdminPlanningDataView';
import { AdminScheduleMonitoringView } from './AdminScheduleMonitoringView';
import { TripsListView } from '../trips/TripsListView';

type TripsSection = 'list' | 'monitoring' | 'planning';

interface AdminTripsManagementProps {
  trip: TripData | null;
  trips: TripData[];
  onSelectTrip: (trip: TripData) => void;
  onOpenCreateModal: () => void;
  onEditTrip?: (trip: TripData) => void;
  onDeleteTrip?: (tripId: string) => void;
  onCloneTrip?: (trip: TripData) => void;
  currentUserUid: string;
  searchQuery: string;
  onClearSearch: () => void;
  onUpdateTrip: (trip: TripData, message?: string) => Promise<void>;
  onEnsureFullTrip?: (tripId: string) => Promise<TripData | null>;
}

const sections: Array<{ id: TripsSection; label: string }> = [
  { id: 'list', label: 'Danh sách chuyến' },
  { id: 'monitoring', label: 'Giám sát lịch trình' },
  { id: 'planning', label: 'Dữ liệu hoạch định' },
];

export const AdminTripsManagementView: React.FC<AdminTripsManagementProps> = (props) => {
  const [activeSection, setActiveSection] = useState<TripsSection>('list');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
              activeSection === section.id
                ? 'bg-teal-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'list' && (
        <TripsListView
          trips={props.trips}
          currentTrip={props.trip}
          onSelectTrip={props.onSelectTrip}
          onOpenCreateModal={props.onOpenCreateModal}
          onEditTrip={props.onEditTrip}
          onDeleteTrip={props.onDeleteTrip}
          onCloneTrip={props.onCloneTrip}
          isAdmin
          currentUserUid={props.currentUserUid}
          searchQuery={props.searchQuery}
          onClearSearch={props.onClearSearch}
        />
      )}

      {activeSection === 'monitoring' &&
        (props.trip ? (
          <AdminScheduleMonitoringView
            trip={props.trip}
            trips={props.trips}
            onEnsureFullTrip={props.onEnsureFullTrip}
          />
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            Chọn một chuyến đi để xem giám sát lịch trình.
          </p>
        ))}

      {activeSection === 'planning' &&
        (props.trip ? (
          <AdminPlanningDataView trip={props.trip} onUpdateTrip={props.onUpdateTrip} />
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">
            Chọn một chuyến đi để quản lý dữ liệu hoạch định.
          </p>
        ))}
    </div>
  );
};

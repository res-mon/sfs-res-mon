import CalendarPlusIcon from "~icons/tabler/calendar-plus";
import ClockIcon from "~icons/tabler/clock";
import ClockPlayIcon from "~icons/tabler/player-play";
import DeleteIcon from "~icons/tabler/trash";

import { Component, For, Show, createSignal } from "solid-js";

import { Effect } from "effect";

import { stringifyError } from "../services/pocketBase/pocketBase";
import { deleteTimeEntry } from "../services/workClock";
import {
  DailyRecord,
  TimeEntryPair,
  formatClockOutDate,
  formatDateForDisplay,
  formatDurationForDisplay,
  formatTimeForDisplay,
} from "./TimeEntryUtils";

interface DailyRecordRowProps {
  record: DailyRecord;
  isOpen: boolean;
  toggleOpen: (date: string) => void;
}

/**
 * DailyRecordRow component
 *
 * Displays a single day's record in the time entry table with expandable details
 */
const DailyRecordRow: Component<DailyRecordRowProps> = (props) => {
  return (
    <>
      <tr
        class="hover:bg-base-300 cursor-pointer"
        onClick={() => props.toggleOpen(props.record.date)}
      >
        <td class="font-medium">{formatDateForDisplay(props.record.date)}</td>
        <td>{props.record.formattedTotal}</td>
        <td class="text-right">
          {props.record.entryPairs.length}{" "}
          {props.record.entryPairs.length === 1 ? "Eintrag" : "Einträge"}
          {/* Show indicator if any entries cross midnight */}
          {props.record.entryPairs.some((pair) => pair.dayBoundary) ?
            <span
              class="tooltip tooltip-left ml-2"
              data-tip="Enthält Einträge über Mitternacht hinaus"
            >
              <CalendarPlusIcon class="text-accent inline-block" />
            </span>
          : null}
          {/* Show indicator for days with missing entries */}
          {props.record.hasMissingEntries ?
            <span
              class="tooltip tooltip-left ml-2"
              data-tip="Enthält fehlende Ein-/Ausstempel-Einträge"
            >
              <ClockIcon class="text-warning inline-block" />
            </span>
          : null}
          {/* Show indicator for active sessions */}
          {props.record.isActive ?
            <span
              class="tooltip tooltip-left ml-2"
              data-tip="Aktuell aktive Sitzung"
            >
              <ClockPlayIcon class="text-success inline-block" />
            </span>
          : null}
        </td>
      </tr>
      <Show when={props.isOpen}>
        <tr>
          <td
            colSpan={3}
            class="p-0"
          >
            <div class="overflow-hidden">
              <table class="table-compact table w-full">
                <thead>
                  <tr>
                    <th>
                      <ClockIcon class="mr-1 inline-block" /> Eingestempelt
                    </th>
                    <th>
                      <ClockIcon class="mr-1 inline-block" /> Ausgestempelt
                    </th>
                    <th>
                      <ClockIcon class="mr-1 inline-block" /> Dauer
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={props.record.entryPairs}>
                    {(pair) => <EntryPairRow pair={pair} />}
                  </For>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      </Show>
    </>
  );
};

interface EntryPairRowProps {
  pair: TimeEntryPair;
}

/**
 * EntryPairRow component
 *
 * Displays a single clock in/out pair within a day record
 */
const EntryPairRow: Component<EntryPairRowProps> = (props) => {
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [deleteError, setDeleteError] = createSignal("");
  const [showConfirmModal, setShowConfirmModal] = createSignal(false);

  // Show delete confirmation dialog
  const openDeleteConfirmation = (e: MouseEvent) => {
    e.stopPropagation(); // Stop event propagation to prevent row toggle

    if (props.pair.clockInId == null) {
      setDeleteError("Kann nicht gelöscht werden: Kein gültiger Eintrag.");
      return;
    }

    setShowConfirmModal(true);
  };

  // Perform the actual deletion
  const confirmDelete = () => {
    if (props.pair.clockInId == null) return;

    setIsDeleting(true);
    setDeleteError("");
    setShowConfirmModal(false);

    Effect.runPromise(deleteTimeEntry(props.pair.clockInId)).then(
      (success) => {
        setIsDeleting(false);
        if (!success) {
          setDeleteError("Fehler beim Löschen des Eintrags.");
        }
      },
      (error) => {
        setIsDeleting(false);
        setDeleteError(
          stringifyError(error) ?? "Fehler beim Löschen des Eintrags.",
        );
      },
    );
  };

  return (
    <>
      <tr class={props.pair.dayBoundary ? "bg-accent bg-opacity-10" : ""}>
        <td>
          {props.pair.clockIn != null ?
            formatTimeForDisplay(props.pair.clockIn)
          : "Fehlend"}
        </td>
        <td>
          {props.pair.clockOut != null ?
            formatClockOutDate(
              props.pair.clockOut,
              props.pair.clockIn ?? props.pair.clockOut,
            )
          : props.pair.missingEntry ?
            "Fehlend"
          : "Noch eingestempelt"}
          {props.pair.dayBoundary && (
            <span
              class="tooltip tooltip-right ml-2"
              data-tip="Dieser Eintrag überschreitet Mitternacht"
            >
              <CalendarPlusIcon class="text-accent inline-block" />
            </span>
          )}
        </td>
        <td class="flex items-center justify-between">
          <span>
            {props.pair.missingEntry ?
              "Unbekannt"
            : formatDurationForDisplay(props.pair.duration)}
          </span>
          <Show when={props.pair.clockInId}>
            <button
              class="btn btn-error btn-xs ml-2"
              onClick={openDeleteConfirmation}
              disabled={isDeleting()}
              title="Eintrag löschen"
            >
              <DeleteIcon class={isDeleting() ? "animate-pulse" : ""} />
            </button>
          </Show>
          <Show when={deleteError()}>
            <div class="text-error text-xs">{deleteError()}</div>
          </Show>
        </td>
      </tr>

      {/* Delete Confirmation Modal */}
      <Show when={showConfirmModal()}>
        <div class="modal modal-open">
          <div class="modal-box">
            <h3 class="text-lg font-bold">Zeiteintrag löschen</h3>
            <p class="py-4">Möchten Sie diesen Zeiteintrag wirklich löschen?</p>
            <div class="modal-action">
              <button
                class="btn btn-outline"
                onClick={() => setShowConfirmModal(false)}
              >
                Abbrechen
              </button>
              <button
                class="btn btn-error"
                onClick={confirmDelete}
                disabled={isDeleting()}
              >
                {isDeleting() ?
                  <span class="loading loading-spinner loading-xs mr-2" />
                : <DeleteIcon class="mr-2" />}
                Löschen
              </button>
            </div>
          </div>
          <div
            class="modal-backdrop"
            onClick={() => setShowConfirmModal(false)}
          />
        </div>
      </Show>
    </>
  );
};

export default DailyRecordRow;

import TimelineIcon from "~icons/tabler/timeline";
import ZoomInIcon from "~icons/tabler/zoom-in";
import ZoomOutIcon from "~icons/tabler/zoom-out";

import { Component, For, Show, createMemo, createSignal } from "solid-js";

import { DailyRecord } from "./TimeEntryUtils";

interface TimelineViewProps {
  dailyRecords: DailyRecord[];
}

/**
 * TimelineView Component
 *
 * Displays work sessions across multiple days in a horizontal timeline.
 * Makes it easy to visualize work patterns and gaps across days.
 */
const TimelineView: Component<TimelineViewProps> = (props) => {
  const [daysToShow, setDaysToShow] = createSignal(7);
  const [startOffset, setStartOffset] = createSignal(0);

  // Increase days shown
  const zoomOut = () => {
    setDaysToShow((prev) => Math.min(31, prev + 3));
  };

  // Decrease days shown
  const zoomIn = () => {
    setDaysToShow((prev) => Math.max(3, prev - 2));
  };

  // Load more data in the past
  const showMorePast = () => {
    setStartOffset((prev) => prev + daysToShow());
  };

  // Load more recent data
  const showMoreRecent = () => {
    setStartOffset((prev) => Math.max(0, prev - daysToShow()));
  };

  // Get dates to display
  const datesToShow = createMemo(() => {
    const today = new Date();
    const result: string[] = [];

    // Start 'startOffset' days ago
    for (let i = startOffset() + daysToShow() - 1; i >= startOffset(); i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      result.push(date.toISOString().split("T")[0]);
    }

    return result;
  });

  // Create a lookup map for more efficient access to daily records
  const recordsMap = createMemo(() => {
    const map = new Map<string, DailyRecord>();
    props.dailyRecords.forEach((record) => {
      map.set(record.date, record);
    });
    return map;
  });

  // Format day name
  const formatDayName = (dateStr: string) => {
    // For shorter timelines, show full date
    if (daysToShow() <= 7) {
      return new Date(dateStr).toLocaleDateString("de-DE", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
      });
    }
    // For longer timelines, just show day number and day of week
    return new Date(dateStr).toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
    });
  };

  // Check if date is today
  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dateStr === today;
  };

  // Format time for display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate the height of a timeline segment in the UI
  const getSegmentHeight = (duration: number) => {
    // Duration is in milliseconds
    const hours = duration / (1000 * 60 * 60);

    // Cap at 10 hours for display purposes
    const cappedHours = Math.min(10, hours);

    // Scale to pixels, minimum 30px
    return Math.max(30, cappedHours * 20);
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title flex justify-between">
          <span>
            <TimelineIcon class="mr-2" /> Zeitverlauf
          </span>

          <div class="flex items-center gap-2">
            <button
              class="btn btn-circle btn-sm"
              onClick={showMorePast}
              aria-label="Ältere Einträge anzeigen"
            >
              ◀
            </button>

            <div class="badge badge-primary">
              {datesToShow()[0].substring(5)} -{" "}
              {datesToShow()[datesToShow().length - 1].substring(5)}
            </div>

            <button
              class="btn btn-circle btn-sm"
              onClick={showMoreRecent}
              disabled={startOffset() === 0}
              aria-label="Neuere Einträge anzeigen"
            >
              ▶
            </button>

            <div class="divider divider-horizontal mx-0" />

            <button
              class="btn btn-circle btn-sm"
              onClick={zoomIn}
              aria-label="Vergrößern"
              title="Vergrößern"
              disabled={daysToShow() <= 3}
            >
              <ZoomInIcon class="h-4 w-4" />
            </button>

            <span class="text-xs">{daysToShow()} Tage</span>

            <button
              class="btn btn-circle btn-sm"
              onClick={zoomOut}
              aria-label="Verkleinern"
              title="Verkleinern"
              disabled={daysToShow() >= 31}
            >
              <ZoomOutIcon class="h-4 w-4" />
            </button>
          </div>
        </h2>

        <div class="mt-4 overflow-x-auto">
          <div class="flex min-w-full">
            <For each={datesToShow()}>
              {(date) => (
                <div
                  class={`border-base-300 min-w-[130px] flex-1 border-r ${isToday(date) ? "bg-base-300 bg-opacity-30" : ""}`}
                >
                  <div
                    class={`sticky top-0 py-2 text-center font-medium ${isToday(date) ? "text-primary" : ""}`}
                  >
                    {formatDayName(date)}
                  </div>

                  <div class="relative px-2 pb-4">
                    {/* Time scale (6AM to 10PM) */}
                    <div class="pointer-events-none absolute top-0 bottom-0 left-0 w-full">
                      <For each={[6, 9, 12, 15, 18, 21]}>
                        {(hour) => (
                          <div
                            class="border-base-300 absolute w-full border-t border-dashed text-xs opacity-50"
                            style={{ top: `${(hour - 6) * 30}px` }}
                          >
                            {hour}:00
                          </div>
                        )}
                      </For>
                    </div>

                    {/* Work time blocks */}
                    <Show when={recordsMap().has(date)}>
                      <For each={recordsMap().get(date)!.entryPairs}>
                        {(pair) => {
                          if (pair.clockIn == null || pair.missingEntry)
                            return null;

                          const startDate = new Date(pair.clockIn);
                          const startHour =
                            startDate.getHours() + startDate.getMinutes() / 60;

                          // Calculate top position (6AM = 0px)
                          const topPos = Math.max(0, (startHour - 6) * 30);

                          // For completed entries
                          if (pair.clockOut != null) {
                            const duration = pair.duration;
                            const height = getSegmentHeight(duration);

                            return (
                              <div
                                class="bg-primary bg-opacity-20 border-primary hover:bg-opacity-30 tooltip absolute right-2 left-2 cursor-pointer rounded-md border-l-4 transition-colors"
                                style={{
                                  top: `${topPos}px; height: ${height}px;`,
                                }}
                                data-tip={`${formatTime(pair.clockIn)} - ${formatTime(pair.clockOut)}`}
                              >
                                <div class="p-1 text-xs">
                                  {formatTime(pair.clockIn)}
                                  {height > 40 && (
                                    <>
                                      <div class="mt-1 text-center font-bold">
                                        {Math.floor(
                                          duration / (1000 * 60 * 60),
                                        )}
                                        h{" "}
                                        {Math.floor(
                                          (duration % (1000 * 60 * 60)) /
                                            (1000 * 60),
                                        )}
                                        m
                                      </div>
                                      <div class="text-right">
                                        {formatTime(pair.clockOut)}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          const duration = new Date().getTime() - pair.clockIn;
                          const height = getSegmentHeight(duration);

                          return (
                            <div
                              class="bg-success bg-opacity-20 border-success tooltip absolute right-2 left-2 rounded-md border-l-4 border-dashed"
                              style={{
                                top: `${topPos}px; height: ${height}px;`,
                              }}
                              data-tip={`Aktiv seit ${formatTime(pair.clockIn)}`}
                            >
                              <div class="p-1 text-xs">
                                {formatTime(pair.clockIn)}
                                {height > 40 && (
                                  <div class="mt-1 text-center font-bold">
                                    Aktiv
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }}
                      </For>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* Legend */}
        <div class="mt-4 flex justify-center gap-6 text-sm">
          <div class="flex items-center">
            <div class="bg-primary bg-opacity-20 border-primary mr-2 h-4 w-4 border-l-4" />
            <span>Abgeschlossene Arbeit</span>
          </div>
          <div class="flex items-center">
            <div class="bg-success bg-opacity-20 border-success mr-2 h-4 w-4 border-l-4 border-dashed" />
            <span>Aktive Session</span>
          </div>
          <div class="flex items-center">
            <div class="bg-base-300 bg-opacity-30 mr-2 h-4 w-4" />
            <span>Heute</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;

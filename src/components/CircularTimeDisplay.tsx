import ClockIcon from "~icons/tabler/clock";
import TimeIcon from "~icons/tabler/clock-hour-8";

import { Component, For, createEffect, createSignal } from "solid-js";

import { DailyRecord } from "./TimeEntryUtils";

interface CircularTimeDisplayProps {
  dailyRecords: DailyRecord[];
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
}

/**
 * CircularTimeDisplay Component
 *
 * Visualizes work time as segments on a 24-hour clock face.
 * Makes it easy to see when during the day you were working.
 */
const CircularTimeDisplay: Component<CircularTimeDisplayProps> = (props) => {
  const [selectedDate, setSelectedDate] = createSignal<string | undefined>();

  // When props.selectedDate changes, update our internal state
  createEffect(() => {
    if (props.selectedDate !== selectedDate()) {
      setSelectedDate(props.selectedDate);
    }
  });

  // If no date is selected, use the most recent date with entries
  createEffect(() => {
    if (selectedDate() == null && props.dailyRecords.length > 0) {
      setSelectedDate(props.dailyRecords[0].date);
    }
  });

  // Select the next available date with records
  const selectNextDate = () => {
    const currentIndex = props.dailyRecords.findIndex(
      (record) => record.date === selectedDate(),
    );
    if (currentIndex > 0) {
      const nextDate = props.dailyRecords[currentIndex - 1].date;
      setSelectedDate(nextDate);
      if (props.onDateSelect) props.onDateSelect(nextDate);
    }
  };

  // Select the previous available date with records
  const selectPrevDate = () => {
    const currentIndex = props.dailyRecords.findIndex(
      (record) => record.date === selectedDate(),
    );
    if (currentIndex >= 0 && currentIndex < props.dailyRecords.length - 1) {
      const prevDate = props.dailyRecords[currentIndex + 1].date;
      setSelectedDate(prevDate);
      if (props.onDateSelect) props.onDateSelect(prevDate);
    }
  };

  // Get the selected daily record
  const selectedRecord = () => {
    return props.dailyRecords.find((record) => record.date === selectedDate());
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Convert timestamp to angle for the circular display (0-360 degrees)
  // 0 degrees is at the top (midnight), moving clockwise
  const getTimeAngle = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Convert time to degrees (24 hours = 360 degrees)
    return (hours * 60 + minutes) * (360 / (24 * 60));
  };

  // Create SVG path for a time segment
  const createArcPath = (
    startAngle: number,
    endAngle: number,
    radius: number,
  ) => {
    // Ensure angles are positive and less than 360
    startAngle = startAngle % 360;
    endAngle = endAngle % 360;

    // Ensure end angle is greater than start angle
    if (endAngle <= startAngle) {
      endAngle += 360;
    }

    // Calculate the SVG arc
    const startRad = ((startAngle - 90) * Math.PI) / 180; // -90 to start at top
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    const x1 = 50 + radius * Math.cos(startRad);
    const y1 = 50 + radius * Math.sin(startRad);
    const x2 = 50 + radius * Math.cos(endRad);
    const y2 = 50 + radius * Math.sin(endRad);

    // Determine if arc should be drawn the long way around
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title flex justify-between">
          <span>
            <ClockIcon class="mr-2" /> Tagesverlauf
          </span>

          <div class="flex items-center">
            <button
              class="btn btn-circle btn-sm mr-2"
              onClick={selectPrevDate}
              disabled={
                props.dailyRecords.findIndex(
                  (r) => r.date === selectedDate(),
                ) >=
                props.dailyRecords.length - 1
              }
            >
              ◀
            </button>
            <div class="text-sm">
              {selectedDate() != null ?
                formatDate(selectedDate()!)
              : "Kein Datum ausgewählt"}
            </div>
            <button
              class="btn btn-circle btn-sm ml-2"
              onClick={selectNextDate}
              disabled={
                props.dailyRecords.findIndex(
                  (r) => r.date === selectedDate(),
                ) <= 0
              }
            >
              ▶
            </button>
          </div>
        </h2>

        <div class="flex justify-center py-4">
          <div class="relative">
            {/* Clock face */}
            <svg
              width="300"
              height="300"
              viewBox="0 0 100 100"
            >
              {/* Clock circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.2"
              />

              {/* Hour markers */}
              <For each={[...(Array(24) as undefined[])].map((_, i) => i)}>
                {(hour) => {
                  const angle = hour * 15 - 90; // -90 to start at the top
                  const radians = (angle * Math.PI) / 180;
                  const innerRadius = 44;
                  const outerRadius =
                    hour % 6 === 0 ? 38
                    : hour % 3 === 0 ? 40
                    : 42;

                  const x1 = 50 + innerRadius * Math.cos(radians);
                  const y1 = 50 + innerRadius * Math.sin(radians);
                  const x2 = 50 + outerRadius * Math.cos(radians);
                  const y2 = 50 + outerRadius * Math.sin(radians);

                  return (
                    <>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="currentColor"
                        stroke-opacity={hour % 6 === 0 ? "0.5" : "0.2"}
                      />
                      {hour % 6 === 0 && (
                        <text
                          x={50 + 34 * Math.cos(radians)}
                          y={50 + 34 * Math.sin(radians)}
                          font-size="3"
                          text-anchor="middle"
                          dominant-baseline="middle"
                          fill="currentColor"
                          fill-opacity="0.7"
                        >
                          {hour || 24}
                        </text>
                      )}
                    </>
                  );
                }}
              </For>

              {/* AM/PM indicators */}
              <text
                x="50"
                y="22"
                font-size="3"
                text-anchor="middle"
                fill="currentColor"
                fill-opacity="0.6"
              >
                0:00
              </text>
              <text
                x="50"
                y="78"
                font-size="3"
                text-anchor="middle"
                fill="currentColor"
                fill-opacity="0.6"
              >
                12:00
              </text>

              {/* Work time segments */}
              {selectedRecord() && (
                <For each={selectedRecord()!.entryPairs}>
                  {(pair) => {
                    if (pair.clockIn != null && pair.clockOut != null) {
                      // Only show pairs with both in and out times
                      const startAngle = getTimeAngle(pair.clockIn);
                      const endAngle = getTimeAngle(pair.clockOut);

                      return (
                        <g>
                          {/* Arc showing work period */}
                          <path
                            d={createArcPath(startAngle, endAngle, 30)}
                            stroke="var(--p)"
                            stroke-width="8"
                            fill="none"
                            stroke-linecap="round"
                            stroke-opacity="0.8"
                            class="tooltip"
                            data-tip={`${new Date(pair.clockIn).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} - ${new Date(pair.clockOut).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                          />

                          {/* Start marker */}
                          <circle
                            cx={
                              50 +
                              30 * Math.cos(((startAngle - 90) * Math.PI) / 180)
                            }
                            cy={
                              50 +
                              30 * Math.sin(((startAngle - 90) * Math.PI) / 180)
                            }
                            r="2"
                            fill="var(--p)"
                          />

                          {/* End marker */}
                          <circle
                            cx={
                              50 +
                              30 * Math.cos(((endAngle - 90) * Math.PI) / 180)
                            }
                            cy={
                              50 +
                              30 * Math.sin(((endAngle - 90) * Math.PI) / 180)
                            }
                            r="2"
                            fill="var(--p)"
                          />
                        </g>
                      );
                    }

                    // For active sessions
                    if (
                      pair.clockIn != null &&
                      pair.clockOut == null &&
                      !pair.missingEntry
                    ) {
                      const startAngle = getTimeAngle(pair.clockIn);
                      const endAngle = getTimeAngle(new Date().getTime());

                      return (
                        <g>
                          {/* Arc showing active work period */}
                          <path
                            d={createArcPath(startAngle, endAngle, 30)}
                            stroke="var(--su)"
                            stroke-width="8"
                            fill="none"
                            stroke-linecap="round"
                            stroke-opacity="0.8"
                            stroke-dasharray="2"
                            class="tooltip"
                            data-tip={`Aktiv seit ${new Date(pair.clockIn).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                          />

                          {/* Start marker */}
                          <circle
                            cx={
                              50 +
                              30 * Math.cos(((startAngle - 90) * Math.PI) / 180)
                            }
                            cy={
                              50 +
                              30 * Math.sin(((startAngle - 90) * Math.PI) / 180)
                            }
                            r="2"
                            fill="var(--su)"
                          />

                          {/* Current time marker (pulsing) */}
                          <circle
                            cx={
                              50 +
                              30 * Math.cos(((endAngle - 90) * Math.PI) / 180)
                            }
                            cy={
                              50 +
                              30 * Math.sin(((endAngle - 90) * Math.PI) / 180)
                            }
                            r="2"
                            fill="var(--su)"
                            class="animate-ping"
                          />
                        </g>
                      );
                    }

                    return null;
                  }}
                </For>
              )}

              {/* Current time indicator */}
              {(() => {
                const now = new Date();
                const currentAngle = getTimeAngle(now.getTime());
                const x =
                  50 + 45 * Math.cos(((currentAngle - 90) * Math.PI) / 180);
                const y =
                  50 + 45 * Math.sin(((currentAngle - 90) * Math.PI) / 180);

                return (
                  <g>
                    <line
                      x1="50"
                      y1="50"
                      x2={x}
                      y2={y}
                      stroke="var(--er)"
                      stroke-width="0.5"
                      stroke-opacity="0.6"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="1.5"
                      fill="var(--er)"
                      class="tooltip"
                      data-tip={`Jetzt: ${now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`}
                    />
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Daily summary */}
        {selectedRecord() && (
          <div class="stats bg-base-300 mt-2 shadow">
            <div class="stat">
              <div class="stat-figure text-primary">
                <TimeIcon class="h-6 w-6" />
              </div>
              <div class="stat-title">Gesamtzeit</div>
              <div class="stat-value text-primary">
                {selectedRecord()!.formattedTotal.substring(0, 5)}
              </div>
              <div class="stat-desc">
                am{" "}
                {new Date(selectedRecord()!.date).toLocaleDateString("de-DE")}
              </div>
            </div>

            <div class="stat">
              <div class="stat-figure text-secondary">
                <ClockIcon class="h-6 w-6" />
              </div>
              <div class="stat-title">Stempelungen</div>
              <div class="stat-value text-secondary">
                {selectedRecord()!.entryPairs.length * 2}
              </div>
              <div class="stat-desc">Ein- und Ausstempelungen</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CircularTimeDisplay;

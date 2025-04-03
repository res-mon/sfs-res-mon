import CalendarIcon from "~icons/tabler/calendar";
import ClockIcon from "~icons/tabler/clock";
import InfoCircleIcon from "~icons/tabler/info-circle";

import { Component, For, createMemo } from "solid-js";

import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

import { DailyRecord } from "./TimeEntryUtils";

interface WeekPatternProps {
  dailyRecords: DailyRecord[];
  weeksToShow?: number;
}

/**
 * WeekPattern Component
 *
 * Displays work patterns in a week view with hours vs days heatmap.
 * Shows when during the week you typically work.
 */
const WeekPattern: Component<WeekPatternProps> = (props) => {
  const weeksToShow = () => props.weeksToShow ?? 4;

  // Create time slots for the day (each hour from 0-23)
  const hourSlots = Array.from({ length: 24 }, (_, i) => i);

  // Create day slots for the week (0 = Monday, 6 = Sunday)
  const dayNames = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
  ];
  const daySlots = [0, 1, 2, 3, 4, 5, 6];

  // Process records to get hour data
  const weekHeatmapData = createMemo(() => {
    // Initialize the data structure: [day][hour] = value
    const data = (new Array(7) as number[][]).fill(
      (new Array(24) as number[]).fill(0),
    );

    // Get recent records based on weeksToShow
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeksToShow() * 7);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const recentRecords = props.dailyRecords.filter(
      (record) => record.date >= cutoffDateStr,
    );

    // Process each record
    recentRecords.forEach((record) => {
      // Get day of week (0 = Monday in our display)
      const date = parseISO(record.date);
      // Convert from JS day (0 = Sunday) to our format (0 = Monday)
      const dayOfWeek = (date.getDay() + 6) % 7;

      const addHoursBetween = (
        day: number,
        startHour: number,
        endHour: number,
      ) => {
        // Add value for each hour in the range
        for (let h = startHour; h <= endHour; h++) {
          data[day][h] += 1;
        }
      };

      // Process entries
      record.entryPairs.forEach((pair) => {
        if (pair.clockIn != null && pair.clockOut != null) {
          // Get start and end times
          const startDate = new Date(pair.clockIn);
          const endDate = new Date(pair.clockOut);

          // If the entry spans multiple days, we need to handle it specially
          if (pair.dayBoundary) {
            // For the first day, count hours from start until midnight
            const startDay = (startDate.getDay() + 6) % 7;
            const startHour = startDate.getHours();

            // Add value for each hour from start until midnight
            for (let h = startHour; h < 24; h++) {
              data[startDay][h] += 1;
            }

            // For the second day, count hours from midnight until end
            const endDay = (endDate.getDay() + 6) % 7;
            const endHour = endDate.getHours();

            // Add value for each hour from midnight until end
            for (let h = 0; h <= endHour; h++) {
              data[endDay][h] += 1;
            }
          } else {
            // Same day entry
            const day = dayOfWeek;
            const startHour = startDate.getHours();
            const endHour = endDate.getHours();

            // Add value for each hour in the range
            addHoursBetween(day, startHour, endHour);
          }
        }
      });
    });

    return data;
  });

  // Get the color intensity class based on the value
  const getIntensityClass = (value: number) => {
    // Find the maximum value in the data
    const maxValue = Math.max(...weekHeatmapData().flat());

    // No max value means no data
    if (maxValue === 0) return "bg-base-300";

    // Calculate intensity (0-100%)
    const intensity = value / maxValue;

    if (intensity === 0) return "bg-base-300";
    if (intensity < 0.25) return "bg-primary bg-opacity-20";
    if (intensity < 0.5) return "bg-primary bg-opacity-40";
    if (intensity < 0.75) return "bg-primary bg-opacity-60";
    return "bg-primary bg-opacity-80";
  };

  // Calculate the week range string
  const weekRangeString = createMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeksToShow() * 7);

    return `${format(cutoffDate, "dd. MMM", { locale: de })} - ${format(now, "dd. MMM yyyy", { locale: de })}`;
  });

  // Format time for display
  const formatHour = (hour: number) => {
    return `${hour}:00`;
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <CalendarIcon class="mr-2" /> Wochenmuster
        </h2>

        <div class="mt-2 flex items-center text-sm">
          <span class="mr-2">Aktivität:</span>
          <div class="flex items-center gap-1">
            <div class="bg-base-300 h-3 w-3 rounded-sm" />
            <div class="bg-primary bg-opacity-20 h-3 w-3 rounded-sm" />
            <div class="bg-primary bg-opacity-40 h-3 w-3 rounded-sm" />
            <div class="bg-primary bg-opacity-60 h-3 w-3 rounded-sm" />
            <div class="bg-primary bg-opacity-80 h-3 w-3 rounded-sm" />
          </div>
          <span class="ml-1">mehr</span>
          <span
            class="tooltip tooltip-top ml-2"
            data-tip="Zeigt an, zu welchen Tageszeiten und Wochentagen du normalerweise arbeitest"
          >
            <InfoCircleIcon class="h-4 w-4" />
          </span>
        </div>

        <div class="mt-4 overflow-x-auto">
          <div class="flex">
            {/* Empty top-left corner */}
            <div class="flex h-12 w-16 items-center justify-center font-semibold">
              <ClockIcon class="h-4 w-4" />
            </div>

            {/* Day headers */}
            <For each={daySlots}>
              {(dayIndex) => (
                <div class="flex h-12 flex-1 items-center justify-center font-semibold">
                  {dayNames[dayIndex]}
                </div>
              )}
            </For>
          </div>

          {/* Hour rows with day cells */}
          <For each={hourSlots}>
            {(hour) => (
              <div class="flex">
                {/* Hour label */}
                <div class="flex h-10 w-16 items-center justify-center text-sm">
                  {formatHour(hour)}
                </div>

                {/* Day cells */}
                <For each={daySlots}>
                  {(day) => {
                    const value = weekHeatmapData()[day][hour];
                    const colorClass = getIntensityClass(value);

                    return (
                      <div
                        class={`h-10 flex-1 ${colorClass} tooltip m-0.5 rounded-sm`}
                        data-tip={`${dayNames[day]} ${formatHour(hour)}: ${value} Einträge`}
                      />
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>

        <div class="text-base-content mt-2 text-right text-xs opacity-70">
          Daten der letzten {weeksToShow()} Wochen ({weekRangeString()})
        </div>
      </div>
    </div>
  );
};

export default WeekPattern;

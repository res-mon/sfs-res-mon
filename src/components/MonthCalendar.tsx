import CalendarIcon from "~icons/tabler/calendar";
import ChartBarIcon from "~icons/tabler/chart-bar";
import ChevronLeftIcon from "~icons/tabler/chevron-left";
import ChevronRightIcon from "~icons/tabler/chevron-right";
import ClockIcon from "~icons/tabler/clock";

import { Component, For, Show, createMemo, createSignal } from "solid-js";

import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { de } from "date-fns/locale";

import { DailyRecord } from "./TimeEntryUtils";

interface MonthCalendarProps {
  dailyRecords: DailyRecord[];
  onDateSelect?: (date: string) => void;
}

/**
 * MonthCalendar Component
 *
 * Calendar visualization showing monthly work patterns with
 * heat indicators for daily work intensity.
 */
const MonthCalendar: Component<MonthCalendarProps> = (props) => {
  const [currentMonth, setCurrentMonth] = createSignal(new Date());
  const [selectedDate, setSelectedDate] = createSignal<Date | null>(null);

  // Previous month handler
  const prevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  // Next month handler
  const nextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  // Format monthly header
  const formatMonthHeader = () => {
    return format(currentMonth(), "MMMM yyyy", { locale: de });
  };

  // Create week day headers
  const weekDays = createMemo(() => {
    const dateFormat = "EEE";
    const days = [];
    const startDate = startOfWeek(currentMonth(), { weekStartsOn: 1 });

    for (let i = 0; i < 7; i++) {
      days.push(format(addDays(startDate, i), dateFormat, { locale: de }));
    }

    return days;
  });

  // Helper to add days to date
  function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Calculate all days to display in calendar grid
  const calendarDays = createMemo(() => {
    const monthStart = startOfMonth(currentMonth());
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const dateFormat = "d";
    const rows = [];

    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        days.push({
          date: day,
          dayOfMonth: formattedDate,
          isCurrentMonth: isSameMonth(day, monthStart),
          isToday: isToday(day),
          isSelected: selectedDate() ? isSameDay(day, selectedDate()!) : false,
        });
        day = addDays(day, 1);
      }
      rows.push(days);
      days = [];
    }

    return rows;
  });

  // Find the daily record for a specific date
  const findDailyRecord = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return props.dailyRecords.find((record) => record.date === dateStr);
  };

  // Handle day cell click
  const onDateClick = (day: Date) => {
    // Skip if not in current month
    if (!isSameMonth(day, currentMonth())) return;

    setSelectedDate(day);

    if (props.onDateSelect) {
      const dateStr = format(day, "yyyy-MM-dd");
      props.onDateSelect(dateStr);
    }
  };

  // Get color class based on work time
  const getColorClass = (date: Date) => {
    // Don't highlight days outside current month
    if (!isSameMonth(date, currentMonth())) return "bg-base-300 opacity-30";

    const record = findDailyRecord(date);
    if (!record || record.totalTime === 0) return "bg-base-300";

    // Get hours worked
    const hours = record.totalTime / (1000 * 60 * 60);

    // Define color intensity based on hours
    if (hours >= 8) return "bg-primary";
    if (hours >= 6) return "bg-primary bg-opacity-80";
    if (hours >= 4) return "bg-primary bg-opacity-60";
    if (hours >= 2) return "bg-primary bg-opacity-40";
    return "bg-primary bg-opacity-20";
  };

  // Format time for display
  const formatTime = (milliseconds: number) => {
    if (!milliseconds) return "0h";
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Get monthly stats
  const monthStats = createMemo(() => {
    const monthStart = startOfMonth(currentMonth());
    const monthEnd = endOfMonth(monthStart);

    // Filter records in current month
    const monthRecords = props.dailyRecords.filter((record) => {
      const recordDate = parseISO(record.date);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });

    // Calculate total time
    const totalTime = monthRecords.reduce(
      (sum, record) => sum + record.totalTime,
      0,
    );

    // Calculate work days
    const workDays = monthRecords.filter(
      (record) => record.totalTime > 0,
    ).length;

    // Calculate average per work day
    const avgPerDay = workDays > 0 ? totalTime / workDays : 0;

    // Find most productive day
    let mostProductiveDay: null | string = null;
    let maxTime = 0;

    monthRecords.forEach((record) => {
      if (record.totalTime > maxTime) {
        maxTime = record.totalTime;
        mostProductiveDay = record.date;
      }
    });

    return {
      totalTime,
      workDays,
      avgPerDay,
      mostProductiveDay: mostProductiveDay as string | null,
      maxTime,
    };
  });

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <CalendarIcon class="mr-2" /> Monatsübersicht
        </h2>

        <div class="mb-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            class="btn btn-sm btn-circle"
          >
            <ChevronLeftIcon />
          </button>
          <h3 class="text-center text-xl font-bold capitalize">
            {formatMonthHeader()}
          </h3>
          <button
            onClick={nextMonth}
            class="btn btn-sm btn-circle"
          >
            <ChevronRightIcon />
          </button>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-full">
            {/* Days of week header */}
            <div class="mb-2 grid grid-cols-7">
              <For each={weekDays()}>
                {(day) => (
                  <div class="text-center text-sm font-bold">{day}</div>
                )}
              </For>
            </div>

            {/* Calendar grid */}
            <div class="flex flex-col gap-1">
              <For each={calendarDays()}>
                {(week) => (
                  <div class="grid grid-cols-7 gap-1">
                    <For each={week}>
                      {(day) => {
                        const record = findDailyRecord(day.date);
                        const hours =
                          record?.totalTime != null ?
                            record.totalTime / (1000 * 60 * 60)
                          : 0;

                        return (
                          <div
                            class={`aspect-square cursor-pointer rounded-md p-1 transition-all duration-200 ${day.isCurrentMonth ? "hover:ring-base-content hover:ring-opacity-20 hover:ring-2" : "opacity-40"} ${day.isToday ? "ring-accent ring-2" : ""} ${day.isSelected ? "ring-primary ring-opacity-70 ring-2" : ""} ${getColorClass(day.date)}`}
                            onClick={() => onDateClick(day.date)}
                          >
                            <div class="flex h-full flex-col">
                              <div
                                class={`text-sm font-bold ${day.isToday ? "text-accent-content" : ""}`}
                              >
                                {day.dayOfMonth}
                              </div>

                              <Show when={record && record.totalTime > 0}>
                                <div class="mt-auto text-right text-xs">
                                  {hours.toFixed(1)}h
                                </div>
                              </Show>
                            </div>
                          </div>
                        );
                      }}
                    </For>
                  </div>
                )}
              </For>
            </div>

            {/* Legend */}
            <div class="mt-4 flex items-center justify-center gap-1 text-xs">
              <div class="flex items-center">
                <div class="bg-base-300 mr-1 h-3 w-3 rounded-sm" />
                <span class="mr-2">0h</span>
              </div>
              <div class="flex items-center">
                <div class="bg-primary bg-opacity-20 mr-1 h-3 w-3 rounded-sm" />
                <span class="mr-2">&lt;2h</span>
              </div>
              <div class="flex items-center">
                <div class="bg-primary bg-opacity-40 mr-1 h-3 w-3 rounded-sm" />
                <span class="mr-2">&lt;4h</span>
              </div>
              <div class="flex items-center">
                <div class="bg-primary bg-opacity-60 mr-1 h-3 w-3 rounded-sm" />
                <span class="mr-2">&lt;6h</span>
              </div>
              <div class="flex items-center">
                <div class="bg-primary bg-opacity-80 mr-1 h-3 w-3 rounded-sm" />
                <span class="mr-2">&lt;8h</span>
              </div>
              <div class="flex items-center">
                <div class="bg-primary mr-1 h-3 w-3 rounded-sm" />
                <span>8h+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Month stats */}
        <div class="stats bg-base-300 mt-6 shadow">
          <div class="stat">
            <div class="stat-figure text-primary">
              <ClockIcon class="h-8 w-8" />
            </div>
            <div class="stat-title">Gesamtzeit</div>
            <div class="stat-value">{formatTime(monthStats().totalTime)}</div>
            <div class="stat-desc">{monthStats().workDays} Arbeitstage</div>
          </div>

          <div class="stat">
            <div class="stat-figure text-secondary">
              <ChartBarIcon class="h-8 w-8" />
            </div>
            <div class="stat-title">Durchschnitt</div>
            <div class="stat-value">{formatTime(monthStats().avgPerDay)}</div>
            <div class="stat-desc">pro Arbeitstag</div>
          </div>

          <Show when={monthStats().mostProductiveDay}>
            <div class="stat">
              <div class="stat-title">Produktivster Tag</div>
              <div class="stat-value text-accent">
                {monthStats().mostProductiveDay != null ?
                  format(
                    parseISO(monthStats().mostProductiveDay as string),
                    "dd. MMM",
                    {
                      locale: de,
                    },
                  )
                : "-"}
              </div>
              <div class="stat-desc">{formatTime(monthStats().maxTime)}</div>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default MonthCalendar;

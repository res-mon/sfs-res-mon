import CalendarIcon from "~icons/tabler/calendar";
import ChartBarIcon from "~icons/tabler/chart-bar";
import ChartLineIcon from "~icons/tabler/chart-line";
import ClockIcon from "~icons/tabler/clock";

import { Component, For, createMemo } from "solid-js";

import {
  eachDayOfInterval,
  format,
  isToday,
  parseISO,
  subDays,
} from "date-fns";
import { de } from "date-fns/locale";

import { DailyRecord } from "./TimeEntryUtils";

interface StatsDashboardProps {
  dailyRecords: DailyRecord[];
  timeSpan?: "week" | "month" | "quarter" | "year";
}

/**
 * StatsDashboard Component
 *
 * Displays comprehensive statistics about work patterns, trends, and insights.
 */
const StatsDashboard: Component<StatsDashboardProps> = (props) => {
  const timeSpan = () => props.timeSpan ?? "month";

  // Calculate date range based on timeSpan
  const dateRange = createMemo(() => {
    const today = new Date();
    let startDate: Date;

    switch (timeSpan()) {
      case "week":
        startDate = subDays(today, 7);
        break;
      case "month":
        startDate = subDays(today, 30);
        break;
      case "quarter":
        startDate = subDays(today, 90);
        break;
      case "year":
        startDate = subDays(today, 365);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return {
      start: startDate,
      end: today,
      days: eachDayOfInterval({ start: startDate, end: today }),
    };
  });

  // Filter records within the selected date range
  const filteredRecords = createMemo(() => {
    const startDate = format(dateRange().start, "yyyy-MM-dd");
    const endDate = format(dateRange().end, "yyyy-MM-dd");

    return props.dailyRecords.filter((record) => {
      return record.date >= startDate && record.date <= endDate;
    });
  });

  // Calculate various statistics
  const stats = createMemo(() => {
    const records = filteredRecords();

    // Initialize with default values
    const result = {
      totalDays: dateRange().days.length,
      activeDays: 0,
      totalHours: 0,
      avgHoursPerDay: 0,
      avgHoursPerActiveDay: 0,
      maxHoursInDay: 0,
      maxHoursDate: "",
      totalEntries: 0,
      commonStartHour: 0,
      commonEndHour: 0,
      mostActiveWeekday: 0,
      mostActiveWeekdayName: "",
      weekdayTotals: [0, 0, 0, 0, 0, 0, 0], // Sunday-Saturday
      hourlyDistribution: Array(24).fill(0) as number[], // 0-23 hours
      streakDays: 0,
    };

    if (records.length === 0) return result;

    // Create a map for faster lookup
    const recordMap = new Map<string, DailyRecord>();
    records.forEach((record) => {
      recordMap.set(record.date, record);
    });

    // Count active days and calculate total hours
    result.activeDays = records.length;

    // Total hours (ms to hours)
    const totalMs = records.reduce((sum, record) => sum + record.totalTime, 0);
    result.totalHours = totalMs / (1000 * 60 * 60);

    // Average hours calculations
    result.avgHoursPerDay = result.totalHours / result.totalDays;
    result.avgHoursPerActiveDay = result.totalHours / result.activeDays;

    // Max hours in a day
    const maxHoursRecord = records.reduce(
      (max, record) => {
        const hours = record.totalTime / (1000 * 60 * 60);
        return hours > max.hours ? { hours, date: record.date } : max;
      },
      { hours: 0, date: "" },
    );

    result.maxHoursInDay = maxHoursRecord.hours;
    result.maxHoursDate = maxHoursRecord.date;

    // Total entries
    result.totalEntries = records.reduce(
      (sum, record) => sum + record.entryPairs.length,
      0,
    );

    // Weekly distribution
    records.forEach((record) => {
      const date = parseISO(record.date);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hoursWorked = record.totalTime / (1000 * 60 * 60);

      result.weekdayTotals[dayOfWeek] += hoursWorked;

      // Most common start and end times
      record.entryPairs.forEach((pair) => {
        if (pair.clockIn != null && !pair.missingEntry) {
          const startHour = new Date(pair.clockIn).getHours();
          result.hourlyDistribution[startHour]++;
        }
      });
    });

    // Find most active weekday
    let maxDay = 0;
    let maxHours = result.weekdayTotals[0];

    for (let i = 1; i < 7; i++) {
      if (result.weekdayTotals[i] > maxHours) {
        maxDay = i;
        maxHours = result.weekdayTotals[i];
      }
    }

    result.mostActiveWeekday = maxDay;
    result.mostActiveWeekdayName = format(
      new Date(2024, 0, 1 + maxDay),
      "EEEE",
      { locale: de },
    );

    // Common start hour (hour with most clock-ins)
    result.commonStartHour = result.hourlyDistribution.indexOf(
      Math.max(...result.hourlyDistribution),
    );

    // Calculate streak
    let currentStreak = 0;
    const dayFormat = "yyyy-MM-dd";

    for (let i = 0; i < dateRange().days.length; i++) {
      const day = dateRange().days[dateRange().days.length - 1 - i];
      const dayStr = format(day, dayFormat);

      if (recordMap.has(dayStr)) {
        currentStreak++;
      } else {
        // Streak is broken if this is not today
        if (i > 0 || !isToday(day)) break;
      }
    }

    result.streakDays = currentStreak;

    return result;
  });

  // Function to get the width for the bar chart based on value
  const getBarWidth = (value: number, max: number) => {
    return max > 0 ? (value / max) * 100 + "%" : "0%";
  };

  // Format hours nicely
  const formatHours = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <ChartBarIcon class="mr-2" /> Arbeitszeit-Statistik
        </h2>

        <div class="my-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Total Time Card */}
          <div class="stat bg-base-300 rounded-box">
            <div class="stat-figure text-primary">
              <ClockIcon class="h-8 w-8" />
            </div>
            <div class="stat-title">Gesamtzeit</div>
            <div class="stat-value text-primary">
              {formatHours(stats().totalHours)}
            </div>
            <div class="stat-desc">in {stats().activeDays} aktiven Tagen</div>
          </div>

          {/* Daily Average Card */}
          <div class="stat bg-base-300 rounded-box">
            <div class="stat-figure text-secondary">
              <CalendarIcon class="h-8 w-8" />
            </div>
            <div class="stat-title">Tagesdurchschnitt</div>
            <div class="stat-value text-secondary">
              {formatHours(stats().avgHoursPerActiveDay)}
            </div>
            <div class="stat-desc">an aktiven Arbeitstagen</div>
          </div>

          {/* Streak Card */}
          <div class="stat bg-base-300 rounded-box">
            <div class="stat-figure text-accent">
              <ChartLineIcon class="h-8 w-8" />
            </div>
            <div class="stat-title">Aktuelle Serie</div>
            <div class="stat-value text-accent">{stats().streakDays} Tage</div>
            <div class="stat-desc">
              {stats().streakDays > 0 ?
                "Kontinuierliche Arbeit"
              : "Keine aktive Serie"}
            </div>
          </div>
        </div>

        {/* Weekday Distribution */}
        <div class="my-6">
          <h3 class="mb-3 text-lg font-semibold">Wochentagsverteilung</h3>
          <div class="space-y-2">
            <For
              each={[
                "Sonntag",
                "Montag",
                "Dienstag",
                "Mittwoch",
                "Donnerstag",
                "Freitag",
                "Samstag",
              ]}
            >
              {(day, index) => {
                const value = () => stats().weekdayTotals[index()];
                const max = Math.max(...stats().weekdayTotals);
                const width = () => getBarWidth(value(), max);
                const isHighest = () => value() === max && max > 0;

                return (
                  <div class="flex items-center">
                    <div class="w-24 text-sm">{day}</div>
                    <div class="bg-base-300 h-6 flex-1 overflow-hidden rounded-full">
                      <div
                        class={`h-full rounded-full ${isHighest() ? "bg-primary" : "bg-secondary"}`}
                        style={{ width: width() }}
                      />
                    </div>
                    <div class="w-20 text-right text-sm">
                      {formatHours(value())}
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
          <div class="mt-1 text-sm opacity-70">
            Bevorzugter Wochentag:{" "}
            <span class="font-semibold">{stats().mostActiveWeekdayName}</span>
          </div>
        </div>

        {/* Hourly Distribution */}
        <div class="my-6">
          <h3 class="mb-3 text-lg font-semibold">Tagesstundenverteilung</h3>
          <div class="flex h-40 items-end space-x-1">
            <For each={stats().hourlyDistribution}>
              {(count, hour) => {
                const max = Math.max(...stats().hourlyDistribution);
                const height = max > 0 ? (count / max) * 100 + "%" : "0%";
                const isHighest = count === max && max > 0;
                const isCommonStart = () =>
                  hour() === stats().commonStartHour && count > 0;

                return (
                  <div class="flex flex-1 flex-col items-center">
                    <div
                      class={`w-full ${
                        isCommonStart() ? "bg-accent"
                        : isHighest ? "bg-primary"
                        : "bg-secondary"
                      } tooltip rounded-t-sm opacity-80`}
                      style={{ height }}
                      data-tip={`${count} Einstempelungen um ${hour()}:00 Uhr`}
                    />
                    <div class="mt-1 text-xs">{hour()}</div>
                  </div>
                );
              }}
            </For>
          </div>
          <div class="mt-1 text-sm opacity-70">
            Häufigste Startzeit:{" "}
            <span class="font-semibold">{stats().commonStartHour}:00 Uhr</span>
          </div>
        </div>

        {/* Additional Stats */}
        <div class="divider" />

        <div class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-3">
          <div>
            <div class="stat-title text-xs">Produktivste Tag</div>
            <div class="font-semibold">
              {stats().maxHoursDate ?
                format(parseISO(stats().maxHoursDate), "dd. MMMM yyyy", {
                  locale: de,
                })
              : "-"}{" "}
              ({formatHours(stats().maxHoursInDay)})
            </div>
          </div>

          <div>
            <div class="stat-title text-xs">Durchschnitt (alle Tage)</div>
            <div class="font-semibold">
              {formatHours(stats().avgHoursPerDay)}
            </div>
          </div>

          <div>
            <div class="stat-title text-xs">Gesamtzahl Stempelungen</div>
            <div class="font-semibold">{stats().totalEntries} Einträge</div>
          </div>

          <div>
            <div class="stat-title text-xs">Aktive/Gesamttage</div>
            <div class="font-semibold">
              {stats().activeDays} von {stats().totalDays} Tagen
            </div>
          </div>

          <div>
            <div class="stat-title text-xs">Aktivitätsrate</div>
            <div class="font-semibold">
              {stats().totalDays > 0 ?
                Math.round((stats().activeDays / stats().totalDays) * 100)
              : 0}
              %
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;

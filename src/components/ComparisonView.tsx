import ArrowDownIcon from "~icons/tabler/arrow-down";
import ArrowUpIcon from "~icons/tabler/arrow-up";
import CompareIcon from "~icons/tabler/arrows-diff";
import InfoCircleIcon from "~icons/tabler/info-circle";

import { Component, JSX, createMemo, createSignal } from "solid-js";

import {
  endOfWeek,
  format,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { de } from "date-fns/locale";

import { DailyRecord } from "./TimeEntryUtils";

interface ComparisonViewProps {
  dailyRecords: DailyRecord[];
}

/**
 * ComparisonView Component
 *
 * Displays comparison between current period and previous period work patterns,
 * showing trends, improvements, and changes in work habits.
 */
const ComparisonView: Component<ComparisonViewProps> = (props) => {
  const [comparisonPeriod, setComparisonPeriod] = createSignal<
    "week" | "month"
  >("week");

  // Generate date ranges for current and previous periods
  const dateRanges = createMemo(() => {
    const today = new Date();

    if (comparisonPeriod() === "week") {
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const previousWeekStart = subWeeks(currentWeekStart, 1);
      const previousWeekEnd = subDays(currentWeekStart, 1);

      return {
        current: {
          start: format(currentWeekStart, "yyyy-MM-dd"),
          end: format(currentWeekEnd, "yyyy-MM-dd"),
          label: `Aktuelle Woche (${format(currentWeekStart, "dd.MM.", { locale: de })} - ${format(currentWeekEnd, "dd.MM.", { locale: de })})`,
        },
        previous: {
          start: format(previousWeekStart, "yyyy-MM-dd"),
          end: format(previousWeekEnd, "yyyy-MM-dd"),
          label: `Vorherige Woche (${format(previousWeekStart, "dd.MM.", { locale: de })} - ${format(previousWeekEnd, "dd.MM.", { locale: de })})`,
        },
      };
    }

    const currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    const currentMonthEnd = today;
    const previousMonthStart = subMonths(currentMonthStart, 1);
    const previousMonthLastDay = new Date(currentMonthStart);
    previousMonthLastDay.setDate(previousMonthLastDay.getDate() - 1);

    return {
      current: {
        start: format(currentMonthStart, "yyyy-MM-dd"),
        end: format(currentMonthEnd, "yyyy-MM-dd"),
        label: `Aktueller Monat (${format(currentMonthStart, "MMMM", { locale: de })})`,
      },
      previous: {
        start: format(previousMonthStart, "yyyy-MM-dd"),
        end: format(previousMonthLastDay, "yyyy-MM-dd"),
        label: `Vorheriger Monat (${format(previousMonthStart, "MMMM", { locale: de })})`,
      },
    };
  });

  // Filter records for current and previous periods
  const periodData = createMemo(() => {
    const ranges = dateRanges();

    const currentPeriodRecords = props.dailyRecords.filter(
      (record) =>
        record.date >= ranges.current.start &&
        record.date <= ranges.current.end,
    );

    const previousPeriodRecords = props.dailyRecords.filter(
      (record) =>
        record.date >= ranges.previous.start &&
        record.date <= ranges.previous.end,
    );

    return {
      current: processRecords(currentPeriodRecords),
      previous: processRecords(previousPeriodRecords),
    };
  });

  // Process records to get statistics for a period
  function processRecords(records: DailyRecord[]) {
    // Default values for empty data
    if (records.length === 0) {
      return {
        totalTime: 0,
        totalHours: 0,
        workDays: 0,
        avgHoursPerDay: 0,
        avgSessionCount: 0,
        totalSessions: 0,
        earlyStarts: 0,
        lateEnds: 0,
      };
    }

    // Calculate total work time
    const totalTimeMs = records.reduce(
      (sum, record) => sum + record.totalTime,
      0,
    );
    const totalHours = totalTimeMs / (1000 * 60 * 60);

    // Count days worked
    const workDays = records.length;

    // Calculate average hours per work day
    const avgHoursPerDay = workDays > 0 ? totalHours / workDays : 0;

    // Count total sessions
    const totalSessions = records.reduce(
      (sum, record) => sum + record.entryPairs.length,
      0,
    );

    // Calculate average sessions per day
    const avgSessionCount = workDays > 0 ? totalSessions / workDays : 0;

    // Count early starts (before 8 AM)
    let earlyStarts = 0;

    // Count late ends (after 6 PM)
    let lateEnds = 0;

    // Process entries to count early starts and late ends
    records.forEach((record) => {
      record.entryPairs.forEach((pair) => {
        // Check for early starts
        if (pair.clockIn != null) {
          const startHour = new Date(pair.clockIn).getHours();
          if (startHour < 8) {
            earlyStarts++;
          }
        }

        // Check for late ends
        if (pair.clockOut != null) {
          const endHour = new Date(pair.clockOut).getHours();
          if (endHour >= 18) {
            lateEnds++;
          }
        }
      });
    });

    return {
      totalTime: totalTimeMs,
      totalHours,
      workDays,
      avgHoursPerDay,
      avgSessionCount,
      totalSessions,
      earlyStarts,
      lateEnds,
    };
  }

  // Calculate percentage change between two values
  function calculateChange(current: number, previous: number) {
    if (previous === 0) {
      return current > 0 ? 100 : 0; // Avoid division by zero
    }
    return ((current - previous) / previous) * 100;
  }

  // Format hours nicely
  function formatHours(hours: number) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  }

  // Get appropriate color and icon based on change percentage and whether increase is positive
  function getChangeDisplay(change: number, positiveIsGood: boolean) {
    const isPositive = change > 0;
    const isNeutral = change === 0;

    // Determine if the change is good (green) or bad (red)
    const isGood =
      (isPositive && positiveIsGood) || (!isPositive && !positiveIsGood);

    // For zero change, always show neutral
    if (isNeutral) {
      return {
        color: "text-base-content opacity-60",
        icon: null,
        text: "0%",
      };
    }

    return {
      color: isGood ? "text-success" : "text-error",
      icon:
        isPositive ?
          <ArrowUpIcon class="inline h-4 w-4" />
        : <ArrowDownIcon class="inline h-4 w-4" />,
      text: `${Math.abs(Math.round(change))}%`,
    };
  }

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title flex justify-between">
          <span>
            <CompareIcon class="mr-2" /> Zeitraumvergleich
          </span>

          <div class="flex items-center gap-2">
            <div class="join">
              <button
                class={`join-item btn btn-sm ${comparisonPeriod() === "week" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setComparisonPeriod("week")}
              >
                Wöchentlich
              </button>
              <button
                class={`join-item btn btn-sm ${comparisonPeriod() === "month" ? "btn-primary" : "btn-outline"}`}
                onClick={() => setComparisonPeriod("month")}
              >
                Monatlich
              </button>
            </div>
          </div>
        </h2>

        <div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Summary Cards */}
          <div class="bg-base-300 flex flex-col rounded-lg p-4">
            <h3 class="mb-3 text-center font-semibold">
              {dateRanges().previous.label}
            </h3>

            <div class="stats bg-base-200 stats-vertical shadow">
              <div class="stat">
                <div class="stat-title">Gesamtarbeitszeit</div>
                <div class="stat-value">
                  {formatHours(periodData().previous.totalHours)}
                </div>
                <div class="stat-desc">
                  {periodData().previous.workDays} Arbeitstage
                </div>
              </div>

              <div class="stat">
                <div class="stat-title">Durchschnitt pro Tag</div>
                <div class="stat-value text-secondary">
                  {formatHours(periodData().previous.avgHoursPerDay)}
                </div>
                <div class="stat-desc">
                  {periodData().previous.avgSessionCount.toFixed(1)}{" "}
                  Sitzungen/Tag
                </div>
              </div>
            </div>
          </div>

          <div class="bg-base-300 flex flex-col rounded-lg p-4">
            <h3 class="mb-3 text-center font-semibold">
              {dateRanges().current.label}
            </h3>

            <div class="stats bg-base-200 stats-vertical shadow">
              <div class="stat">
                <div class="stat-title">Gesamtarbeitszeit</div>
                <div class="stat-value">
                  {formatHours(periodData().current.totalHours)}
                </div>
                <div class="stat-desc">
                  {periodData().current.workDays} Arbeitstage
                </div>
              </div>

              <div class="stat">
                <div class="stat-title">Durchschnitt pro Tag</div>
                <div class="stat-value text-secondary">
                  {formatHours(periodData().current.avgHoursPerDay)}
                </div>
                <div class="stat-desc">
                  {periodData().current.avgSessionCount.toFixed(1)}{" "}
                  Sitzungen/Tag
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Metrics */}
        <div class="mt-8">
          <h3 class="mb-4 text-lg font-semibold">
            Veränderungen im Vergleich zum vorherigen Zeitraum
          </h3>

          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Metrik</th>
                  <th class="text-center">Vorher</th>
                  <th class="text-center">Aktuell</th>
                  <th class="text-center">Veränderung</th>
                </tr>
              </thead>
              <tbody>
                {/* Total working hours */}
                <tr>
                  <td>Gesamtstunden</td>
                  <td class="text-center">
                    {formatHours(periodData().previous.totalHours)}
                  </td>
                  <td class="text-center">
                    {formatHours(periodData().current.totalHours)}
                  </td>
                  <td class="text-center">
                    {(() => {
                      const change = calculateChange(
                        periodData().current.totalHours,
                        periodData().previous.totalHours,
                      );
                      const display = getChangeDisplay(change, true);

                      return (
                        <span class={display.color}>
                          {display.icon} {display.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Working days */}
                <tr>
                  <td>Arbeitstage</td>
                  <td class="text-center">{periodData().previous.workDays}</td>
                  <td class="text-center">{periodData().current.workDays}</td>
                  <td class="text-center">
                    {(() => {
                      const change = calculateChange(
                        periodData().current.workDays,
                        periodData().previous.workDays,
                      );
                      const display = getChangeDisplay(change, true);

                      return (
                        <span class={display.color}>
                          {display.icon} {display.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Average hours per day */}
                <tr>
                  <td>Durchschnittliche Stunden/Tag</td>
                  <td class="text-center">
                    {periodData().previous.avgHoursPerDay.toFixed(2)}
                  </td>
                  <td class="text-center">
                    {periodData().current.avgHoursPerDay.toFixed(2)}
                  </td>
                  <td class="text-center">
                    {(() => {
                      const change = calculateChange(
                        periodData().current.avgHoursPerDay,
                        periodData().previous.avgHoursPerDay,
                      );
                      const display = getChangeDisplay(change, true);

                      return (
                        <span class={display.color}>
                          {display.icon} {display.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Total sessions */}
                <tr>
                  <td>Gesamtanzahl Sitzungen</td>
                  <td class="text-center">
                    {periodData().previous.totalSessions}
                  </td>
                  <td class="text-center">
                    {periodData().current.totalSessions}
                  </td>
                  <td class="text-center">
                    {(() => {
                      const change = calculateChange(
                        periodData().current.totalSessions,
                        periodData().previous.totalSessions,
                      );
                      const display = getChangeDisplay(change, true);

                      return (
                        <span class={display.color}>
                          {display.icon} {display.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Early starts */}
                <tr>
                  <td>Frühe Starts (vor 8 Uhr)</td>
                  <td class="text-center">
                    {periodData().previous.earlyStarts}
                  </td>
                  <td class="text-center">
                    {periodData().current.earlyStarts}
                  </td>
                  <td class="text-center">
                    {(() => {
                      const change = calculateChange(
                        periodData().current.earlyStarts,
                        periodData().previous.earlyStarts,
                      );
                      // Whether more early starts is good depends on user preference
                      // Here we assume more early starts is good (but could be configurable)
                      const display = getChangeDisplay(change, true);

                      return (
                        <span class={display.color}>
                          {display.icon} {display.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>

                {/* Late ends */}
                <tr>
                  <td>Späte Enden (nach 18 Uhr)</td>
                  <td class="text-center">{periodData().previous.lateEnds}</td>
                  <td class="text-center">{periodData().current.lateEnds}</td>
                  <td class="text-center">
                    {(() => {
                      const change = calculateChange(
                        periodData().current.lateEnds,
                        periodData().previous.lateEnds,
                      );
                      // Whether more late ends is good depends on user preference
                      // Here we assume fewer late ends is good (better work-life balance)
                      const display = getChangeDisplay(change, false);

                      return (
                        <span class={display.color}>
                          {display.icon} {display.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Insight Summary */}
        <div class="bg-base-300 mt-6 rounded-lg p-4">
          <h3 class="mb-2 flex items-center text-lg font-semibold">
            <InfoCircleIcon class="mr-2" /> Erkenntnisse
          </h3>

          <div class="space-y-2 text-sm">
            {(() => {
              const data = periodData();
              const insights: JSX.Element = [];

              const addTotalHoursInsight = () => {
                if (data.current.totalHours > data.previous.totalHours) {
                  insights.push(
                    <p>
                      Du hast im aktuellen Zeitraum mehr gearbeitet als im
                      vorigen Zeitraum.
                    </p>,
                  );
                } else if (data.current.totalHours < data.previous.totalHours) {
                  insights.push(
                    <p>
                      Du hast im aktuellen Zeitraum weniger gearbeitet als im
                      vorigen Zeitraum.
                    </p>,
                  );
                }
              };

              const addWorkPatternInsights = () => {
                if (data.current.earlyStarts > data.previous.earlyStarts) {
                  insights.push(
                    <p>
                      Du hast häufiger früh morgens (vor 8 Uhr) mit der Arbeit
                      begonnen.
                    </p>,
                  );
                }

                if (data.current.lateEnds < data.previous.lateEnds) {
                  insights.push(
                    <p>
                      Du hast seltener bis spät abends (nach 18 Uhr) gearbeitet
                      - besser für die Work-Life-Balance!
                    </p>,
                  );
                } else if (data.current.lateEnds > data.previous.lateEnds) {
                  insights.push(
                    <p>
                      Du hast häufiger bis spät abends (nach 18 Uhr) gearbeitet.
                    </p>,
                  );
                }
              };

              const addSessionPatternInsights = () => {
                if (
                  data.current.avgSessionCount > data.previous.avgSessionCount
                ) {
                  insights.push(
                    <p>
                      Du hast mehr Arbeitssitzungen pro Tag - möglicherweise mit
                      mehr Unterbrechungen.
                    </p>,
                  );
                } else if (
                  data.current.avgSessionCount < data.previous.avgSessionCount
                ) {
                  insights.push(
                    <p>
                      Du hast weniger Arbeitssitzungen pro Tag - möglicherweise
                      mit längeren, fokussierteren Zeiträumen.
                    </p>,
                  );
                }
              };

              const addWorkDaysInsight = () => {
                if (data.current.workDays > data.previous.workDays) {
                  insights.push(
                    <p>
                      Du hast an mehr Tagen gearbeitet als im vorherigen
                      Zeitraum.
                    </p>,
                  );
                } else if (data.current.workDays < data.previous.workDays) {
                  insights.push(
                    <p>
                      Du hast an weniger Tagen gearbeitet als im vorherigen
                      Zeitraum.
                    </p>,
                  );
                }
              };

              const addDefaultInsight = () => {
                if (insights.length === 0) {
                  insights.push(
                    <p>
                      Nicht genügend Daten für detaillierte Erkenntnisse
                      verfügbar.
                    </p>,
                  );
                }
              };

              addTotalHoursInsight();
              addWorkPatternInsights();
              addSessionPatternInsights();
              addWorkDaysInsight();
              addDefaultInsight();

              return insights;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;

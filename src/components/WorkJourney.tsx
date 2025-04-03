import MapIcon from "~icons/tabler/map";
import MapPinIcon from "~icons/tabler/map-pin";

import {
  Component,
  For,
  Show,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";

import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

import { DailyRecord } from "./TimeEntryUtils";

interface WorkJourneyProps {
  dailyRecords: DailyRecord[];
  daysToShow?: number;
  onDaySelect?: (date: string) => void;
}

/**
 * WorkJourney Component
 *
 * Visualizes work time as a journey with each day being a step on the path.
 * Shows your work progress as a metaphorical journey with milestones and patterns.
 */
const WorkJourney: Component<WorkJourneyProps> = (props) => {
  const [svgWidth, setSvgWidth] = createSignal(1000);
  const [svgHeight, setSvgHeight] = createSignal(400);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement | null>(
    null,
  );
  const [selectedPoint, setSelectedPoint] = createSignal<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = createSignal<number | null>(null);

  const daysToShow = () => props.daysToShow ?? 30; // Default to 30 days

  // Format date for display
  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), "dd. MMM yyyy", { locale: de });
  };

  // Format short date for labels
  const formatShortDate = (dateStr: string) => {
    return format(parseISO(dateStr), "dd.MM.", { locale: de });
  };

  // Format time for display (hours as decimal)
  const formatHours = (milliseconds: number) => {
    const hours = milliseconds / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  // Get display records - a slice of the last N days
  const journeyRecords = createMemo(() => {
    // Sort records by date (oldest first for our journey)
    const sortedRecords = [...props.dailyRecords].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Take the last daysToShow records or all if there are fewer
    return sortedRecords.slice(-daysToShow());
  });

  // Generate path points for our records
  const pathData = createMemo(() => {
    const records = journeyRecords();
    if (records.length === 0)
      return { points: [], totalTime: 0, milestones: [] };

    const width = svgWidth() - 80; // Leave margins
    const height = svgHeight() - 100; // Leave margins

    const points: {
      x: number;
      y: number;
      date: string;
      time: number;
      hours: number;
      avgHeight: number;
    }[] = [];
    const milestones: {
      x: number;
      y: number;
      date: string;
      label: string;
      value: string;
    }[] = [];

    // Find max working time to scale heights
    const maxTime = Math.max(...records.map((r) => r.totalTime));

    // Calculate total working time
    const totalTime = records.reduce(
      (sum, record) => sum + record.totalTime,
      0,
    );
    const totalHours = totalTime / (1000 * 60 * 60);

    // Calculate starting point
    const startX = 40;
    const endX = width - 40;
    const step =
      records.length > 1 ? (endX - startX) / (records.length - 1) : 0;

    let maxHoursDay = { date: "", hours: 0 };
    let totalSessionsCount = 0;
    let cumulativeTime = 0;

    // Create points for each record
    records.forEach((record, index) => {
      // Calculate horizontal position
      const x = startX + index * step;

      // Calculate height normalized to [0, 1]
      let normalizedHeight = 0;
      if (maxTime > 0) {
        normalizedHeight = record.totalTime / maxTime;
      }

      // Calculate vertical position (inverted, as SVG y increases downward)
      // We use a non-linear scale to make differences more visible
      // And add some minimum height for days with activity
      const baseHeight = 50; // Minimum height
      const scaleHeight = height - baseHeight;

      // Apply a sine curve to emphasize the middle range
      let y;
      if (record.totalTime === 0) {
        y = height; // Bottom for zero activity
      } else {
        // Square root to emphasize differences in lower values
        const scaleFactor = Math.sqrt(normalizedHeight);
        y = height - (baseHeight + scaleFactor * scaleHeight);
      }

      // Accumulate total time
      cumulativeTime += record.totalTime;

      // Add this point
      const hours = record.totalTime / (1000 * 60 * 60);
      points.push({
        x,
        y,
        date: record.date,
        time: record.totalTime,
        hours,
        avgHeight:
          height -
          (baseHeight +
            (cumulativeTime / ((index + 1) * maxTime)) * scaleHeight),
      });

      // Count total sessions
      totalSessionsCount += record.entryPairs.length;

      // Check if this is the day with most hours
      if (hours > maxHoursDay.hours) {
        maxHoursDay = { date: record.date, hours };
      }

      // Add milestones for special days
      // Milestone 1: First day of journey
      if (index === 0) {
        milestones.push({
          x,
          y: y - 25,
          date: record.date,
          label: "Start",
          value: formatDate(record.date),
        });
      }

      // Milestone 2: Most productive day
      if (record.totalTime === maxTime) {
        milestones.push({
          x,
          y: y - 35,
          date: record.date,
          label: "Produktivster Tag",
          value: `${formatHours(record.totalTime)}h`,
        });
      }

      // Milestone 3: Last day of journey
      if (index === records.length - 1) {
        milestones.push({
          x,
          y: y - 25,
          date: record.date,
          label: "Aktuell",
          value: formatDate(record.date),
        });
      }
    });

    return {
      points,
      totalTime: totalHours,
      totalDays: records.length,
      activeDays: records.filter((r) => r.totalTime > 0).length,
      totalSessions: totalSessionsCount,
      maxHoursDay,
      milestones,
    };
  });

  // Create SVG path from points
  const svgPath = createMemo(() => {
    const points = pathData().points;
    if (points.length === 0) return "";

    // Create path command
    let path = `M ${points[0].x} ${points[0].y}`;

    // Add cubic bezier curves for smoother path
    for (let i = 1; i < points.length; i++) {
      const curr = points[i];
      const prev = points[i - 1];

      // Control points for the curve
      const cp1x = prev.x + (curr.x - prev.x) / 3;
      const cp1y = prev.y;
      const cp2x = curr.x - (curr.x - prev.x) / 3;
      const cp2y = curr.y;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }

    return path;
  });

  // Average line path
  const avgPath = createMemo(() => {
    const points = pathData().points;
    if (points.length === 0) return "";

    // Create path command for average line
    let path = `M ${points[0].x} ${points[0].avgHeight}`;

    // Add lines for the rest of the points
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].avgHeight}`;
    }

    return path;
  });

  // Update SVG dimensions when container size changes
  const updateDimensions = () => {
    const container = containerRef();
    if (container) {
      setSvgWidth(container.clientWidth);
      setSvgHeight(Math.min(400, Math.max(300, container.clientWidth * 0.4)));
    }
  };

  // Set up resize observer
  onMount(() => {
    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    const container = containerRef();
    if (container) {
      observer.observe(container);
    }

    return () => {
      if (container) {
        observer.unobserve(container);
      }
    };
  });

  // Handle point click
  const handlePointClick = (index: number) => {
    setSelectedPoint(index);
    const date = pathData().points[index].date;
    if (props.onDaySelect) {
      props.onDaySelect(date);
    }
  };

  return (
    <div class="card bg-base-200 shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <MapIcon class="mr-2" /> Arbeitszeit-Reise
        </h2>

        <div
          class="mt-4 w-full"
          ref={setContainerRef}
        >
          <Show when={pathData().points.length > 0}>
            <svg
              width={svgWidth()}
              height={svgHeight()}
              viewBox={`0 0 ${svgWidth()} ${svgHeight()}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Background grid */}
              <g class="opacity-20">
                <For each={Array.from({ length: 5 }, (_, i) => i)}>
                  {(i) => {
                    const y = 50 + (i * (svgHeight() - 100)) / 4;
                    return (
                      <line
                        x1="40"
                        y1={y}
                        x2={svgWidth() - 40}
                        y2={y}
                        stroke="currentColor"
                        stroke-dasharray="2 2"
                      />
                    );
                  }}
                </For>
              </g>

              {/* Average line */}
              <path
                d={avgPath()}
                fill="none"
                stroke="var(--s)"
                stroke-width="1.5"
                stroke-dasharray="4 2"
                class="opacity-50"
              />

              {/* Journey path */}
              <path
                d={svgPath()}
                fill="none"
                stroke="var(--p)"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              {/* Day points */}
              <For each={pathData().points}>
                {(point, index) => (
                  <g class="cursor-pointer">
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={
                        selectedPoint() === index() ? 8
                        : hoveredPoint() === index() ?
                          6
                        : 4
                      }
                      fill={
                        point.time === 0 ? "var(--b3)"
                        : selectedPoint() === index() ?
                          "var(--p)"
                        : "var(--b1)"
                      }
                      stroke={
                        selectedPoint() === index() ? "var(--p)" : "var(--b2)"
                      }
                      stroke-width="1.5"
                      onMouseOver={() => setHoveredPoint(index())}
                      onMouseOut={() => setHoveredPoint(null)}
                      onClick={() => handlePointClick(index())}
                      class="transition-all duration-200"
                    />

                    {/* Tooltip */}
                    <Show
                      when={
                        hoveredPoint() === index() ||
                        selectedPoint() === index()
                      }
                    >
                      <g>
                        <rect
                          x={point.x - 60}
                          y={point.y - 60}
                          width="120"
                          height="45"
                          rx="4"
                          fill="var(--b2)"
                          opacity="0.9"
                        />
                        <text
                          x={point.x}
                          y={point.y - 42}
                          text-anchor="middle"
                          font-size="11"
                          fill="currentColor"
                          class="font-semibold"
                        >
                          {formatDate(point.date)}
                        </text>
                        <text
                          x={point.x}
                          y={point.y - 25}
                          text-anchor="middle"
                          font-size="11"
                          fill="currentColor"
                        >
                          {formatHours(point.time)}h gearbeitet
                        </text>
                      </g>

                      {/* Connection line to X-axis */}
                      <line
                        x1={point.x}
                        y1={point.y + 5}
                        x2={point.x}
                        y2={svgHeight() - 40}
                        stroke="var(--b3)"
                        stroke-width="1"
                        stroke-dasharray="2 2"
                      />
                    </Show>
                  </g>
                )}
              </For>

              {/* Milestones */}
              <For each={pathData().milestones}>
                {(milestone) => (
                  <g>
                    <MapPinIcon
                      x={milestone.x - 8}
                      y={milestone.y - 16}
                      class="text-accent h-4 w-4"
                    />
                    <text
                      x={milestone.x}
                      y={milestone.y - 25}
                      text-anchor="middle"
                      font-size="10"
                      fill="var(--a)"
                    >
                      {milestone.label}
                    </text>
                  </g>
                )}
              </For>

              {/* X axis */}
              <line
                x1="40"
                y1={svgHeight() - 40}
                x2={svgWidth() - 40}
                y2={svgHeight() - 40}
                stroke="currentColor"
                stroke-width="1"
              />

              {/* X axis date labels (show a selection of dates) */}
              <For
                each={pathData().points.filter(
                  (_, i, arr) =>
                    i === 0 ||
                    i === arr.length - 1 ||
                    i % Math.max(1, Math.floor(arr.length / 5)) === 0,
                )}
              >
                {(point) => (
                  <text
                    x={point.x}
                    y={svgHeight() - 25}
                    text-anchor="middle"
                    font-size="10"
                    fill="currentColor"
                  >
                    {formatShortDate(point.date)}
                  </text>
                )}
              </For>
            </svg>

            {/* Summary statistics */}
            <div class="stats bg-base-300 mt-4 shadow">
              <div class="stat">
                <div class="stat-title">Gesamtarbeitszeit</div>
                <div class="stat-value">{pathData().totalTime.toFixed(1)}h</div>
                <div class="stat-desc">{pathData().activeDays} aktive Tage</div>
              </div>

              <div class="stat">
                <div class="stat-title">Sitzungen</div>
                <div class="stat-value">{pathData().totalSessions}</div>
                <div class="stat-desc">in {pathData().totalDays} Tagen</div>
              </div>

              <div class="stat">
                <div class="stat-title">Spitzentag</div>
                <div class="stat-value">
                  {pathData().maxHoursDay?.hours.toFixed(1)}h
                </div>
                <div class="stat-desc">
                  {pathData().maxHoursDay ?
                    formatShortDate(pathData().maxHoursDay!.date)
                  : ""}
                </div>
              </div>
            </div>
          </Show>

          <Show when={pathData().points.length === 0}>
            <div class="flex h-60 items-center justify-center text-center">
              <div>
                <MapIcon class="mx-auto mb-4 h-16 w-16 opacity-20" />
                <p>Keine Daten für die Visualisierung verfügbar.</p>
                <p class="mt-2 text-sm opacity-70">
                  Stempele ein paar Mal ein und aus, um deine Arbeitszeit-Reise
                  zu beginnen.
                </p>
              </div>
            </div>
          </Show>
        </div>

        <div class="text-base-content mt-2 text-right text-xs opacity-70">
          Die letzten {daysToShow()} Tage deiner Arbeitszeit-Reise
        </div>
      </div>
    </div>
  );
};

export default WorkJourney;

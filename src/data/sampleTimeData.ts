import { parse } from "date-fns";

// Data type definitions
export interface TimeEntry {
  type: "clock-in" | "clock-out";
  timestamp: number; // Unix timestamp in milliseconds
}

export interface TimeRecord {
  date: string; // ISO date string - for the day
  entries: TimeEntry[];
}

export interface TimeEntryPair {
  clockIn: number;
  clockOut: number | null;
  duration: number; // Duration in milliseconds
  dayBoundary: boolean; // Flag to indicate if this entry crosses midnight
}

export interface DailyRecord {
  date: string;
  entryPairs: TimeEntryPair[];
  totalTime: number; // total milliseconds
  formattedTotal: string; // formatted duration
}

// Sample data from the provided table
interface SampleTimeEntry {
  date: string; // "DD.MM.YYYY"
  startTimes: string[]; // Array of "HH:MM:SS" start times
  endTimes: string[]; // Array of "HH:MM:SS" or "DD.MM.YYYY, HH:MM:SS" end times
  duration: string; // "HH:MM:SS" total duration
}

// Format milliseconds into HH:MM:SS string
export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(2, "0")}`;
};

// Check if a timestamp is from the same day as the reference date
export const isSameDay = (timestamp: number, dateString: string): boolean => {
  const date = new Date(timestamp);
  const refDate = new Date(dateString);

  return (
    date.getFullYear() === refDate.getFullYear() &&
    date.getMonth() === refDate.getMonth() &&
    date.getDate() === refDate.getDate()
  );
};

// Parse the sample data
export const parseSampleData = (): TimeRecord[] => {
  // Define the sample data from the table
  const sampleData: SampleTimeEntry[] = [
    {
      date: "27.03.2025",
      startTimes: ["09:35:32"],
      endTimes: ["10:50:16"],
      duration: "01:14:44",
    },
    {
      date: "26.03.2025",
      startTimes: ["09:54:17"],
      endTimes: ["10:23:09"],
      duration: "00:28:52",
    },
    {
      date: "25.03.2025",
      startTimes: ["10:46:00", "19:47:49"],
      endTimes: ["11:30:37", "21:17:15"],
      duration: "02:14:03",
    },
    {
      date: "23.03.2025",
      startTimes: ["12:53:09"],
      endTimes: ["13:35:33"],
      duration: "00:42:24",
    },
    {
      date: "22.03.2025",
      startTimes: ["07:46:14"],
      endTimes: ["08:38:35"],
      duration: "00:52:22",
    },
    {
      date: "16.03.2025",
      startTimes: ["20:44:27"],
      endTimes: ["22:44:27"],
      duration: "02:00:00",
    },
    {
      date: "15.03.2025",
      startTimes: ["10:42:55", "11:46:52"],
      endTimes: ["11:35:13", "12:32:56"],
      duration: "01:38:21",
    },
    {
      date: "14.03.2025",
      startTimes: ["21:07:55"],
      endTimes: ["22:12:00"],
      duration: "01:04:05",
    },
    {
      date: "13.03.2025",
      startTimes: ["21:33:11"],
      endTimes: ["23:06:26"],
      duration: "01:33:15",
    },
    {
      date: "12.03.2025",
      startTimes: ["20:11:17"],
      endTimes: ["21:41:04"],
      duration: "01:29:47",
    },
    {
      date: "10.03.2025",
      startTimes: ["20:14:20"],
      endTimes: ["22:16:52"],
      duration: "02:02:32",
    },
    {
      date: "07.03.2025",
      startTimes: ["18:25:33"],
      endTimes: ["19:13:58"],
      duration: "00:48:25",
    },
    {
      date: "06.03.2025",
      startTimes: ["21:50:28"],
      endTimes: ["23:08:47"],
      duration: "01:18:20",
    },
    {
      date: "05.03.2025",
      startTimes: ["20:31:49"],
      endTimes: ["21:29:43"],
      duration: "00:57:54",
    },
    {
      date: "04.03.2025",
      startTimes: ["19:07:55", "22:43:49"],
      endTimes: ["20:41:31", "05.03.2025, 00:18:02"],
      duration: "03:07:48",
    },
    {
      date: "03.03.2025",
      startTimes: ["20:53:03", "21:30:18"],
      endTimes: ["21:17:43", "22:09:29"],
      duration: "01:03:51",
    },
    {
      date: "01.03.2025",
      startTimes: ["10:52:50"],
      endTimes: ["12:12:52"],
      duration: "01:20:03",
    },
    {
      date: "26.02.2025",
      startTimes: ["17:19:32", "22:25:20"],
      endTimes: ["17:51:26", "23:10:07"],
      duration: "01:16:42",
    },
    {
      date: "25.02.2025",
      startTimes: ["23:03:05"],
      endTimes: ["23:48:40"],
      duration: "00:45:35",
    },
    // Let's add some examples that cross midnight
    {
      date: "24.02.2025",
      startTimes: ["23:30:00"],
      endTimes: ["25.02.2025, 01:30:00"],
      duration: "02:00:00",
    },
    {
      date: "19.02.2025",
      startTimes: ["21:30:53"],
      endTimes: ["22:00:15"],
      duration: "00:29:22",
    },
    {
      date: "18.02.2025",
      startTimes: ["17:40:08", "18:30:45", "23:45:00"],
      endTimes: ["18:14:04", "19:31:35", "19.02.2025, 00:15:00"],
      duration: "02:04:47",
    },
    {
      date: "17.02.2025",
      startTimes: ["16:38:56"],
      endTimes: ["17:18:48"],
      duration: "00:39:52",
    },
    {
      date: "11.02.2025",
      startTimes: ["20:25:54"],
      endTimes: ["21:07:59"],
      duration: "00:42:05",
    },
    {
      date: "10.02.2025",
      startTimes: ["20:46:54"],
      endTimes: ["21:32:10"],
      duration: "00:45:16",
    },
    {
      date: "05.02.2025",
      startTimes: ["21:10:46"],
      endTimes: ["21:44:57"],
      duration: "00:34:11",
    },
    {
      date: "04.02.2025",
      startTimes: ["19:03:25"],
      endTimes: ["20:14:08"],
      duration: "01:10:42",
    },
    {
      date: "02.02.2025",
      startTimes: ["11:02:40", "21:56:39"],
      endTimes: ["12:08:26", "22:33:06"],
      duration: "01:42:13",
    },
    {
      date: "01.02.2025",
      startTimes: ["10:47:59", "23:30:15"],
      endTimes: ["11:24:15", "02.02.2025, 00:45:30"],
      duration: "01:51:31",
    },
    {
      date: "31.01.2025",
      startTimes: ["00:28:14", "22:15:00"],
      endTimes: ["01:10:39", "01.02.2025, 02:30:00"],
      duration: "05:27:25",
    },
    {
      date: "28.01.2025",
      startTimes: ["21:47:43"],
      endTimes: ["23:19:22"],
      duration: "01:31:39",
    },
  ];

  // Convert sample data to TimeRecord format
  return sampleData.map((entry) => {
    // Parse the date
    const [day, month, year] = entry.date.split(".");
    const baseDate = `${year}-${month}-${day}`;

    // Create entries array
    const entries: TimeEntry[] = [];

    // Process each pair of start and end times
    for (let i = 0; i < entry.startTimes.length; i++) {
      const startTime = entry.startTimes[i];
      const endTime = entry.endTimes[i];

      // Parse start time
      const startDate = parse(
        `${baseDate} ${startTime}`,
        "yyyy-MM-dd HH:mm:ss",
        new Date(),
      );
      entries.push({
        type: "clock-in",
        timestamp: startDate.getTime(),
      });

      // Parse end time - handle cross-day entries
      let endDate;
      if (endTime.includes(",")) {
        // Format is "DD.MM.YYYY, HH:MM:SS"
        const [endDateStr, endTimeStr] = endTime.split(", ");
        const [endDay, endMonth, endYear] = endDateStr.split(".");
        endDate = parse(
          `${endYear}-${endMonth}-${endDay} ${endTimeStr}`,
          "yyyy-MM-dd HH:mm:ss",
          new Date(),
        );
      } else {
        // Format is "HH:MM:SS"
        endDate = parse(
          `${baseDate} ${endTime}`,
          "yyyy-MM-dd HH:mm:ss",
          new Date(),
        );
      }

      entries.push({
        type: "clock-out",
        timestamp: endDate.getTime(),
      });
    }

    return {
      date: baseDate,
      entries,
    };
  });
};

// Process time records to create entry pairs, handling day boundary crossings correctly
export const processTimeRecords = (records: TimeRecord[]): DailyRecord[] => {
  const recordMap: Record<string, TimeEntryPair[]> = {};

  // First pass: organize all entries by date and pair them
  records.forEach((record) => {
    const entries = [...record.entries];
    entries.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < entries.length; i += 2) {
      const clockIn = entries[i];
      const clockOut = entries[i + 1] as TimeEntry | undefined;

      if (clockIn.type === "clock-in") {
        const clockInDate = new Date(clockIn.timestamp);
        const clockInDateStr = clockInDate.toISOString().split("T")[0]; // YYYY-MM-DD

        let duration = 0;
        let clockOutTime: number | null = null;
        let dayBoundary = false;

        if (clockOut && clockOut.type === "clock-out") {
          duration = clockOut.timestamp - clockIn.timestamp;
          clockOutTime = clockOut.timestamp;

          // Check if entry crosses midnight
          const clockOutDate = new Date(clockOut.timestamp);
          dayBoundary =
            clockOutDate.getDate() !== clockInDate.getDate() ||
            clockOutDate.getMonth() !== clockInDate.getMonth() ||
            clockOutDate.getFullYear() !== clockInDate.getFullYear();
        } else if (i === entries.length - 1) {
          // Still clocked in
          duration = new Date().getTime() - clockIn.timestamp;
        }

        const pair: TimeEntryPair = {
          clockIn: clockIn.timestamp,
          clockOut: clockOutTime,
          duration,
          dayBoundary,
        };

        // Create array for this date if it doesn't exist
        if ((recordMap[clockInDateStr] as unknown) === undefined) {
          recordMap[clockInDateStr] = [];
        }

        recordMap[clockInDateStr].push(pair);
      }
    }
  });

  // Second pass: create daily records with totals
  const processed: DailyRecord[] = Object.keys(recordMap).map((dateStr) => {
    const pairs = recordMap[dateStr];
    let totalTime = 0;

    pairs.forEach((pair) => {
      totalTime += pair.duration;
    });

    return {
      date: dateStr,
      entryPairs: pairs,
      totalTime,
      formattedTotal: formatDuration(totalTime),
    };
  });

  // Sort by date (newest first)
  return processed.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
};

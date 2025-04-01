import LoadingIcon from "~icons/svg-spinners/bouncing-ball";

import { Component, createSignal } from "solid-js";

import { Effect, Schedule, pipe } from "effect";

import { addClockEntry } from "../services/workClock";

/**
 * CreateRandomStampings component
 *
 * A utility component that generates random clock-in and clock-out entries for testing purposes.
 * It creates 100 randomized timestamps within the past 90 days using Effect.js for concurrent execution.
 * Each timestamp has a 50% chance of being a clock-in or clock-out entry.
 */
const CreateRandomStampings: Component = () => {
  const [createdCount, setCreatedCount] = createSignal(0);
  const [isGenerating, setIsGenerating] = createSignal<[boolean, number]>([
    false,
    0,
  ]);

  const generatingDone = (error: unknown = undefined) => {
    setIsGenerating([false, createdCount()]);

    if (error != null) {
      console.error("Error creating random stamping:", error);
    }
  };

  const createRandomStampings = () => {
    setIsGenerating([true, createdCount()]);
    const now = new Date().getTime();
    const delta = 1000 * 60 * 60 * 24 * 90; // Delta up to 90 days

    const createPipeline = pipe(
      Effect.sync(() => ({
        clockIn: Math.random() < 0.5,
        timestamp: new Date(now - Math.floor(Math.random() * delta)),
      })),
      Effect.flatMap(({ clockIn, timestamp }) =>
        addClockEntry(clockIn, timestamp),
      ),
      Effect.mapBoth({
        onSuccess: () => setCreatedCount((prev) => prev + 1),
        onFailure: generatingDone,
      }),
    );

    const repeatPolicy = Schedule.addDelay(
      Schedule.recurs(99),
      () => "10 millis",
    );

    Effect.runPromise(Effect.repeat(createPipeline, repeatPolicy))
      .then(generatingDone)
      .catch(generatingDone);
  };

  return (
    <div class="mt-4 flex flex-col items-center gap-2">
      <button
        onClick={createRandomStampings}
        class="btn btn-sm btn-secondary"
        disabled={isGenerating()[0]}
      >
        {isGenerating()[0] ?
          <>
            <LoadingIcon class="mr-2 h-4 w-4" /> Generating...
          </>
        : "Create 100 Random Stampings"}
      </button>
      <div class="badge badge-outline">
        {isGenerating()[0] ?
          `Generating: ${createdCount() - isGenerating()[1]}/100 ...`
        : createdCount() > 0 ?
          `Created: ${createdCount()} random stampings.`
        : "You can generate random stampings."}
      </div>
    </div>
  );
};

export default CreateRandomStampings;

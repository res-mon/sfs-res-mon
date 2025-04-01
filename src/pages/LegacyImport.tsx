import DatabaseIcon from "~icons/tabler/database";

import { Component, JSX } from "solid-js";

import LegacyImportPanel from "../components/LegacyImportPanel";
import { ObserverProvider } from "./Layout";

const LegacyImport: Component = (): JSX.Element => {
  return (
    <ObserverProvider>
      <div class="space-y-8">
        {/* Header Section */}
        <div class="text-center">
          <h1 class="intersect:motion-preset-slide-in-from-left intersect-once mb-4 text-4xl font-bold">
            <DatabaseIcon class="mr-2 inline-block" /> Legacy-Import
          </h1>
          <p class="intersect:motion-preset-slide-in-from-right intersect-once mx-auto max-w-3xl text-lg">
            Importieren Sie Ihre Zeiterfassungsdaten aus älteren Datenbanken in
            das neue System.
          </p>
        </div>

        {/* Legacy Import Section */}
        <LegacyImportPanel />
      </div>
    </ObserverProvider>
  );
};

export default LegacyImport;

import LoadingIcon from "~icons/svg-spinners/bouncing-ball";
import AlertIcon from "~icons/tabler/alert-circle";
import CheckIcon from "~icons/tabler/check";
import DatabaseIcon from "~icons/tabler/database";
// Import icons for the UI
import UploadIcon from "~icons/tabler/upload";
import CloseIcon from "~icons/tabler/x";

import { Component, JSX, Show, createSignal } from "solid-js";

import { Effect } from "effect";

import { uploadLegacyDatabase } from "../services/workClock";

// Types for reuse across components
type UploadResultType = {
  success: boolean;
  message: string;
} | null;

/**
 * FileInputSection component
 * Displays the file input field for selecting database files
 */
const FileInputSection: Component<{
  isUploading: boolean;
  onFileChange: (event: Event) => void;
}> = (props) => {
  return (
    <div class="form-control mt-4">
      <label class="label">
        <span class="label-text">Datenbank-Datei auswählen (.db)</span>
      </label>
      <input
        type="file"
        id="legacyDatabaseInput"
        class="file-input file-input-bordered w-full"
        accept=".db"
        onChange={(e) => props.onFileChange(e)}
        disabled={props.isUploading}
      />
      <label class="label">
        <span class="label-text-alt">
          Nur SQLite-Datenbankdateien werden unterstützt
        </span>
      </label>
    </div>
  );
};

/**
 * FileDetailsSection component
 * Displays information about the selected file
 */
const FileDetailsSection: Component<{
  file: File;
}> = (props) => {
  return (
    <div class="bg-base-300 mt-2 rounded-lg p-3">
      <p class="text-sm font-medium">Ausgewählte Datei:</p>
      <p class="text-base-content/80 flex items-center gap-2">
        <DatabaseIcon class="h-4 w-4" />
        {props.file.name} ({(props.file.size / 1024 / 1024).toFixed(2)} MB)
      </p>
    </div>
  );
};

/**
 * UploadResultSection component
 * Displays success or error message after upload attempt
 */
const UploadResultSection: Component<{
  result: UploadResultType;
  onReset: () => void;
}> = (props) => {
  return (
    <Show when={props.result}>
      <div
        class={`mt-3 rounded-lg p-4 ${props.result && props.result.success ? "bg-success/20" : "bg-error/20"}`}
      >
        <div class="flex items-start gap-3">
          <div
            class={`rounded-full p-1 ${props.result && props.result.success ? "bg-success/30" : "bg-error/30"}`}
          >
            <Show
              when={props.result && props.result.success}
              fallback={<AlertIcon class="text-error h-5 w-5" />}
            >
              <CheckIcon class="text-success h-5 w-5" />
            </Show>
          </div>
          <div class="flex-1">
            <p class="font-medium">
              {props.result && props.result.success ? "Erfolg" : "Fehler"}
            </p>
            <p class="text-base-content/80 text-sm">{props.result?.message}</p>
          </div>
          <button
            onClick={() => props.onReset()}
            class="btn btn-circle btn-ghost btn-xs"
          >
            <CloseIcon class="h-4 w-4" />
          </button>
        </div>
      </div>
    </Show>
  );
};

/**
 * ActionButtons component
 * Displays the action buttons (cancel and upload)
 */
const ActionButtons: Component<{
  isUploading: boolean;
  hasSelectedFile: boolean;
  hasUploadResult: boolean;
  onUpload: () => void;
  onReset: () => void;
}> = (props) => {
  return (
    <div class="card-actions mt-4 justify-end">
      <button
        class="btn btn-ghost"
        onClick={() => props.onReset()}
        disabled={
          props.isUploading ||
          (!props.hasSelectedFile && !props.hasUploadResult)
        }
      >
        <CloseIcon class="mr-1" /> Abbrechen
      </button>
      <button
        class="btn btn-primary"
        onClick={() => props.onUpload()}
        disabled={props.isUploading || !props.hasSelectedFile}
      >
        <Show
          when={props.isUploading}
          fallback={
            <>
              <UploadIcon class="mr-2" /> Datenbank hochladen
            </>
          }
        >
          <>
            <LoadingIcon class="mr-2 h-5 w-5" /> Wird hochgeladen...
          </>
        </Show>
      </button>
    </div>
  );
};

/**
 * useFileUpload hook
 * Manages file selection, upload process and state
 */
const useFileUpload = () => {
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadResult, setUploadResult] = createSignal<UploadResultType>(null);

  // Handle file selection
  const handleFileChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      // Validate file type
      if (file.name.endsWith(".db")) {
        setSelectedFile(file);
        // Clear previous upload results when a new file is selected
        setUploadResult(null);
      } else {
        setSelectedFile(null);
        setUploadResult({
          success: false,
          message:
            "Bitte wählen Sie eine gültige SQLite-Datenbankdatei aus (.db-Erweiterung)",
        });
      }
    }
  };

  // Handle the upload process
  const handleUpload = () => {
    const file = selectedFile();
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    // Use the Effect-based uploadLegacyDatabase function
    Effect.runPromise(uploadLegacyDatabase(file))
      .then((response) => {
        setUploadResult({
          success: response.success,
          message: response.message,
        });
        // Clear the file input after a successful upload
        if (response.success) {
          setSelectedFile(null);
          resetFileInput();
        }
      })
      .catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ?
            error.message
          : "Fehler beim Hochladen der Datenbankdatei";

        setUploadResult({
          success: false,
          message: errorMessage,
        });
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  // Reset file input element
  const resetFileInput = () => {
    const fileInput = document.getElementById(
      "legacyDatabaseInput",
    ) as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Reset the component state
  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    resetFileInput();
  };

  return {
    selectedFile,
    isUploading,
    uploadResult,
    handleFileChange,
    handleUpload,
    resetUpload,
  };
};

/**
 * LegacyImportPanel component
 *
 * A UI component for uploading legacy database files to import time entry records.
 * It provides a file input for selecting .db files, displays upload status and progress,
 * and shows success or error messages from the server response.
 *
 * @returns {JSX.Element} A styled UI component for database imports
 */
const LegacyImportPanel: Component = (): JSX.Element => {
  const {
    selectedFile,
    isUploading,
    uploadResult,
    handleFileChange,
    handleUpload,
    resetUpload,
  } = useFileUpload();

  return (
    <div class="card bg-base-200 intersect:motion-preset-fade-in intersect-once mx-auto max-w-lg shadow-xl">
      <div class="card-body">
        <h2 class="card-title">
          <DatabaseIcon class="mr-2" /> Legacy-Datenbank-Import
        </h2>
        <p class="text-base-content/70 text-sm">
          Laden Sie eine Legacy-SQLite-Datenbankdatei hoch, um historische
          Zeitaufzeichnungen zu importieren. Das System extrahiert und
          importiert alle Aktivitätsprotokolle in Ihren aktuellen
          Arbeitsbereich.
        </p>

        <FileInputSection
          isUploading={isUploading()}
          onFileChange={handleFileChange}
        />

        <Show when={selectedFile()}>
          <FileDetailsSection file={selectedFile()!} />
        </Show>

        <Show when={uploadResult()}>
          <UploadResultSection
            result={uploadResult()}
            onReset={resetUpload}
          />
        </Show>

        <ActionButtons
          isUploading={isUploading()}
          hasSelectedFile={!!selectedFile()}
          hasUploadResult={!!uploadResult()}
          onUpload={handleUpload}
          onReset={resetUpload}
        />
      </div>
    </div>
  );
};

export default LegacyImportPanel;

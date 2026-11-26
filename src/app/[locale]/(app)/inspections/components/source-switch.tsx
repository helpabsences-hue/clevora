"use client";

import { CameraIcon, CheckIcon, UploadIcon, VideoIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type Source = "camera" | "files";

/** Phones and tablets start on the camera; computers start on "import files". */
export function useDefaultSource(): [Source, (s: Source) => void] {
  const [source, setSource] = useState<Source>("files");
  useEffect(() => {
    // Known only in the browser (touch screen or not).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device detection after mount
    if (window.matchMedia?.("(pointer: coarse)").matches) setSource("camera");
  }, []);
  return [source, setSource];
}

/**
 * Two big choices: take it now with the camera, or upload files already on the
 * phone / computer.
 */
export function SourceSwitch({
  value,
  onChange,
  label,
  camera,
  cameraHint,
  files,
  filesHint,
  video,
  disabled,
}: {
  value: Source;
  onChange: (s: Source) => void;
  label: string;
  camera: string;
  cameraHint: string;
  files: string;
  filesHint: string;
  video?: boolean;
  disabled?: boolean;
}) {
  const CamIcon = video ? VideoIcon : CameraIcon;
  const option = (v: Source, Icon: typeof CameraIcon, title: string, hint: string) => {
    const selected = value === v;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={disabled}
        onClick={() => onChange(v)}
        data-testid={`source-${v}`}
        className={cn(
          "relative flex min-h-16 items-center gap-3 rounded-xl border-2 p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
          selected ? "border-primary bg-primary/10 dark:border-ring dark:bg-ring/15" : "border-border bg-card text-muted-foreground hover:bg-accent",
        )}
      >
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("font-semibold", selected && "text-foreground")}>{title}</span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </span>
        {selected ? <CheckIcon className="size-5 shrink-0 text-primary dark:text-ring" aria-hidden /> : null}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {option("camera", CamIcon, camera, cameraHint)}
      {option("files", UploadIcon, files, filesHint)}
    </div>
  );
}

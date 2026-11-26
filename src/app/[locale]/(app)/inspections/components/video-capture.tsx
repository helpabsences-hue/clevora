"use client";

import { CircleStopIcon, FolderOpenIcon, LoaderIcon, VideoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Ltr } from "@/components/app/ltr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/browser";
import { saveVideoAction } from "../actions";
import { SourceSwitch, useDefaultSource } from "./source-switch";

/** Storage keeps files under 10 MB: about 75 s at 1 Mbit/s. */
export const VIDEO_MAX_BYTES = 10 * 1024 * 1024;
const MAX_SECONDS = 75;
/** Gallery videos longer than this are refused (the compressed file would be too blurry). */
const MAX_IMPORT_SECONDS = 180;
const BITRATE = 1_000_000;

function pickType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * A video from the gallery that is too heavy (phone cameras film at 10–20 Mbit/s):
 * replay it on a hidden canvas and record it again, smaller (takes the video's length).
 */
async function compressVideo(file: Blob, onProgress: (ratio: number) => void): Promise<Blob> {
  const mimeType = pickType();
  if (!mimeType) throw new Error("unsupported");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("unreadable"));
    });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration > MAX_IMPORT_SECONDS) throw new Error("tooLong");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d")!;
    // Fit under the limit whatever the length (with a 10 % margin).
    const bitrate = Math.min(BITRATE, Math.floor((VIDEO_MAX_BYTES * 8 * 0.9) / duration));
    const rec = new MediaRecorder(canvas.captureStream(24), { mimeType, videoBitsPerSecond: bitrate });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    let frame = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(1, video.currentTime / duration));
      if (!video.ended) frame = requestAnimationFrame(draw);
    };
    video.onended = () => {
      cancelAnimationFrame(frame);
      rec.stop();
    };
    rec.start(1000);
    await video.play();
    draw();
    await stopped;
    return new Blob(chunks, { type: mimeType });
  } finally {
    URL.revokeObjectURL(url);
  }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Inspection in video mode: one walk-around video of the car. Two ways:
 * film now (in the app, small file) or import a video from the phone / computer
 * (made smaller on the device when it is over 10 MB).
 */
export function VideoCapture({ agencyId, inspectionId, videoUrl, done }: { agencyId: string; inspectionId: string; videoUrl: string | null; done: boolean }) {
  const t = useTranslations("inspection.video");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const nativeCamera = useRef<HTMLInputElement>(null);
  const [source, setSource] = useDefaultSource();
  const [shrinking, setShrinking] = useState<number | null>(null);

  useEffect(() => {
    // Known only in the browser: hide "Filmer" where the camera cannot be used.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection after mount
    setCanRecord(Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(pickType()));
  }, []);

  const stopCamera = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  };
  useEffect(() => stopCamera, []);

  /** A video file (gallery, computer or the phone's camera app): made smaller first if needed. */
  const uploadFile = async (f: File) => {
    if (!f.type.startsWith("video/")) return void toast.error(t("notVideo"));
    if (f.size <= VIDEO_MAX_BYTES) return upload(f);
    setShrinking(0);
    try {
      const small = await compressVideo(f, setShrinking);
      setShrinking(null);
      await upload(small);
    } catch (e) {
      setShrinking(null);
      toast.error(e instanceof Error && e.message === "tooLong" ? t("tooLong", { min: MAX_IMPORT_SECONDS / 60 }) : t("tooBig"));
    } finally {
      if (file.current) file.current.value = "";
      if (nativeCamera.current) nativeCamera.current.value = "";
    }
  };

  const upload = async (blob: Blob) => {
    if (blob.size > VIDEO_MAX_BYTES) return void toast.error(t("tooBig"));
    setUploading(true);
    try {
      const path = `${agencyId}/inspections/${inspectionId}/video`;
      const { error } = await createClient()
        .storage.from("agency-docs")
        .upload(path, blob, { contentType: (blob.type || "video/mp4").split(";")[0], upsert: true });
      if (error) throw error;
      const r = await saveVideoAction(inspectionId, path);
      if (!r.ok) throw new Error(r.error);
      toast.success(t("saved"));
      router.refresh();
    } catch {
      toast.error(t("failed"));
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  };

  const openCamera = async () => {
    setOpen(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (preview.current) preview.current.srcObject = stream.current;
    } catch {
      setOpen(false);
      toast.error(t("noCamera"));
    }
  };

  const startRecording = () => {
    if (!stream.current) return;
    const mimeType = pickType();
    const rec = new MediaRecorder(stream.current, { mimeType, videoBitsPerSecond: BITRATE });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stopCamera();
      setRecording(false);
      setOpen(false);
      void upload(new Blob(chunks, { type: mimeType }));
    };
    rec.start(1000);
    recorder.current = rec;
    setSeconds(0);
    setRecording(true);
  };

  // Timer, and automatic stop at the size limit.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);
  useEffect(() => {
    if (seconds >= MAX_SECONDS && recorder.current?.state === "recording") recorder.current.stop();
  }, [seconds]);

  const close = (o: boolean) => {
    if (o) return;
    if (recorder.current?.state === "recording") recorder.current.stop();
    else {
      stopCamera();
      setOpen(false);
    }
  };

  return (
    <Card data-testid="inspection-video">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VideoIcon className="size-5 text-muted-foreground" aria-hidden />
          {t("title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {videoUrl ? (
          <video src={videoUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-xl border bg-black" data-testid="inspection-video-player">
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            {uploading ? <LoaderIcon className="size-6 animate-spin" aria-hidden /> : <VideoIcon className="size-6" aria-hidden />}
            {uploading ? t("uploading") : t("empty")}
          </div>
        )}
        {uploading && videoUrl ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderIcon className="size-4 animate-spin" aria-hidden />
            {t("uploading")}
          </p>
        ) : null}
        {shrinking !== null ? (
          <div className="flex flex-col gap-1" role="status" data-testid="video-shrinking">
            <span className="flex items-center gap-2 text-sm font-medium">
              <LoaderIcon className="size-4 animate-spin" aria-hidden />
              {t("shrinking", { pct: Math.round(shrinking * 100) })}
            </span>
            <span className="h-2 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-primary transition-[width]" style={{ width: `${Math.round(shrinking * 100)}%` }} />
            </span>
          </div>
        ) : null}
        {!done ? (
          <>
            <SourceSwitch
              video
              value={source}
              onChange={setSource}
              disabled={uploading || shrinking !== null}
              label={t("sourceLabel")}
              camera={t("sourceCamera")}
              cameraHint={t("sourceCameraHint")}
              files={t("sourceFiles")}
              filesHint={t("sourceFilesHint")}
            />
            {source === "camera" ? (
              <Button
                size="lg"
                onClick={() => (canRecord ? openCamera() : nativeCamera.current?.click())}
                disabled={uploading || shrinking !== null}
                data-testid="video-record"
              >
                <VideoIcon aria-hidden />
                {videoUrl ? t("again") : t("record")}
              </Button>
            ) : (
              <Button size="lg" onClick={() => file.current?.click()} disabled={uploading || shrinking !== null} data-testid="video-pick">
                <FolderOpenIcon aria-hidden />
                {videoUrl ? t("pickAgain") : t("pick")}
              </Button>
            )}
            {/* gallery / computer, and the phone's own camera app when the browser cannot film */}
            <input ref={file} type="file" accept="video/*" className="sr-only" tabIndex={-1} aria-hidden data-testid="inspection-video-file" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <input ref={nativeCamera} type="file" accept="video/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          </>
        ) : null}
        {!done ? <p className="text-xs text-muted-foreground">{source === "camera" ? t("limit", { s: MAX_SECONDS }) : t("limitFiles", { min: MAX_IMPORT_SECONDS / 60 })}</p> : null}
      </CardContent>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent closeLabel={tc("close")} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("record")}</DialogTitle>
            <DialogDescription>{t("howTo")}</DialogDescription>
          </DialogHeader>
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={preview} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            {recording ? (
              <span className="absolute start-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-sm font-semibold text-white">
                <span className="size-2.5 animate-pulse rounded-full bg-red-500" aria-hidden />
                <Ltr>{clock(seconds)} / {clock(MAX_SECONDS)}</Ltr>
              </span>
            ) : null}
          </div>
          {recording ? (
            <Button size="lg" variant="destructive" onClick={() => recorder.current?.stop()}>
              <CircleStopIcon aria-hidden />
              {t("stop")}
            </Button>
          ) : (
            <Button size="lg" onClick={startRecording}>
              <VideoIcon aria-hidden />
              {t("start")}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

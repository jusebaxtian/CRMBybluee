"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Send, Paperclip, Mic, Square, X, Check, Play, Pause, RotateCcw } from "lucide-react";
import { sendMessage, sendChatMedia } from "@/app/actions/whatsapp";
import type { OptimisticMessage } from "@/components/chat-pane";
import { QuickReplyPicker } from "@/components/quick-reply-picker";
import { AutomationPicker } from "@/components/automation-picker";
import { mediaKindFromMime, validateMediaSize } from "@/lib/whatsapp/media-limits";

type RecordingStatus = "idle" | "recording" | "reviewing";

// Exposed so ChatPane can hand it a dropped file directly — drag-and-drop
// is handled at the pane level (so dropping anywhere over the messages
// works, not just over the composer bar itself), but the upload
// queue/validation logic all lives here already.
export type MessageComposerHandle = {
  enqueueUpload: (file: File) => void;
};

export const MessageComposer = forwardRef<MessageComposerHandle, {
  conversationId: string;
  contactId: string;
  quickReplies?: { id: string; name: string }[];
  automations?: { id: string; name: string }[];
  onOptimisticSend?: (message: OptimisticMessage) => void;
}>(function MessageComposer({
  conversationId,
  contactId,
  quickReplies = [],
  automations = [],
  onOptimisticSend,
}, ref) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [recStatus, setRecStatus] = useState<RecordingStatus>("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingMimeTypeRef = useRef<string>("audio/webm");
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  // Typing "hola" [enter] "cómo estás" [enter] shouldn't have to wait for the
  // first message's round trip to Meta before the second can be typed and
  // sent — queue each submit and drain it in the background, one at a time
  // (order matters for a conversation), instead of blocking the input/button
  // on the in-flight request.
  const queueRef = useRef<string[]>([]);
  const draining = useRef(false);

  function drainQueue() {
    if (draining.current) return;
    draining.current = true;
    (async () => {
      while (queueRef.current.length > 0) {
        const body = queueRef.current.shift()!;
        const result = await sendMessage({ conversationId, body });
        if (result && "error" in result) {
          setSendError(result.error ?? "No se pudo enviar el mensaje.");
        }
      }
      draining.current = false;
    })();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = String(formData.get("body") ?? "").trim();
    if (!body) return;

    // Show the message immediately (WhatsApp-style) instead of waiting on
    // the round trip to Meta's Graph API before anything appears.
    formRef.current?.reset();
    setSendError(null);
    onOptimisticSend?.({
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      direction: "out",
      body,
      status: "sending",
      message_type: "text",
      media_url: null,
      media_mime_type: null,
      created_at: new Date().toISOString(),
    });

    queueRef.current.push(body);
    drainQueue();
  }

  // Same idea as the text queue: recording and sending a second voice note
  // shouldn't have to wait for the first one's upload + Meta round trip
  // (transcoding included) to finish — enqueue and drain in the background
  // instead of disabling the mic/composer while an upload is in flight.
  const fileQueueRef = useRef<File[]>([]);
  const fileDraining = useRef(false);

  function drainFileQueue() {
    if (fileDraining.current) return;
    fileDraining.current = true;
    (async () => {
      while (fileQueueRef.current.length > 0) {
        setUploading(true);
        const file = fileQueueRef.current.shift()!;
        const formData = new FormData();
        formData.set("conversationId", conversationId);
        formData.set("file", file);
        const result = await sendChatMedia(formData);
        if (result?.error) setUploadError(result.error);
        // RealtimeRefresh picks up each sent message row automatically.
      }
      setUploading(false);
      fileDraining.current = false;
    })();
  }

  function enqueueUpload(file: File) {
    setUploadError(null);
    // Catch an oversized file before even uploading it — WhatsApp's real
    // limits (16MB video/audio, 5MB image, 100MB document); otherwise the
    // upload "succeeds" and only fails later when actually sending. Video
    // is exempt — it gets compressed server-side first, so its real final
    // size is only known (and checked) after that happens.
    const kind = mediaKindFromMime(file.type);
    if (kind !== "video") {
      const sizeError = validateMediaSize(kind, file.size);
      if (sizeError) {
        setUploadError(sizeError);
        return;
      }
    }
    fileQueueRef.current.push(file);
    drainFileQueue();
  }

  useImperativeHandle(ref, () => ({ enqueueUpload }));

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) enqueueUpload(file);
    e.target.value = "";
  }

  // Ctrl/Cmd+V with an image on the clipboard (a screenshot, a copied image
  // from another app) attaches it like a picked file — text pastes are left
  // completely alone so normal typing/pasting still works.
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          enqueueUpload(file);
        }
        return;
      }
    }
  }

  async function startRecording() {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Different browsers support different container/codec combos for
      // MediaRecorder (Chrome/Edge: webm/opus, Safari: often mp4/aac) — using
      // whatever the browser actually records instead of hardcoding "webm"
      // is what makes the local preview player able to decode it.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
      ];
      const mimeType =
        candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      recordingMimeTypeRef.current = mimeType || "audio/webm";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordedBlobRef.current = null;
      setRecStatus("recording");
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setUploadError("No se pudo acceder al micrófono.");
    }
  }

  // Stops capture without sending yet — moves to a review step (tap the
  // circle again) so the send/cancel controls sit in the center of the
  // screen instead of the composer bar, which on iPhone gets covered by the
  // Safari/WhatsApp-webview bottom chrome right when you need to tap them.
  function stopCapture(): Promise<Blob> {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve(new Blob());
        return;
      }
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(audioChunksRef.current, { type: recordingMimeTypeRef.current }));
      };
      recorder.stop();
    });
  }

  async function handleCirclePress() {
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = await stopCapture();
    recordedBlobRef.current = blob;
    setPreviewUrl(blob.size > 0 ? URL.createObjectURL(blob) : null);
    setRecStatus("reviewing");
  }

  function discardPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewPlaying(false);
  }

  async function cancelRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recStatus === "recording") {
      await stopCapture();
    }
    recordedBlobRef.current = null;
    discardPreview();
    setRecStatus("idle");
    setRecordSeconds(0);
  }

  async function togglePreviewPlayback() {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPreviewPlaying(true);
      } catch {
        setUploadError("No se pudo reproducir el audio. Intenta de nuevo.");
      }
    } else {
      audio.pause();
      setPreviewPlaying(false);
    }
  }

  function reRecord() {
    discardPreview();
    setRecStatus("idle");
    setRecordSeconds(0);
    startRecording();
  }

  function sendRecording() {
    const blob = recordedBlobRef.current;
    setRecStatus("idle");
    setRecordSeconds(0);
    discardPreview();
    if (blob && blob.size > 0) {
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("mpeg") ? "mp3" : "webm";
      enqueueUpload(new File([blob], `nota-de-voz-${Date.now()}.${ext}`, { type: blob.type }));
    }
  }

  const mm = String(Math.floor(recordSeconds / 60)).padStart(2, "0");
  const ss = String(recordSeconds % 60).padStart(2, "0");

  return (
    <div className="w-full min-w-0 border-t border-border bg-surface p-2 sm:p-4">
      {recStatus !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={cancelRecording}
            aria-label="Cancelar"
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-surface-hover text-foreground"
            style={{ top: "max(1.25rem, env(safe-area-inset-top))" }}
          >
            <X size={20} />
          </button>

          <p className="mb-8 text-2xl font-medium tabular-nums text-foreground">
            {mm}:{ss}
          </p>

          {recStatus === "recording" ? (
            <button
              type="button"
              onClick={handleCirclePress}
              aria-label="Detener grabación"
              className="relative flex h-24 w-24 items-center justify-center rounded-full bg-red-500 text-white shadow-lg"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/50" />
              <Square size={30} fill="white" className="relative" />
            </button>
          ) : (
            <div className="flex flex-col items-center gap-6">
              {previewUrl && (
                <audio
                  ref={previewAudioRef}
                  src={previewUrl}
                  preload="auto"
                  playsInline
                  onEnded={() => setPreviewPlaying(false)}
                  onPause={() => setPreviewPlaying(false)}
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
                />
              )}
              <button
                type="button"
                onClick={togglePreviewPlayback}
                disabled={!previewUrl}
                aria-label={previewPlaying ? "Pausar" : "Escuchar nota de voz"}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-hover text-foreground disabled:opacity-50"
              >
                {previewPlaying ? <Pause size={30} /> : <Play size={30} className="ml-1" />}
              </button>
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={reRecord}
                  aria-label="Grabar de nuevo"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-border text-muted hover:text-foreground"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  type="button"
                  onClick={sendRecording}
                  aria-label="Enviar nota de voz"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover"
                >
                  <Check size={28} />
                </button>
              </div>
            </div>
          )}

          <p className="mt-8 text-sm text-muted">
            {recStatus === "recording"
              ? "Toca para detener"
              : previewPlaying
                ? "Reproduciendo..."
                : "Escucha, vuelve a grabar o envía"}
          </p>
        </div>
      )}

      {/* Floating cluster — a vertical stack pinned to the left edge, clear
          of the message bubbles and the input row instead of overlapping
          either. */}
      <div className="absolute left-3 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-border bg-surface p-1.5 shadow-lg">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
          onChange={handleFilePicked}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground"
          title="Adjuntar archivo"
        >
          <Paperclip size={18} />
        </button>
        <QuickReplyPicker contactId={contactId} quickReplies={quickReplies} />
        <AutomationPicker contactId={contactId} automations={automations} />
        <button
          type="button"
          onClick={startRecording}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground"
          title="Grabar nota de voz"
        >
          <Mic size={18} />
        </button>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2"
      >
        <input
          name="body"
          type="text"
          placeholder="Escribe un mensaje..."
          autoComplete="off"
          required
          onPaste={handlePaste}
          // 16px min font size on mobile — anything smaller makes iOS/Android
          // auto-zoom the page on focus, which pushes the send button off-screen.
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-base text-foreground outline-none focus:border-primary sm:h-10 sm:px-3 sm:text-sm"
        />
        <button
          type="submit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white sm:h-10 sm:w-10"
          title="Enviar"
        >
          <Send size={16} />
        </button>
      </form>
      {uploading && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Enviando adjunto en segundo plano...
        </p>
      )}
      {sendError && <p className="mt-2 text-xs text-red-400">{sendError}</p>}
      {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
    </div>
  );
});

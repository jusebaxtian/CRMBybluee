"use client";

import { useRef, useState } from "react";
import { Send, Paperclip, Mic, Square, X, Check } from "lucide-react";
import { sendMessage, sendChatMedia } from "@/app/actions/whatsapp";
import type { OptimisticMessage } from "@/components/chat-pane";

type RecordingStatus = "idle" | "recording" | "reviewing";

export function MessageComposer({
  conversationId,
  onOptimisticSend,
}: {
  conversationId: string;
  onOptimisticSend?: (message: OptimisticMessage) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const [recStatus, setRecStatus] = useState<RecordingStatus>("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("file", file);
    const result = await sendChatMedia(formData);
    setUploading(false);
    if (result?.error) {
      setUploadError(result.error);
      return;
    }
    // RealtimeRefresh picks up the new message row automatically.
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function startRecording() {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
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
        resolve(new Blob(audioChunksRef.current, { type: "audio/webm" }));
      };
      recorder.stop();
    });
  }

  async function handleCirclePress() {
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = await stopCapture();
    recordedBlobRef.current = blob;
    setRecStatus("reviewing");
  }

  async function cancelRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recStatus === "recording") {
      await stopCapture();
    }
    recordedBlobRef.current = null;
    setRecStatus("idle");
    setRecordSeconds(0);
  }

  function sendRecording() {
    const blob = recordedBlobRef.current;
    setRecStatus("idle");
    setRecordSeconds(0);
    if (blob && blob.size > 0) {
      uploadFile(new File([blob], `nota-de-voz-${Date.now()}.webm`, { type: "audio/webm" }));
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
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-hover">
                <Mic size={30} className="text-muted" />
              </div>
              <button
                type="button"
                onClick={sendRecording}
                aria-label="Enviar nota de voz"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary-hover"
              >
                <Check size={28} />
              </button>
            </div>
          )}

          <p className="mt-8 text-sm text-muted">
            {recStatus === "recording" ? "Toca para detener" : "Toca para enviar"}
          </p>
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex w-full min-w-0 items-center gap-1.5 sm:gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFilePicked}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-50 sm:h-10 sm:w-10"
          title="Adjuntar archivo"
        >
          <Paperclip size={18} />
        </button>
        <input
          name="body"
          type="text"
          placeholder={uploading ? "Enviando adjunto..." : "Escribe un mensaje..."}
          autoComplete="off"
          disabled={uploading}
          required
          // 16px min font size on mobile — anything smaller makes iOS/Android
          // auto-zoom the page on focus, which pushes the send button off-screen.
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-base text-foreground outline-none focus:border-primary disabled:opacity-50 sm:h-10 sm:px-3 sm:text-sm"
        />
        <button
          type="button"
          onClick={startRecording}
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-50 sm:h-10 sm:w-10"
          title="Grabar nota de voz"
        >
          <Mic size={18} />
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-50 sm:h-10 sm:w-10"
          title="Enviar"
        >
          <Send size={16} />
        </button>
      </form>
      {sendError && <p className="mt-2 text-xs text-red-400">{sendError}</p>}
      {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
    </div>
  );
}

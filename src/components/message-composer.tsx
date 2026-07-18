"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, Mic, Square, X } from "lucide-react";
import { sendMessage, sendChatMedia } from "@/app/actions/whatsapp";

type State = Awaited<ReturnType<typeof sendMessage>> | undefined;

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const body = String(formData.get("body") ?? "").trim();
      if (!body) return undefined;
      const result = await sendMessage({ conversationId, body });
      if (!("error" in result)) {
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    undefined
  );

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
    router.refresh();
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
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          uploadFile(new File([blob], `nota-de-voz-${Date.now()}.webm`, { type: "audio/webm" }));
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setUploadError("No se pudo acceder al micrófono.");
    }
  }

  function stopRecording(discard = false) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    if (discard && mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      };
    }
    mediaRecorderRef.current?.stop();
  }

  const mm = String(Math.floor(recordSeconds / 60)).padStart(2, "0");
  const ss = String(recordSeconds % 60).padStart(2, "0");

  return (
    <div className="border-t border-border bg-surface p-3 sm:p-4">
      {recording ? (
        <div className="flex items-center gap-3 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2.5">
          <span className="flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-400" />
          <span className="flex-1 text-sm text-foreground">Grabando... {mm}:{ss}</span>
          <button
            type="button"
            onClick={() => stopRecording(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-hover"
            title="Cancelar"
          >
            <X size={16} />
          </button>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"
            title="Enviar nota de voz"
          >
            <Square size={14} />
          </button>
        </div>
      ) : (
        <form ref={formRef} action={action} className="flex items-center gap-2">
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
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
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
            title="Grabar nota de voz"
          >
            <Mic size={18} />
          </button>
          <button
            type="submit"
            disabled={pending || uploading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-50"
            title="Enviar"
          >
            <Send size={16} />
          </button>
        </form>
      )}
      {state && "error" in state && (
        <p className="mt-2 text-xs text-red-400">{state.error}</p>
      )}
      {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
    </div>
  );
}

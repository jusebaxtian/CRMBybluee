"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Send, Paperclip, Mic, Square, X, Check, Play, Pause, RotateCcw, Reply, AlertCircle, ArrowLeftRight, FileText } from "lucide-react";
import { sendMessage, sendChatMedia } from "@/app/actions/whatsapp";
import type { OptimisticMessage } from "@/components/inbox/chat-pane";
import { QuickReplyPicker } from "@/components/quick-replies/quick-reply-picker";
import { AutomationPicker } from "@/components/automations/automation-picker";
import { RecordatorioPicker } from "@/components/inbox/recordatorio-picker";
import { CitaPicker } from "@/components/inbox/cita-picker";
import { ResetAutomationsButton } from "@/components/automations/reset-automations-button";
import { mediaKindFromMime, validateMediaSize } from "@/lib/whatsapp/media-limits";
import { LARGO_MAXIMO_DEL_TEXTO, extensionDe, pesoLegible, revisarAdjunto } from "@/lib/whatsapp/revisar-adjunto";
import { formatoDeReloj, nivelDeMuestra, resumirNiveles, ultimasBarras } from "@/lib/inbox/nota-de-voz";

type RecordingStatus = "idle" | "recording" | "reviewing";

// Exposed so ChatPane can hand it a dropped file directly — drag-and-drop
// is handled at the pane level (so dropping anywhere over the messages
// works, not just over the composer bar itself), but the upload
// queue/validation logic all lives here already.
export type MessageComposerHandle = {
  /** Un archivo (soltado o pegado): se muestra en la vista previa y se envia al confirmar. */
  attachFile: (file: File) => void;
};

export const MessageComposer = forwardRef<MessageComposerHandle, {
  conversationId: string;
  contactId: string;
  contactName?: string;
  quickReplies?: { id: string; name: string }[];
  automations?: { id: string; name: string }[];
  replyingTo?: { waMessageId: string; preview: string } | null;
  onClearReply?: () => void;
  onOptimisticSend?: (message: OptimisticMessage) => void;
}>(function MessageComposer({
  conversationId,
  contactId,
  contactName = "",
  quickReplies = [],
  automations = [],
  replyingTo,
  onClearReply,
  onOptimisticSend,
}, ref) {
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
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
  // Segundo actual de la nota mientras se escucha en la revision.
  const [previewTime, setPreviewTime] = useState(0);
  // Nivel del microfono (0 a 1, diez veces por segundo) para dibujar la onda.
  // Es una referencia y no estado: se actualiza 10 veces por segundo y no debe
  // repintar toda la caja de escribir cada vez.
  const nivelesRef = useRef<number[]>([]);
  const medicionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Resumen de lo grabado (la onda fija de la revision).
  const [resumen, setResumen] = useState<number[]>([]);

  // Typing "hola" [enter] "cómo estás" [enter] shouldn't have to wait for the
  // first message's round trip to Meta before the second can be typed and
  // sent — queue each submit and drain it in the background, one at a time
  // (order matters for a conversation), instead of blocking the input/button
  // on the in-flight request.
  const queueRef = useRef<{ body: string; replyToWaMessageId?: string }[]>([]);
  const draining = useRef(false);

  function drainQueue() {
    if (draining.current) return;
    draining.current = true;
    (async () => {
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!;
        const result = await sendMessage({ conversationId, ...item });
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

    const replyToWaMessageId = replyingTo?.waMessageId;

    // Show the message immediately (WhatsApp-style) instead of waiting on
    // the round trip to Meta's Graph API before anything appears.
    formRef.current?.reset();
    resetBodyHeight();
    setSendError(null);
    onClearReply?.();
    onOptimisticSend?.({
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      direction: "out",
      body,
      status: "sending",
      message_type: "text",
      media_url: null,
      media_mime_type: null,
      context_wa_message_id: replyToWaMessageId ?? null,
      created_at: new Date().toISOString(),
    });

    queueRef.current.push({ body, replyToWaMessageId });
    drainQueue();
  }

  // Same idea as the text queue: recording and sending a second voice note
  // shouldn't have to wait for the first one's upload + Meta round trip
  // (transcoding included) to finish — enqueue and drain in the background
  // instead of disabling the mic/composer while an upload is in flight.
  const fileQueueRef = useRef<{ file: File; texto: string }[]>([]);
  const fileDraining = useRef(false);

  function drainFileQueue() {
    if (fileDraining.current) return;
    fileDraining.current = true;
    (async () => {
      while (fileQueueRef.current.length > 0) {
        setUploading(true);
        const { file, texto } = fileQueueRef.current.shift()!;
        const formData = new FormData();
        formData.set("conversationId", conversationId);
        formData.set("file", file);
        if (texto) formData.set("caption", texto);
        const result = await sendChatMedia(formData);
        if (result?.error) setUploadError(result.error);
        // RealtimeRefresh picks up each sent message row automatically.
      }
      setUploading(false);
      fileDraining.current = false;
    })();
  }

  // Sube y envia YA, sin vista previa. Es lo que usan las notas de voz; los
  // archivos que elige la persona pasan antes por proponerAdjunto.
  function enqueueUpload(file: File, texto = "") {
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
    fileQueueRef.current.push({ file, texto });
    drainFileQueue();
  }

  // Archivos por revisar antes de enviarlos (el primero es el que se ve en la
  // hoja; si se sueltan varios, se revisan uno por uno).
  const [pendientes, setPendientes] = useState<File[]>([]);
  const [textoDelAdjunto, setTextoDelAdjunto] = useState("");
  const cambiarInputRef = useRef<HTMLInputElement>(null);

  function proponerAdjunto(file: File) {
    setUploadError(null);
    setPendientes((p) => [...p, file]);
  }

  function siguienteAdjunto() {
    setPendientes((p) => p.slice(1));
    setTextoDelAdjunto("");
  }

  function enviarAdjunto() {
    const file = pendientes[0];
    if (!file) return;
    const revision = revisarAdjunto(file, textoDelAdjunto);
    if (revision.error) return;
    enqueueUpload(file, revision.admiteTexto ? textoDelAdjunto.trim() : "");
    siguienteAdjunto();
  }

  function cambiarAdjunto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendientes((p) => [file, ...p.slice(1)]);
    e.target.value = "";
  }

  useImperativeHandle(ref, () => ({ attachFile: proponerAdjunto }));

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) proponerAdjunto(file);
    e.target.value = "";
  }

  // Ctrl/Cmd+V with an image on the clipboard (a screenshot, a copied image
  // from another app) attaches it like a picked file — text pastes are left
  // completely alone so normal typing/pasting still works.
  // El campo arranca de una linea y crece con el texto hasta el tope que fija
  // max-h-40 en las clases; a partir de ahi hace scroll en vez de empujar el
  // chat hacia arriba.
  function autoGrow(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function resetBodyHeight() {
    if (bodyRef.current) bodyRef.current.style.height = "auto";
  }

  // Mismo criterio que WhatsApp: con teclado fisico Enter envia y Shift+Enter
  // hace el salto de linea; en pantallas tactiles Enter hace el salto y se
  // envia con el boton, porque ahi Shift+Enter no existe. Se consulta en cada
  // pulsacion en vez de guardarlo en estado, asi acierta tambien si conectan
  // un teclado a la tablet.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;

    // El teclado del movil usa Enter para confirmar texto predictivo; enviar
    // en ese momento cortaria la palabra a medias.
    if (e.nativeEvent.isComposing) return;

    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    // Ctrl/Cmd+Enter envia siempre, en cualquier dispositivo.
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
      return;
    }

    if (isTouch || e.shiftKey) return; // salto de linea

    e.preventDefault();
    formRef.current?.requestSubmit();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          proponerAdjunto(file);
        }
        return;
      }
    }
  }

  // Mide el nivel del microfono mientras se graba. Es solo para dibujar la onda:
  // si el navegador no deja (Safari antiguo, contexto de audio suspendido), la
  // grabacion sigue igual y la onda queda baja, sin romper nada.
  function iniciarMedicion(stream: MediaStream) {
    nivelesRef.current = [];
    try {
      const Contexto =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexto) return;
      const ctx = new Contexto();
      void ctx.resume().catch(() => {});
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analizador);
      audioCtxRef.current = ctx;
      const muestra = new Uint8Array(analizador.fftSize);
      medicionRef.current = setInterval(() => {
        analizador.getByteTimeDomainData(muestra);
        nivelesRef.current.push(nivelDeMuestra(muestra));
      }, 100);
    } catch {
      // Sin medicion: la onda queda baja, la grabacion no se ve afectada.
    }
  }

  function detenerMedicion() {
    if (medicionRef.current) clearInterval(medicionRef.current);
    medicionRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  // Si se cierra el chat con la grabacion en curso, no deja el microfono ni el reloj abiertos.
  useEffect(() => {
    return () => {
      if (medicionRef.current) clearInterval(medicionRef.current);
      void audioCtxRef.current?.close().catch(() => {});
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Different browsers support different container/codec combos for
      // MediaRecorder (Chrome/Edge: webm/opus, Safari: often mp4/aac) — using
      // whatever the browser actually records instead of hardcoding "webm"
      // is what makes the local preview player able to decode it.
      // Safari/iOS dice que "soporta" audio/webm pero graba MP4 (AAC) por
      // dentro: el archivo llegaba al servidor como .webm y ffmpeg lo
      // rechazaba ("EBML header parsing failed"). Ahi se pide MP4 primero,
      // que es lo que de verdad produce y WhatsApp acepta sin convertir.
      const esApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
      const candidates = esApple
        ? ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm"]
        : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];
      const mimeType =
        candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      recordingMimeTypeRef.current = mimeType || (esApple ? "audio/mp4" : "audio/webm");
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      // Con trozos periodicos (1 s) Safari/iPad no depende de entregar todo
      // el audio en un unico evento al parar, que es donde a veces llegaba
      // vacio y la nota se perdia sin aviso.
      recorder.start(1000);
      iniciarMedicion(stream);
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
        // El tipo real lo dicta el grabador (recorder.mimeType); el que se
        // pidio puede no ser el que produjo.
        const tipoReal = recorder.mimeType || recordingMimeTypeRef.current;
        recordingMimeTypeRef.current = tipoReal;
        // Safari puede disparar el ultimo "dataavailable" justo despues de
        // "stop": se le da un respiro antes de armar el archivo.
        setTimeout(() => resolve(new Blob(audioChunksRef.current, { type: tipoReal })), 150);
      };
      // Pide el trozo pendiente antes de parar (en Safari no siempre sale solo).
      if (recorder.state === "recording") {
        try {
          recorder.requestData();
        } catch {
          // Algunos navegadores no lo implementan; el stop() lo entrega igual.
        }
      }
      recorder.stop();
    });
  }

  async function handleCirclePress() {
    if (timerRef.current) clearInterval(timerRef.current);
    detenerMedicion();
    setResumen(resumirNiveles(nivelesRef.current, 14));
    const blob = await stopCapture();
    recordedBlobRef.current = blob;
    if (blob.size === 0) {
      // Antes se quedaba en "revisar" sin audio y al enviar no pasaba nada.
      setUploadError("La nota de voz quedó vacía. Toca el micrófono y graba de nuevo; espera un segundo antes de parar.");
      setRecStatus("idle");
      setRecordSeconds(0);
      return;
    }
    setPreviewUrl(URL.createObjectURL(blob));
    setRecStatus("reviewing");
  }

  function discardPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewPlaying(false);
    setPreviewTime(0);
  }

  async function cancelRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    detenerMedicion();
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
    } else {
      setUploadError("La nota de voz quedó vacía. Graba de nuevo.");
    }
  }

  return (
    <div className="w-full min-w-0 border-t border-border bg-surface p-2 sm:p-4">
      {previewUrl && (
        <audio
          ref={previewAudioRef}
          src={previewUrl}
          preload="auto"
          playsInline
          onTimeUpdate={(e) => setPreviewTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setPreviewPlaying(false);
            setPreviewTime(0);
          }}
          onPause={() => setPreviewPlaying(false)}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      )}

      {/* Grabando: una pildora pequeña y translucida sobre la caja de escribir.
          Antes era una pantalla completa que tapaba el chat y los avisos. El
          contenedor de alto cero ancla la pildora justo encima de la caja. */}
      {recStatus !== "idle" && (
        <div className="relative h-0 w-full">
          <PildoraDeGrabacion
            revisando={recStatus === "reviewing"}
            segundos={recordSeconds}
            nivelesRef={nivelesRef}
            resumen={resumen}
            sonando={previewPlaying}
            tiempoDeReproduccion={previewTime}
            onCancel={cancelRecording}
            onStop={handleCirclePress}
            onPlay={togglePreviewPlayback}
            onRedo={reRecord}
            onSend={sendRecording}
          />
        </div>
      )}

      {pendientes[0] && (
        <HojaDeAdjunto
          key={`${pendientes[0].name}-${pendientes[0].size}-${pendientes[0].lastModified}`}
          archivo={pendientes[0]}
          posicion={1}
          total={pendientes.length}
          texto={textoDelAdjunto}
          onTexto={setTextoDelAdjunto}
          onEnviar={enviarAdjunto}
          onCancelar={siguienteAdjunto}
          onCambiar={() => cambiarInputRef.current?.click()}
        />
      )}
      <input
        ref={cambiarInputRef}
        type="file"
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
        onChange={cambiarAdjunto}
        className="hidden"
      />

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
        <ResetAutomationsButton contactId={contactId} />
        <CitaPicker contactId={contactId} contactName={contactName} />
        <RecordatorioPicker conversationId={conversationId} contactName={contactName} />
        <button
          type="button"
          onClick={startRecording}
          disabled={recStatus !== "idle"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
          title="Grabar nota de voz"
        >
          <Mic size={18} />
        </button>
      </div>

      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-primary bg-background px-3 py-1.5">
          <Reply size={14} className="shrink-0 text-primary" />
          <p className="min-w-0 flex-1 truncate text-xs text-muted">
            Respondiendo a: <span className="text-foreground">{replyingTo.preview}</span>
          </p>
          <button
            type="button"
            onClick={onClearReply}
            className="shrink-0 text-muted hover:text-foreground"
            title="Cancelar respuesta"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`flex w-full min-w-0 items-end gap-1.5 sm:gap-2 ${recStatus !== "idle" ? "pointer-events-none opacity-50" : ""}`}
      >
        <textarea
          ref={bodyRef}
          name="body"
          rows={1}
          placeholder="Escribe un mensaje..."
          autoComplete="off"
          required
          onPaste={handlePaste}
          onInput={autoGrow}
          onKeyDown={handleKeyDown}
          // 16px min font size on mobile — anything smaller makes iOS/Android
          // auto-zoom the page on focus, which pushes the send button off-screen.
          className="min-h-9 max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-background px-2.5 py-2 text-base leading-5 text-foreground outline-none focus:border-primary sm:min-h-10 sm:px-3 sm:text-sm"
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

const BARRAS_DE_LA_PILDORA = 14;

/**
 * Onda de barras. Mientras graba son las ultimas lecturas del microfono; al
 * revisar es el resumen de toda la nota, y las barras ya escuchadas se pintan
 * con el color principal.
 */
function Onda({ barras, color, progreso }: { barras: number[]; color: string; progreso?: number }) {
  return (
    <div aria-hidden className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
      {barras.map((a, i) => (
        <span
          key={i}
          style={{ height: `${Math.max(3, a * 22)}px` }}
          className={`w-[3px] shrink-0 rounded-full transition-[height] duration-100 ${
            progreso === undefined ? color : i / barras.length < progreso ? "bg-primary" : "bg-muted/60"
          }`}
        />
      ))}
    </div>
  );
}

function PildoraDeGrabacion({
  revisando,
  segundos,
  nivelesRef,
  resumen,
  sonando,
  tiempoDeReproduccion,
  onCancel,
  onStop,
  onPlay,
  onRedo,
  onSend,
}: {
  revisando: boolean;
  segundos: number;
  nivelesRef: React.RefObject<number[]>;
  resumen: number[];
  sonando: boolean;
  tiempoDeReproduccion: number;
  onCancel: () => void;
  onStop: () => void;
  onPlay: () => void;
  onRedo: () => void;
  onSend: () => void;
}) {
  const [barras, setBarras] = useState<number[]>(() => ultimasBarras([], BARRAS_DE_LA_PILDORA));

  // La onda en vivo se repinta diez veces por segundo, solo en la pildora.
  useEffect(() => {
    if (revisando) return;
    const id = setInterval(() => setBarras(ultimasBarras(nivelesRef.current, BARRAS_DE_LA_PILDORA)), 100);
    return () => clearInterval(id);
  }, [revisando, nivelesRef]);

  const escuchando = sonando || tiempoDeReproduccion > 0;
  const progreso = segundos > 0 ? Math.min(1, tiempoDeReproduccion / segundos) : 0;
  const boton = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground";

  return (
    <div
      role="group"
      aria-label={revisando ? "Nota de voz grabada" : "Grabando nota de voz"}
      className="absolute bottom-4 left-1/2 z-40 flex h-12 w-[min(94%,340px)] -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface/80 pl-3.5 pr-1.5 shadow-xl backdrop-blur-md sm:bottom-6"
    >
      {revisando ? (
        <>
          <button
            type="button"
            onClick={onPlay}
            aria-label={sonando ? "Pausar" : "Escuchar nota de voz"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-foreground"
          >
            {sonando ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>
          <Onda barras={resumen} color="" progreso={escuchando ? progreso : 0} />
          <span className="w-11 shrink-0 text-right font-mono text-[13px] font-medium tabular-nums text-foreground">
            {formatoDeReloj(escuchando ? tiempoDeReproduccion : segundos)}
          </span>
          <button type="button" onClick={onRedo} aria-label="Grabar de nuevo" className={boton}>
            <RotateCcw size={16} />
          </button>
          <button type="button" onClick={onCancel} aria-label="Cancelar" className={boton}>
            <X size={17} />
          </button>
          <button
            type="button"
            onClick={onSend}
            aria-label="Enviar nota de voz"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover"
          >
            <Check size={18} />
          </button>
        </>
      ) : (
        <>
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="w-11 shrink-0 font-mono text-[13px] font-medium tabular-nums text-foreground">
            {formatoDeReloj(segundos)}
          </span>
          <Onda barras={barras} color="bg-red-500" />
          <button type="button" onClick={onCancel} aria-label="Cancelar grabación" className={boton}>
            <X size={17} />
          </button>
          <button
            type="button"
            onClick={onStop}
            aria-label="Detener grabación"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:brightness-110"
          >
            <Square size={14} fill="white" />
          </button>
        </>
      )}
    </div>
  );
}

const COLOR_DE_EXTENSION: Record<string, string> = {
  PDF: "#d4332b",
  XLS: "#188a4a",
  XLSX: "#188a4a",
  DOC: "#2563eb",
  DOCX: "#2563eb",
  PPT: "#d97706",
  PPTX: "#d97706",
};

/**
 * Vista previa de un archivo ANTES de enviarlo: se ve lo que se eligio, se le
 * puede escribir un texto, y se puede cambiar o cancelar. Antes el archivo se
 * enviaba en cuanto se elegia.
 */
export function HojaDeAdjunto({
  archivo,
  posicion,
  total,
  texto,
  onTexto,
  onEnviar,
  onCancelar,
  onCambiar,
}: {
  archivo: File;
  posicion: number;
  total: number;
  texto: string;
  onTexto: (t: string) => void;
  onEnviar: () => void;
  onCancelar: () => void;
  onCambiar: () => void;
}) {
  const revision = revisarAdjunto(archivo, texto);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  // La URL de la vista previa se crea una vez por archivo (la hoja se vuelve a
  // montar con otra `key` cuando cambia el archivo) y se libera al cerrarla.
  const [url] = useState(() =>
    revision.tipo === "image" || revision.tipo === "video" ? URL.createObjectURL(archivo) : null
  );
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCancelar]);

  // Mismo criterio que la caja de escribir: con teclado fisico Enter envia y
  // Shift+Enter salta de linea; en pantallas tactiles Enter salta de linea.
  function alPulsar(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const tactil = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (e.ctrlKey || e.metaKey || (!e.shiftKey && !tactil)) {
      e.preventDefault();
      if (!revision.error) onEnviar();
    }
  }

  const ext = extensionDe(archivo.name);
  const falta = texto.length > LARGO_MAXIMO_DEL_TEXTO - 124;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del archivo"
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{archivo.name}</p>
          {total > 1 && (
            <span className="shrink-0 text-xs text-muted">
              {posicion} de {total}
            </span>
          )}
          <span className="shrink-0 text-xs tabular-nums text-muted">{pesoLegible(archivo.size)}</span>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cancelar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mx-3 flex h-64 items-center justify-center overflow-hidden rounded-xl bg-background sm:h-72">
          {revision.tipo === "image" && url ? (
            // eslint-disable-next-line @next/next/no-img-element -- vista previa local de un archivo que aun no se sube
            <img src={url} alt={`Vista previa de ${archivo.name}`} className="h-full w-full object-contain" />
          ) : revision.tipo === "video" && url ? (
            <video src={url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted">
              <FileText size={44} strokeWidth={1.5} />
              <span
                className="rounded-md px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-white"
                style={{ background: COLOR_DE_EXTENSION[ext] ?? "#6b7280" }}
              >
                {ext}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto px-3 pb-3 pt-2.5">
          {revision.error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/10 px-2.5 py-2 text-xs text-red-400">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span>{revision.error}</span>
            </div>
          )}
          {!revision.error && revision.aviso && (
            <div role="status" className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-400">
              <AlertCircle size={14} className="mt-px shrink-0" />
              <span>{revision.aviso}</span>
            </div>
          )}

          {revision.admiteTexto ? (
            <>
              <textarea
                ref={areaRef}
                value={texto}
                onChange={(e) => onTexto(e.target.value)}
                onKeyDown={alPulsar}
                rows={2}
                placeholder="Añade un texto a este archivo (opcional)"
                aria-label="Texto que viaja con el archivo"
                // 16 px en movil: menos que eso hace que iOS y Android amplien la pagina al enfocar.
                className="max-h-28 min-h-[3.25rem] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-base leading-5 text-foreground outline-none focus:border-primary sm:text-sm"
              />
              {falta && (
                <p className={`text-right text-[11px] tabular-nums ${texto.length > LARGO_MAXIMO_DEL_TEXTO ? "font-semibold text-red-400" : "text-muted"}`}>
                  {texto.length} / {LARGO_MAXIMO_DEL_TEXTO}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">Los audios se envían sin texto.</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCambiar}
              className="flex h-9 items-center gap-1.5 rounded-full bg-surface-hover px-3.5 text-[13px] font-semibold text-foreground hover:brightness-95"
            >
              <ArrowLeftRight size={14} />
              Cambiar
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={onCancelar}
              className="px-3 text-[13px] font-semibold text-muted hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onEnviar}
              disabled={!!revision.error}
              className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send size={15} />
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

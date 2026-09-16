/**
 * Un solo router.refresh() por rafaga de eventos, para toda la pagina.
 *
 * Cada mensaje de WhatsApp produce varios cambios seguidos (fila del mensaje,
 * last_message_at de la conversacion, y luego los estados enviado/entregado/
 * leido). Con un refresh por evento y por componente suscrito, el servidor
 * volvia a renderizar bandeja + chat cinco o seis veces por mensaje, en
 * serie; con trafico, un mensaje nuevo esperaba detras de esa cola 15-20 s.
 *
 * Aqui todos los suscriptores piden "refresca pronto" y se ejecuta uno solo:
 * se agrupan los eventos cercanos, y si llega otro mientras un refresh esta
 * en curso, se guarda UNA repeticion para cuando termine.
 */

type Runner = () => void;

const runners = new Set<Runner>();
let timer: ReturnType<typeof setTimeout> | null = null;
let vence = 0;
let enCurso = false;
let otraVez = false;

export function registrarRunner(r: Runner): () => void {
  runners.add(r);
  return () => {
    runners.delete(r);
  };
}

export function solicitarRefresco(retrasoMs: number) {
  const cuando = Date.now() + retrasoMs;
  // Si ya hay uno programado mas tarde, se adelanta; si esta antes, se deja.
  if (timer && cuando >= vence) return;
  if (timer) clearTimeout(timer);
  vence = cuando;
  timer = setTimeout(ejecutar, retrasoMs);
}

function ejecutar() {
  timer = null;
  if (enCurso) {
    otraVez = true;
    return;
  }
  const runner = runners.values().next().value;
  if (!runner) return;
  enCurso = true;
  runner();
}

/** Lo llama el runner cuando su transicion termina. */
export function refrescoTermino() {
  enCurso = false;
  if (otraVez) {
    otraVez = false;
    solicitarRefresco(0);
  }
}

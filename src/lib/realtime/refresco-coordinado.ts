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

/** Si un refresco no avisa que termino en este tiempo, se da por terminado. */
const LIMITE_REFRESCO_MS = 8000;

const runners = new Set<Runner>();
let timer: ReturnType<typeof setTimeout> | null = null;
let vence = 0;
let enCurso = false;
let otraVez = false;
let vigilante: ReturnType<typeof setTimeout> | null = null;

export function registrarRunner(r: Runner): () => void {
  runners.add(r);
  return () => {
    runners.delete(r);
    // El componente que lanzo el refresco pudo desmontarse antes de avisar
    // que termino (cambiar de chat, cerrar la bandeja). Sin esto, "en curso"
    // se quedaba encendido para siempre y la pagina no volvia a refrescarse
    // sola hasta recargar a mano.
    if (runners.size === 0) liberar();
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
  // Red de seguridad: si nadie avisa que el refresco termino (el componente
  // se desmonto, la transicion se quedo colgada), se libera igual.
  if (vigilante) clearTimeout(vigilante);
  vigilante = setTimeout(liberar, LIMITE_REFRESCO_MS);
  runner();
}

/** Lo llama el runner cuando su transicion termina. */
export function refrescoTermino() {
  liberar();
}

function liberar() {
  if (vigilante) {
    clearTimeout(vigilante);
    vigilante = null;
  }
  const estaba = enCurso;
  enCurso = false;
  if (otraVez && estaba) {
    otraVez = false;
    solicitarRefresco(0);
  }
}

"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  EJEMPLO_AVISO,
  ENDPOINTS,
  FIRMA_NODE,
  FIRMA_PYTHON,
  URL_BASE,
  coleccionPostman,
  ejemploCurl,
  ejemploJs,
  ejemploPython,
  openApi,
  type Campo,
  type Endpoint,
} from "@/lib/api-publica/docs";
import { EVENTOS } from "@/lib/api-publica/eventos";
import { PERMISOS } from "@/lib/api-publica/permisos";

type Pestana = "inicio" | "referencia" | "webhooks" | "recetas";

const METODO_COLOR: Record<Endpoint["metodo"], string> = {
  GET: "bg-info/15 text-info",
  POST: "bg-success/15 text-success",
  PATCH: "bg-warning/15 text-warning",
  DELETE: "bg-error/15 text-error",
};

function Codigo({ texto }: { texto: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
      <code>{texto}</code>
    </pre>
  );
}

function descargar(nombre: string, contenido: unknown) {
  const blob = new Blob([JSON.stringify(contenido, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function Tabla({ campos }: { campos: Campo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted">
          <tr>
            <th className="py-1.5 pr-3 font-medium">Campo</th>
            <th className="py-1.5 pr-3 font-medium">Tipo</th>
            <th className="py-1.5 font-medium">Descripción</th>
          </tr>
        </thead>
        <tbody>
          {campos.map((c) => (
            <tr key={c.nombre} className="border-t border-border align-top">
              <td className="whitespace-nowrap py-1.5 pr-3">
                <code className="text-foreground">{c.nombre}</code>
                {c.obligatorio && <span className="ml-1 text-error">*</span>}
              </td>
              <td className="py-1.5 pr-3 text-muted">{c.tipo}</td>
              <td className="py-1.5 text-muted">{c.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointDoc({ e }: { e: Endpoint }) {
  const [lenguaje, setLenguaje] = useState<"curl" | "js" | "python">("curl");
  const ejemplo = lenguaje === "curl" ? ejemploCurl(e) : lenguaje === "js" ? ejemploJs(e) : ejemploPython(e);
  return (
    <details id={e.id} className="rounded-lg border border-border">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${METODO_COLOR[e.metodo]}`}>{e.metodo}</span>
        <code className="text-foreground">{e.ruta}</code>
        <span className="text-muted">{e.resumen}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        {e.detalle && <p className="text-sm text-muted">{e.detalle}</p>}
        <p className="text-xs text-muted">
          Permiso: {e.permiso ? <code className="text-foreground">{e.permiso}</code> : "cualquier llave válida"} · Éxito: {e.estado ?? 200}
        </p>
        {e.parametros && (
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Parámetros</p>
            <Tabla campos={e.parametros} />
          </div>
        )}
        {e.cuerpo && (
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Cuerpo (JSON)</p>
            <Tabla campos={e.cuerpo} />
          </div>
        )}
        <div>
          <div className="mb-1 flex gap-1">
            {(["curl", "js", "python"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLenguaje(l)}
                className={`rounded px-2 py-1 text-xs ${lenguaje === l ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"}`}
              >
                {l === "curl" ? "cURL" : l === "js" ? "JavaScript" : "Python"}
              </button>
            ))}
          </div>
          <Codigo texto={ejemplo} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Respuesta</p>
          <Codigo texto={JSON.stringify(e.ejemploRespuesta, null, 2)} />
        </div>
      </div>
    </details>
  );
}

/** Configuración → API → Documentación. Todo sale de lib/api-publica/docs.ts. */
export function DocumentacionApi() {
  const [pestana, setPestana] = useState<Pestana>("inicio");
  const grupos = [...new Set(ENDPOINTS.map((e) => e.grupo))];

  const boton = (clave: Pestana, texto: string) => (
    <button
      type="button"
      onClick={() => setPestana(clave)}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${pestana === clave ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-hover hover:text-foreground"}`}
    >
      {texto}
    </button>
  );

  return (
    <div className="rounded-[13px] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {boton("inicio", "Inicio rápido")}
          {boton("referencia", "Referencia")}
          {boton("webhooks", "Webhooks")}
          {boton("recetas", "Recetas")}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => descargar("bybluee-openapi.json", openApi())} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover">
            <Download size={13} /> OpenAPI
          </button>
          <button type="button" onClick={() => descargar("bybluee-postman.json", coleccionPostman())} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-hover">
            <Download size={13} /> Postman
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 text-sm text-muted">
        {pestana === "inicio" && (
          <>
            <section>
              <h3 className="text-base font-semibold text-foreground">Tu primer mensaje en 5 minutos</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>
                  En la pestaña <strong className="text-foreground">Llaves</strong> crea una llave con los permisos <code>mensajes:enviar</code> y{" "}
                  <code>plantillas:leer</code>. Cópiala: solo se muestra una vez.
                </li>
                <li>Comprueba que funciona:</li>
              </ol>
              <div className="mt-2">
                <Codigo texto={`curl "${URL_BASE}" \\\n  -H "Authorization: Bearer TU_LLAVE"`} />
              </div>
              <ol start={3} className="mt-3 list-decimal space-y-2 pl-5">
                <li>
                  Mira qué plantillas tienes aprobadas con <code>GET /plantillas</code>. Una plantilla es lo único que WhatsApp deja enviar a alguien que no te
                  ha escrito en las últimas 24 horas.
                </li>
                <li>Envíala:</li>
              </ol>
              <div className="mt-2">
                <Codigo
                  texto={`curl -X POST "${URL_BASE}/mensajes" \\\n  -H "Authorization: Bearer TU_LLAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '{"telefono":"573001234567","plantilla":{"nombre":"mi_plantilla"}}'`}
                />
              </div>
              <p className="mt-2">
                Verás el mensaje en la bandeja del CRM como cualquier otro, con su estado de entrega.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Autenticación</h3>
              <p className="mt-1">
                Cada petición lleva tu llave en la cabecera <code>Authorization: Bearer bbl_live_…</code>. Todo va por HTTPS y las respuestas son JSON. La URL
                base es <code>{URL_BASE}</code>. Trata la llave como una contraseña: no la pongas en código que vea el público (páginas web, apps móviles). Si se
                filtra, revócala en la pestaña Llaves y crea otra.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Permisos</h3>
              <p className="mt-1">Cada llave solo puede lo que marcaste al crearla. Si falta un permiso, la API responde 403 con el nombre del que necesitas.</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {PERMISOS.map((p) => (
                      <tr key={p.clave} className="border-t border-border">
                        <td className="whitespace-nowrap py-1.5 pr-3"><code className="text-foreground">{p.clave}</code></td>
                        <td className="py-1.5">{p.detalle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Errores</h3>
              <p className="mt-1">Todos los errores tienen la misma forma. El <code>codigo</code> es estable (úsalo en tu programa); el <code>mensaje</code> es para personas.</p>
              <div className="mt-2">
                <Codigo texto={`{\n  "error": {\n    "codigo": "ventana_cerrada",\n    "mensaje": "Pasaron más de 24 horas desde el último mensaje del cliente…"\n  }\n}`} />
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {[
                      ["400", "peticion_invalida", "Falta un campo o tiene un valor inválido."],
                      ["401", "llave_invalida / llave_vencida", "La llave no existe, fue revocada o venció."],
                      ["403", "permiso_denegado / modulo_no_incluido / cuenta_bloqueada", "Falta el permiso, tu plan no incluye la API o tu cuenta no tiene plan activo."],
                      ["404", "no_encontrado", "El recurso no existe en tu cuenta."],
                      ["409", "conflicto", "Choca con algo existente (por ejemplo, un teléfono repetido)."],
                      ["422", "ventana_cerrada / sin_linea", "Reglas de WhatsApp: texto libre fuera de las 24 horas, o no hay línea conectada."],
                      ["429", "limite_excedido", "Superaste el límite de peticiones por minuto. Espera lo que indica Retry-After."],
                      ["502", "error_whatsapp", "WhatsApp rechazó el envío; el mensaje explica por qué."],
                    ].map(([estado, codigo, detalle]) => (
                      <tr key={codigo} className="border-t border-border align-top">
                        <td className="py-1.5 pr-3 text-foreground">{estado}</td>
                        <td className="py-1.5 pr-3"><code className="text-foreground">{codigo}</code></td>
                        <td className="py-1.5">{detalle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Límites y buenas prácticas</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Hay un tope de peticiones por minuto para toda tu cuenta (se ve en la pestaña Llaves). Al pasarlo recibes 429 con la cabecera <code>Retry-After</code>.</li>
                <li>Las listas se paginan con <code>pagina</code> y <code>limite</code> (hasta 100).</li>
                <li>Para saber qué pasó con un mensaje o un cliente nuevo, usa webhooks en lugar de consultar la API una y otra vez.</li>
                <li>Si tu servidor reintenta un envío, ten en cuenta que cada llamada a <code>POST /mensajes</code> envía un mensaje nuevo: guarda el <code>id</code> que devuelve.</li>
                <li>Envía mensajes solo a personas que esperan recibirlos. La calidad de tu línea de WhatsApp depende de eso.</li>
              </ul>
            </section>
          </>
        )}

        {pestana === "referencia" &&
          grupos.map((g) => (
            <section key={g}>
              <h3 className="mb-2 text-base font-semibold text-foreground">{g}</h3>
              <div className="flex flex-col gap-2">
                {ENDPOINTS.filter((e) => e.grupo === g).map((e) => (
                  <EndpointDoc key={e.id} e={e} />
                ))}
              </div>
            </section>
          ))}

        {pestana === "webhooks" && (
          <>
            <section>
              <h3 className="text-base font-semibold text-foreground">Cómo funcionan</h3>
              <p className="mt-1">
                En la pestaña <strong className="text-foreground">Webhooks</strong> registras una URL <code>https://</code> y eliges los eventos. Cuando ocurren,
                Bybluee CRM hace un <code>POST</code> con un JSON a tu URL. Tu servidor debe responder <strong className="text-foreground">2xx en menos de 10
                segundos</strong>; haz el trabajo pesado después de responder. Si responde otra cosa o no responde, se reintenta a los 30 s, 2 min, 10 min, 1 hora y 6
                horas. Tras 20 avisos fallidos seguidos el webhook se pausa solo. Puedes ver y reintentar cada aviso en «Últimos avisos».
              </p>
              <p className="mt-2">Un mismo aviso puede llegar más de una vez (por un reintento): usa el campo <code>id</code> para ignorar los repetidos.</p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Eventos</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {EVENTOS.map((e) => (
                      <tr key={e.clave} className="border-t border-border">
                        <td className="whitespace-nowrap py-1.5 pr-3"><code className="text-foreground">{e.clave}</code></td>
                        <td className="py-1.5">{e.detalle}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2">Además, el botón «Probar» envía un evento <code>prueba.ping</code> para que verifiques tu integración.</p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Forma del aviso</h3>
              <div className="mt-2">
                <Codigo texto={JSON.stringify(EJEMPLO_AVISO, null, 2)} />
              </div>
              <p className="mt-2">
                Además del cuerpo, cada aviso trae las cabeceras <code>X-Bybluee-Event</code>, <code>X-Bybluee-Delivery</code> (el mismo <code>id</code>) y{" "}
                <code>X-Bybluee-Signature</code>.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Verifica la firma</h3>
              <p className="mt-1">
                Cualquiera podría mandarle un POST a tu URL. Para confirmar que viene de Bybluee CRM, recalcula la firma con el secreto del webhook (el que se mostró
                al crearlo) y compárala. La cabecera tiene la forma <code>t=&lt;segundos&gt;,v1=&lt;firma&gt;</code>, y la firma es HMAC-SHA256 de{" "}
                <code>&lt;t&gt;.&lt;cuerpo exacto&gt;</code>. Usa el cuerpo tal como llegó, sin volver a serializarlo.
              </p>
              <p className="mt-3 text-xs font-medium text-foreground">Node.js</p>
              <Codigo texto={FIRMA_NODE} />
              <p className="mt-3 text-xs font-medium text-foreground">Python</p>
              <Codigo texto={FIRMA_PYTHON} />
            </section>
          </>
        )}

        {pestana === "recetas" && (
          <>
            <section>
              <h3 className="text-base font-semibold text-foreground">Facturación: avisar que hay una factura nueva</h3>
              <p className="mt-1">
                Crea una plantilla de utilidad como «Hola {"{{1}}"}, tu factura {"{{2}}"} por {"{{3}}"} ya está disponible» y envíala cuando tu sistema emita la factura:
              </p>
              <div className="mt-2">
                <Codigo
                  texto={`POST ${URL_BASE}/mensajes\n{\n  "telefono": "573001234567",\n  "plantilla": { "nombre": "factura_disponible", "variables": ["Ana", "FV-1024", "$150.000"] }\n}`}
                />
              </div>
              <p className="mt-2">Para saber si pagó, activa un webhook con <code>mensaje.leido</code> o pon la etiqueta «Pagó» al contacto cuando tu sistema registre el pago.</p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">ERP o base de clientes: mantener los contactos al día</h3>
              <p className="mt-1">
                Cada vez que un cliente se cree o cambie en tu ERP, llama a <code>POST /contactos</code> con su teléfono y datos: si existe lo actualiza y si no lo crea.
                Para el camino contrario, un webhook <code>contacto.creado</code> avisa a tu ERP cuando entra un contacto nuevo por WhatsApp.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Tienda en línea: confirmar pedidos y recuperar carritos</h3>
              <p className="mt-1">
                Al confirmarse un pedido, envía una plantilla con el número de pedido. Para carritos abandonados, etiqueta al contacto con{" "}
                <code>POST /contactos/{"{id}"}/etiquetas</code>; si tienes un flujo o automatización que arranca con esa etiqueta, el CRM se encarga del resto.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Zapier, Make o n8n</h3>
              <p className="mt-1">
                Usa el módulo «Webhooks / HTTP» de la herramienta. Para <strong className="text-foreground">enviar</strong>: una acción «HTTP Request» tipo POST a{" "}
                <code>{URL_BASE}/mensajes</code> con la cabecera <code>Authorization: Bearer TU_LLAVE</code>. Para <strong className="text-foreground">recibir</strong>: crea
                en la herramienta un disparador «Webhook» (te da una URL https), pégala en la pestaña Webhooks y elige los eventos. Descarga la colección de Postman o la
                especificación OpenAPI de arriba si la herramienta puede importarla.
              </p>
            </section>

            <section>
              <h3 className="text-base font-semibold text-foreground">Responder desde tu propio sistema</h3>
              <p className="mt-1">
                Webhook <code>mensaje.recibido</code> → tu sistema decide qué contestar → <code>POST /mensajes</code> con <code>texto</code> (vale dentro de las 24 horas desde que el
                cliente escribió). Si quieres que una persona tome el chat, asígnalo con <code>PATCH /conversaciones/{"{id}"}</code> y <code>agente_id</code>.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

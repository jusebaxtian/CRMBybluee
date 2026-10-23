/**
 * Documentacion de la API: UNA lista de endpoints de la que salen la pantalla de
 * documentacion, los ejemplos (cURL, JavaScript, Python), la especificacion
 * OpenAPI y la coleccion de Postman. Hay una prueba que compara esta lista con
 * las rutas que existen, asi que una ruta nueva sin documentar no pasa las pruebas.
 *
 * Es codigo puro (sin servidor) para poder usarlo tambien en el navegador.
 */

export const URL_BASE = "https://crmbybluee.blue/api/v1";

export type Campo = { nombre: string; tipo: string; obligatorio?: boolean; detalle: string };

export type Endpoint = {
  id: string;
  grupo: string;
  metodo: "GET" | "POST" | "PATCH" | "DELETE";
  /** Ruta bajo /api/v1, con {parametros} entre llaves. */
  ruta: string;
  /** Permiso que exige la llave; null = basta una llave valida. */
  permiso: string | null;
  resumen: string;
  detalle?: string;
  /** Parametros de la URL ({id}) y de la query (?pagina=). */
  parametros?: Campo[];
  /** Campos del cuerpo JSON. */
  cuerpo?: Campo[];
  ejemploCuerpo?: unknown;
  ejemploRespuesta: unknown;
  /** Estado HTTP de la respuesta de exito. */
  estado?: number;
};

const PAGINACION: Campo[] = [
  { nombre: "pagina", tipo: "número", detalle: "Página, desde 1. Por defecto 1." },
  { nombre: "limite", tipo: "número", detalle: "Resultados por página, de 1 a 100. Por defecto 50." },
];

const contacto = {
  id: "7c1f0d1e-3b5a-4f0e-9d2a-5b8a1c2d3e4f",
  telefono: "573001234567",
  nombre: "Ana Pérez",
  notas: null,
  variable2: null,
  variable3: null,
  variable4: null,
  etiquetas: ["Cliente"],
  sin_marketing: false,
  creado_el: "2026-10-21T15:04:05.000Z",
};

const conversacion = {
  id: "0b6c9d2e-1a3f-4c5d-8e7f-9a0b1c2d3e4f",
  contacto_id: contacto.id,
  telefono: "573001234567",
  nombre: "Ana Pérez",
  estado: "open",
  linea_id: "33d0d1a3-bfab-434c-81f4-9d3af7053147",
  agente_id: null,
  ultimo_mensaje_el: "2026-10-21T15:10:00.000Z",
};

const campana = {
  id: "5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c1b",
  nombre: "Promo de noviembre",
  estado: "borrador",
  tipo: "plantilla",
  plantilla: "promo_noviembre",
  linea_id: null,
  programada_para: null,
  iniciada_el: null,
  creada_el: "2026-10-21T15:00:00.000Z",
};

export const ENDPOINTS: Endpoint[] = [
  {
    id: "probar",
    grupo: "General",
    metodo: "GET",
    ruta: "/",
    permiso: null,
    resumen: "Probar la llave",
    detalle: "Confirma que tu llave funciona y te dice con qué permisos cuenta. Ideal como primera llamada.",
    ejemploRespuesta: { cuenta: "Mi Negocio", version: "v1", permisos: ["contactos:leer", "mensajes:enviar"] },
  },
  {
    id: "listar-contactos",
    grupo: "Contactos",
    metodo: "GET",
    ruta: "/contactos",
    permiso: "contactos:leer",
    resumen: "Listar y buscar contactos",
    detalle: "Los más recientes primero.",
    parametros: [
      { nombre: "telefono", tipo: "texto", detalle: "Busca el contacto con ese número exacto." },
      { nombre: "q", tipo: "texto", detalle: "Busca en el nombre o el número." },
      { nombre: "etiqueta", tipo: "texto", detalle: "Solo los que tienen esa etiqueta (nombre exacto)." },
      ...PAGINACION,
    ],
    ejemploRespuesta: { datos: [contacto], pagina: 1, limite: 50, total: 1 },
  },
  {
    id: "crear-contacto",
    grupo: "Contactos",
    metodo: "POST",
    ruta: "/contactos",
    permiso: "contactos:escribir",
    resumen: "Crear o actualizar un contacto",
    detalle: "Si el teléfono ya existe en tu cuenta, actualiza sus datos (responde 200); si no, lo crea (responde 201).",
    cuerpo: [
      { nombre: "telefono", tipo: "texto", obligatorio: true, detalle: "Con código de país, por ejemplo 573001234567. Un celular colombiano de 10 dígitos recibe el 57 solo." },
      { nombre: "nombre", tipo: "texto", detalle: "Nombre del contacto." },
      { nombre: "notas", tipo: "texto", detalle: "Notas internas." },
      { nombre: "variable2", tipo: "texto", detalle: "Dato propio de tu cuenta (rellena {{2}} en las plantillas)." },
      { nombre: "variable3", tipo: "texto", detalle: "Dato propio de tu cuenta (rellena {{3}})." },
      { nombre: "variable4", tipo: "texto", detalle: "Dato propio de tu cuenta (rellena {{4}})." },
    ],
    ejemploCuerpo: { telefono: "573001234567", nombre: "Ana Pérez", variable2: "Factura 1024" },
    ejemploRespuesta: { contacto, creado: true },
    estado: 201,
  },
  {
    id: "ver-contacto",
    grupo: "Contactos",
    metodo: "GET",
    ruta: "/contactos/{id}",
    permiso: "contactos:leer",
    resumen: "Ver un contacto",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id del contacto." }],
    ejemploRespuesta: { contacto },
  },
  {
    id: "editar-contacto",
    grupo: "Contactos",
    metodo: "PATCH",
    ruta: "/contactos/{id}",
    permiso: "contactos:escribir",
    resumen: "Editar un contacto",
    detalle: "Solo cambia los campos que envíes. Un campo en null se borra. Si cambias el teléfono y ya existe otro contacto con ese número, responde 409.",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id del contacto." }],
    cuerpo: [
      { nombre: "telefono", tipo: "texto", detalle: "Nuevo teléfono." },
      { nombre: "nombre", tipo: "texto", detalle: "Nuevo nombre." },
      { nombre: "notas", tipo: "texto", detalle: "Notas internas." },
      { nombre: "variable2", tipo: "texto", detalle: "Dato propio 2." },
      { nombre: "variable3", tipo: "texto", detalle: "Dato propio 3." },
      { nombre: "variable4", tipo: "texto", detalle: "Dato propio 4." },
    ],
    ejemploCuerpo: { nombre: "Ana María Pérez" },
    ejemploRespuesta: { contacto: { ...contacto, nombre: "Ana María Pérez" } },
  },
  {
    id: "eliminar-contacto",
    grupo: "Contactos",
    metodo: "DELETE",
    ruta: "/contactos/{id}",
    permiso: "contactos:eliminar",
    resumen: "Eliminar un contacto",
    detalle: "Borra el contacto con sus conversaciones y mensajes. No se puede deshacer.",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id del contacto." }],
    ejemploRespuesta: { eliminado: true, id: contacto.id },
  },
  {
    id: "etiquetar-contacto",
    grupo: "Etiquetas",
    metodo: "POST",
    ruta: "/contactos/{id}/etiquetas",
    permiso: "etiquetas:escribir",
    resumen: "Poner una etiqueta a un contacto",
    detalle: "Si la etiqueta no existe, se crea. Igual que en el CRM, puede arrancar un flujo o una automatización que dependa de esa etiqueta.",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id del contacto." }],
    cuerpo: [{ nombre: "etiqueta", tipo: "texto", obligatorio: true, detalle: "Nombre de la etiqueta." }],
    ejemploCuerpo: { etiqueta: "Pagó factura" },
    ejemploRespuesta: { asignada: true, etiqueta: "Pagó factura" },
    estado: 201,
  },
  {
    id: "quitar-etiqueta",
    grupo: "Etiquetas",
    metodo: "DELETE",
    ruta: "/contactos/{id}/etiquetas/{nombre}",
    permiso: "etiquetas:escribir",
    resumen: "Quitar una etiqueta a un contacto",
    parametros: [
      { nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id del contacto." },
      { nombre: "nombre", tipo: "texto", obligatorio: true, detalle: "Nombre de la etiqueta, codificado para URL (los espacios van como %20)." },
    ],
    ejemploRespuesta: { quitada: true, etiqueta: "Pagó factura" },
  },
  {
    id: "listar-etiquetas",
    grupo: "Etiquetas",
    metodo: "GET",
    ruta: "/etiquetas",
    permiso: "etiquetas:leer",
    resumen: "Listar etiquetas",
    ejemploRespuesta: { datos: [{ id: "a1b2c3d4-0000-4000-8000-000000000001", nombre: "Cliente", color: "#1ba84a" }] },
  },
  {
    id: "crear-etiqueta",
    grupo: "Etiquetas",
    metodo: "POST",
    ruta: "/etiquetas",
    permiso: "etiquetas:escribir",
    resumen: "Crear una etiqueta",
    cuerpo: [
      { nombre: "nombre", tipo: "texto", obligatorio: true, detalle: "Hasta 60 caracteres. Debe ser única en tu cuenta." },
      { nombre: "color", tipo: "texto", detalle: "Color hexadecimal, por ejemplo #1ba84a." },
    ],
    ejemploCuerpo: { nombre: "VIP", color: "#7c5cff" },
    ejemploRespuesta: { etiqueta: { id: "a1b2c3d4-0000-4000-8000-000000000002", nombre: "VIP", color: "#7c5cff" } },
    estado: 201,
  },
  {
    id: "enviar-mensaje",
    grupo: "Mensajes",
    metodo: "POST",
    ruta: "/mensajes",
    permiso: "mensajes:enviar",
    resumen: "Enviar un mensaje",
    detalle:
      "Envía texto libre o una plantilla aprobada. El destinatario va por «telefono» (si no existe como contacto, se crea) o por «contacto_id». " +
      "Reglas de WhatsApp: el texto libre solo se puede enviar dentro de las 24 horas siguientes al último mensaje del cliente; fuera de ese plazo, o con alguien que nunca te ha escrito, usa una plantilla. " +
      "Lo enviado aparece en la bandeja del CRM como cualquier otro mensaje.",
    cuerpo: [
      { nombre: "telefono", tipo: "texto", detalle: "Teléfono con código de país. Usa este o contacto_id." },
      { nombre: "contacto_id", tipo: "texto", detalle: "Id de un contacto existente." },
      { nombre: "texto", tipo: "texto", detalle: "Mensaje de texto (hasta 4096 caracteres). Usa este o plantilla." },
      { nombre: "plantilla", tipo: "objeto", detalle: "Plantilla aprobada: { nombre, idioma?, variables?, boton_url? }. «variables» son los valores de {{1}}, {{2}}… en orden; si no los envías, se rellenan con los datos del contacto. «boton_url» completa el {{1}} de un botón con enlace." },
      { nombre: "linea_id", tipo: "texto", detalle: "Línea de WhatsApp desde la que sale (GET /lineas). Si no, la de la conversación o la primera." },
      { nombre: "seguimientos", tipo: "booleano", detalle: "true para que este mensaje cuente en los seguimientos automáticos de ventas. Por defecto no cuenta." },
    ],
    ejemploCuerpo: {
      telefono: "573001234567",
      plantilla: { nombre: "factura_disponible", idioma: "es", variables: ["Ana", "FV-1024", "$150.000"] },
    },
    ejemploRespuesta: {
      mensaje: {
        id: "wamid.HBgMNTczMDAxMjM0NTY3FQIAERgSQzE4",
        estado: "sent",
        tipo: "plantilla",
        contacto_id: contacto.id,
        conversacion_id: conversacion.id,
        linea_id: conversacion.linea_id,
        contacto_creado: false,
      },
    },
    estado: 201,
  },
  {
    id: "estado-mensaje",
    grupo: "Mensajes",
    metodo: "GET",
    ruta: "/mensajes/{id}",
    permiso: "mensajes:leer",
    resumen: "Consultar el estado de un mensaje",
    detalle: "El estado cambia con el tiempo: sent (enviado), delivered (entregado), read (leído) o failed (fallido, con el motivo en «error»). Para enterarte sin consultar, usa los webhooks.",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "El «id» que devolvió el envío." }],
    ejemploRespuesta: {
      mensaje: { id: "wamid.HBgMNTczMDAxMjM0NTY3FQIAERgSQzE4", estado: "delivered", error: null, tipo: "plantilla", contacto_id: contacto.id, conversacion_id: conversacion.id, creado_el: "2026-10-21T15:05:00.000Z" },
    },
  },
  {
    id: "listar-plantillas",
    grupo: "Plantillas y líneas",
    metodo: "GET",
    ruta: "/plantillas",
    permiso: "plantillas:leer",
    resumen: "Listar plantillas aprobadas",
    ejemploRespuesta: {
      datos: [{ nombre: "factura_disponible", idioma: "es", categoria: "UTILITY", texto: "Hola {{1}}, tu factura {{2}} por {{3}} ya está disponible.", variables: 3, botones: [], encabezado: null, waba_id: "2261869361252212" }],
    },
  },
  {
    id: "listar-lineas",
    grupo: "Plantillas y líneas",
    metodo: "GET",
    ruta: "/lineas",
    permiso: "lineas:leer",
    resumen: "Listar líneas de WhatsApp",
    ejemploRespuesta: { datos: [{ id: "33d0d1a3-bfab-434c-81f4-9d3af7053147", telefono: "+57 300 123 4567", nombre: "Ventas", waba_id: "2261869361252212" }] },
  },
  {
    id: "listar-conversaciones",
    grupo: "Conversaciones",
    metodo: "GET",
    ruta: "/conversaciones",
    permiso: "conversaciones:leer",
    resumen: "Listar conversaciones",
    detalle: "Las de actividad más reciente primero.",
    parametros: [
      { nombre: "estado", tipo: "texto", detalle: "open (abiertas) o closed (cerradas)." },
      { nombre: "contacto_id", tipo: "texto", detalle: "Solo las de ese contacto." },
      { nombre: "linea_id", tipo: "texto", detalle: "Solo las de esa línea." },
      ...PAGINACION,
    ],
    ejemploRespuesta: { datos: [conversacion], pagina: 1, limite: 50, total: 1 },
  },
  {
    id: "ver-conversacion",
    grupo: "Conversaciones",
    metodo: "GET",
    ruta: "/conversaciones/{id}",
    permiso: "conversaciones:leer",
    resumen: "Ver una conversación",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id de la conversación." }],
    ejemploRespuesta: { conversacion },
  },
  {
    id: "editar-conversacion",
    grupo: "Conversaciones",
    metodo: "PATCH",
    ruta: "/conversaciones/{id}",
    permiso: "conversaciones:escribir",
    resumen: "Cerrar, reabrir o asignar una conversación",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id de la conversación." }],
    cuerpo: [
      { nombre: "estado", tipo: "texto", detalle: "open o closed." },
      { nombre: "agente_id", tipo: "texto", detalle: "Id de un agente de tu cuenta, o null para quitar la asignación." },
    ],
    ejemploCuerpo: { estado: "closed" },
    ejemploRespuesta: { conversacion: { ...conversacion, estado: "closed" } },
  },
  {
    id: "mensajes-conversacion",
    grupo: "Conversaciones",
    metodo: "GET",
    ruta: "/conversaciones/{id}/mensajes",
    permiso: "conversaciones:leer",
    resumen: "Historial de mensajes",
    detalle: "Del mensaje más reciente al más antiguo.",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id de la conversación." }, ...PAGINACION],
    ejemploRespuesta: {
      datos: [{ id: "wamid.HBgMNTczMDAxMjM0NTY3FQIAERgSQzE4", direccion: "saliente", tipo: "texto", texto: "Hola Ana", archivo_url: null, estado: "read", error: null, creado_el: "2026-10-21T15:05:00.000Z" }],
      pagina: 1,
      limite: 50,
      total: 1,
    },
  },
  {
    id: "listar-campanas",
    grupo: "Campañas",
    metodo: "GET",
    ruta: "/campanas",
    permiso: "campanas:leer",
    resumen: "Listar campañas",
    parametros: PAGINACION,
    ejemploRespuesta: { datos: [campana], pagina: 1, limite: 50, total: 1 },
  },
  {
    id: "crear-campana",
    grupo: "Campañas",
    metodo: "POST",
    ruta: "/campanas",
    permiso: "campanas:escribir",
    resumen: "Crear una campaña con plantilla",
    detalle:
      "La audiencia se arma con etiquetas (sin «etiquetas», va a todos tus contactos). Queda en borrador, a menos que pidas «enviar»: true (sale ya) o «programada_para» (sale a esa hora). " +
      "Es un envío masivo: cuida el volumen y la calidad de tu línea de WhatsApp.",
    cuerpo: [
      { nombre: "nombre", tipo: "texto", obligatorio: true, detalle: "Nombre de la campaña." },
      { nombre: "plantilla", tipo: "objeto", obligatorio: true, detalle: "{ nombre, idioma? } de una plantilla aprobada." },
      { nombre: "etiquetas", tipo: "lista", detalle: "Nombres de etiquetas: reciben la campaña los contactos que tengan alguna." },
      { nombre: "excluir_etiquetas", tipo: "lista", detalle: "Nombres de etiquetas: quienes las tengan no reciben la campaña." },
      { nombre: "linea_id", tipo: "texto", detalle: "Línea desde la que sale." },
      { nombre: "programada_para", tipo: "fecha ISO", detalle: "Fecha y hora futura, por ejemplo 2026-11-01T14:00:00Z." },
      { nombre: "enviar", tipo: "booleano", detalle: "true para enviarla ahora mismo." },
    ],
    ejemploCuerpo: { nombre: "Promo de noviembre", plantilla: { nombre: "promo_noviembre" }, etiquetas: ["Cliente"], programada_para: "2026-11-01T14:00:00Z" },
    ejemploRespuesta: { campana: { ...campana, programada_para: "2026-11-01T14:00:00.000Z", destinatarios: 340 } },
    estado: 201,
  },
  {
    id: "ver-campana",
    grupo: "Campañas",
    metodo: "GET",
    ruta: "/campanas/{id}",
    permiso: "campanas:leer",
    resumen: "Ver una campaña y su resultado",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id de la campaña." }],
    ejemploRespuesta: { campana: { ...campana, estado: "completada", destinatarios: 340, resultado: { pendientes: 0, enviados: 12, entregados: 200, leidos: 120, fallidos: 8 } } },
  },
  {
    id: "lanzar-campana",
    grupo: "Campañas",
    metodo: "POST",
    ruta: "/campanas/{id}/enviar",
    permiso: "campanas:escribir",
    resumen: "Lanzar una campaña en borrador",
    detalle: "El envío sigue en segundo plano: consulta el avance con GET /campanas/{id}.",
    parametros: [{ nombre: "id", tipo: "texto", obligatorio: true, detalle: "Id de la campaña." }],
    ejemploRespuesta: { campana: { id: campana.id, estado: "enviando" } },
    estado: 202,
  },
];

// ---------------------------------------------------------------------------
// Ejemplos de codigo
// ---------------------------------------------------------------------------

/** Sustituye {id} por un marcador legible en los ejemplos. */
function rutaDeEjemplo(ruta: string): string {
  return ruta.replace(/\{id\}/g, "ID").replace(/\{nombre\}/g, "NOMBRE");
}

function conQuery(e: Endpoint): string {
  const q = (e.parametros ?? []).filter((p) => !e.ruta.includes(`{${p.nombre}}`) && !["pagina", "limite"].includes(p.nombre)).slice(0, 1);
  return q.length > 0 && e.metodo === "GET" ? `?${q[0].nombre}=VALOR` : "";
}

export function ejemploCurl(e: Endpoint): string {
  const url = `${URL_BASE}${rutaDeEjemplo(e.ruta === "/" ? "" : e.ruta)}${conQuery(e)}`;
  const lineas = [`curl -X ${e.metodo} "${url}"`, `  -H "Authorization: Bearer TU_LLAVE"`];
  if (e.ejemploCuerpo) {
    lineas.push(`  -H "Content-Type: application/json"`);
    lineas.push(`  -d '${JSON.stringify(e.ejemploCuerpo)}'`);
  }
  return lineas.join(" \\\n");
}

export function ejemploJs(e: Endpoint): string {
  const url = `${URL_BASE}${rutaDeEjemplo(e.ruta === "/" ? "" : e.ruta)}${conQuery(e)}`;
  const opciones = [`  method: "${e.metodo}",`, `  headers: {`, `    Authorization: "Bearer TU_LLAVE",`];
  if (e.ejemploCuerpo) opciones.push(`    "Content-Type": "application/json",`);
  opciones.push(`  },`);
  if (e.ejemploCuerpo) opciones.push(`  body: JSON.stringify(${JSON.stringify(e.ejemploCuerpo, null, 2).replace(/\n/g, "\n  ")}),`);
  return [`const respuesta = await fetch("${url}", {`, ...opciones, `});`, `const datos = await respuesta.json();`, `console.log(datos);`].join("\n");
}

export function ejemploPython(e: Endpoint): string {
  const url = `${URL_BASE}${rutaDeEjemplo(e.ruta === "/" ? "" : e.ruta)}${conQuery(e)}`;
  const args = [`"${url}"`, `headers={"Authorization": "Bearer TU_LLAVE"}`];
  if (e.ejemploCuerpo) args.push(`json=${pythonLiteral(e.ejemploCuerpo)}`);
  return [`import requests`, ``, `respuesta = requests.${e.metodo.toLowerCase()}(`, ...args.map((a) => `    ${a},`), `)`, `print(respuesta.json())`].join("\n");
}

function pythonLiteral(v: unknown): string {
  return JSON.stringify(v, null, 4).replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None");
}

// ---------------------------------------------------------------------------
// OpenAPI y Postman
// ---------------------------------------------------------------------------

function esquemaDe(tipo: string): Record<string, unknown> {
  if (tipo === "número") return { type: "number" };
  if (tipo === "booleano") return { type: "boolean" };
  if (tipo === "lista") return { type: "array", items: { type: "string" } };
  if (tipo === "objeto") return { type: "object" };
  if (tipo === "fecha ISO") return { type: "string", format: "date-time" };
  return { type: "string" };
}

export function openApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const ruta = e.ruta === "/" ? "/" : e.ruta;
    const operacion: Record<string, unknown> = {
      tags: [e.grupo],
      summary: e.resumen,
      ...(e.detalle ? { description: e.detalle + (e.permiso ? `\n\nPermiso requerido: \`${e.permiso}\`.` : "") } : e.permiso ? { description: `Permiso requerido: \`${e.permiso}\`.` } : {}),
      operationId: e.id,
      parameters: (e.parametros ?? []).map((p) => ({
        name: p.nombre,
        in: e.ruta.includes(`{${p.nombre}}`) ? "path" : "query",
        required: e.ruta.includes(`{${p.nombre}}`) ? true : !!p.obligatorio,
        description: p.detalle,
        schema: esquemaDe(p.tipo),
      })),
      responses: {
        [String(e.estado ?? 200)]: { description: "Éxito", content: { "application/json": { example: e.ejemploRespuesta } } },
        "401": { description: "Llave inválida, vencida o ausente" },
        "403": { description: "Sin permiso, módulo no incluido o cuenta sin plan activo" },
        "429": { description: "Límite de peticiones por minuto superado" },
      },
    };
    if (e.cuerpo) {
      operacion.requestBody = {
        required: e.cuerpo.some((c) => c.obligatorio),
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: e.cuerpo.filter((c) => c.obligatorio).map((c) => c.nombre),
              properties: Object.fromEntries(e.cuerpo.map((c) => [c.nombre, { ...esquemaDe(c.tipo), description: c.detalle }])),
            },
            ...(e.ejemploCuerpo ? { example: e.ejemploCuerpo } : {}),
          },
        },
      };
    }
    (paths[ruta] ??= {})[e.metodo.toLowerCase()] = operacion;
  }
  return {
    openapi: "3.0.3",
    info: { title: "API de Bybluee CRM", version: "1.0.0", description: "Envía mensajes de WhatsApp, gestiona contactos, etiquetas, conversaciones y campañas desde tus propias aplicaciones." },
    servers: [{ url: URL_BASE }],
    security: [{ llave: [] }],
    components: { securitySchemes: { llave: { type: "http", scheme: "bearer", description: "Tu llave de API (bbl_live_…)." } } },
    paths,
  };
}

export function coleccionPostman(): Record<string, unknown> {
  const grupos = [...new Set(ENDPOINTS.map((e) => e.grupo))];
  return {
    info: { name: "API de Bybluee CRM", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{llave}}", type: "string" }] },
    variable: [
      { key: "llave", value: "TU_LLAVE" },
      { key: "base", value: URL_BASE },
    ],
    item: grupos.map((g) => ({
      name: g,
      item: ENDPOINTS.filter((e) => e.grupo === g).map((e) => ({
        name: `${e.resumen}`,
        request: {
          method: e.metodo,
          header: e.ejemploCuerpo ? [{ key: "Content-Type", value: "application/json" }] : [],
          url: { raw: `{{base}}${e.ruta === "/" ? "" : rutaDeEjemplo(e.ruta)}`, host: ["{{base}}"], path: (e.ruta === "/" ? "" : rutaDeEjemplo(e.ruta)).split("/").filter(Boolean) },
          ...(e.ejemploCuerpo ? { body: { mode: "raw", raw: JSON.stringify(e.ejemploCuerpo, null, 2), options: { raw: { language: "json" } } } } : {}),
          description: e.detalle ?? e.resumen,
        },
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Verificacion de la firma de los webhooks (ejemplos para copiar)
// ---------------------------------------------------------------------------

export const FIRMA_NODE = `import { createHmac, timingSafeEqual } from "node:crypto";

// cuerpoCrudo: el texto EXACTO que llegó (antes de convertirlo a JSON).
export function esValido(cuerpoCrudo, cabeceraFirma, secreto) {
  const partes = Object.fromEntries(cabeceraFirma.split(",").map((p) => p.split("=")));
  const t = Number(partes.t);
  // Rechaza avisos viejos (más de 5 minutos) para evitar que los repitan.
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;
  const esperada = createHmac("sha256", secreto).update(\`\${t}.\${cuerpoCrudo}\`).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(partes.v1 ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}`;

export const FIRMA_PYTHON = `import hashlib, hmac, time

def es_valido(cuerpo_crudo: bytes, cabecera_firma: str, secreto: str) -> bool:
    partes = dict(p.split("=", 1) for p in cabecera_firma.split(","))
    t = int(partes["t"])
    # Rechaza avisos viejos (más de 5 minutos) para evitar que los repitan.
    if abs(time.time() - t) > 300:
        return False
    esperada = hmac.new(secreto.encode(), f"{t}.".encode() + cuerpo_crudo, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperada, partes.get("v1", ""))`;

export const EJEMPLO_AVISO = {
  id: "d3b07384-d9a1-4c2e-8f6b-0a1b2c3d4e5f",
  evento: "mensaje.recibido",
  creado_el: "2026-10-21T15:06:00.000Z",
  datos: {
    id: "wamid.HBgMNTczMDAxMjM0NTY3FQIAEhgUM0E",
    direccion: "entrante",
    tipo: "text",
    texto: "Hola, quiero cotizar",
    estado: null,
    contacto_id: contacto.id,
    telefono: "573001234567",
    conversacion_id: conversacion.id,
    creado_el: "2026-10-21T15:06:00.000Z",
  },
};

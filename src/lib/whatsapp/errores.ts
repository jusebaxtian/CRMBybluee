/**
 * Traduce los errores de Meta a español claro, con la causa y qué hacer.
 *
 * Meta responde en inglés, con códigos y enlaces larguísimos ("Message failed
 * to send because your WhatsApp Business account currency is not configured.
 * Visit https://business.facebook.com/billing_hub/..."). Aquí se convierte en
 * una frase que el dueño del negocio entiende y puede accionar.
 *
 * Se usa en dos sitios: los avisos de entrega que llegan por webhook
 * (ingest.ts) y cualquier llamada a la API de Meta que falle (graph.ts:
 * enviar, crear plantillas, conectar la línea).
 */

export type ErrorMeta = {
  code?: number;
  error_subcode?: number;
  title?: string;
  message?: string;
  error_user_title?: string;
  error_user_msg?: string;
  error_data?: { details?: string };
};

/** Códigos con traducción propia. Vistos en producción salvo donde se indica. */
const POR_CODIGO: Record<number, string> = {
  // --- Ventana de 24 horas -------------------------------------------------
  131047:
    "Pasaron más de 24 horas desde el último mensaje del cliente. Para reabrir la conversación tienes que enviarle una plantilla aprobada.",
  131051: "Ese tipo de mensaje no se puede enviar por la API de WhatsApp.",

  // --- Destinatario --------------------------------------------------------
  131026:
    "el número no tiene WhatsApp, está mal escrito o no puede recibir mensajes. Revisa que sea un celular con código de país (ej: 573001234567).",
  131050:
    "Esta persona pidió no recibir más mensajes de marketing de tu negocio. Solo podrás escribirle si ella te escribe primero.",
  130472:
    "Este número está dentro de una prueba interna de WhatsApp que limita los mensajes de negocios. No es un problema de tu cuenta; vuelve a intentar más adelante.",

  // --- Límites y calidad ---------------------------------------------------
  131048:
    "Meta frenó el envío por límite de mensajes: tu número está enviando más de lo que permite su nivel actual, o ha recibido reportes. Baja el volumen, divide los envíos en varios días y responde los chats que llegan.",
  131049:
    "Meta bloqueó este mensaje de marketing para cuidar la experiencia del usuario (recibe demasiada publicidad). No es un problema de tu cuenta ni del CRM: espacia los envíos y varía el contenido.",
  130497:
    "Tu cuenta tiene restringido enviar mensajes a ese país. Revisa con Meta la configuración de tu cuenta de WhatsApp Business.",

  // --- Cuenta y facturación ------------------------------------------------
  131031:
    "Tu cuenta de WhatsApp Business está bloqueada por Meta. Casi siempre es un problema con el método de pago: entra a business.facebook.com → Facturación y pagos → Cuentas de pago y agrega una tarjeta nueva.",
  131042:
    "Falta configurar el pago en Meta: tu cuenta de WhatsApp Business no tiene moneda o método de pago, o quedó un cobro sin pagar. Entra a business.facebook.com → Facturación y pagos → Cuentas de pago, elige país y moneda (se elige una sola vez) y agrega una tarjeta de crédito habilitada para compras internacionales.",
  133000: "El número aún no está registrado en la API de WhatsApp. Vuelve a conectarlo desde Configuración.",
  133005: "El código de verificación (PIN) de dos pasos no es correcto.",
  133010: "El número no está registrado en la API de WhatsApp. Conéctalo de nuevo desde Configuración.",
  133016:
    "Meta está reintentando registrar tu número; espera unos minutos y vuelve a intentar. Si sigue, desconecta y conecta la línea otra vez.",

  // --- Plantillas ----------------------------------------------------------
  132000:
    "La plantilla espera otra cantidad de datos de los que se enviaron. Revisa las variables ({{1}}, {{2}}…) de la plantilla.",
  132001:
    "Esa plantilla no existe en la línea desde la que estás enviando. Recuerda que las plantillas pertenecen a la cuenta de WhatsApp de cada número: créala eligiendo esa línea, o envía desde la línea donde sí existe.",
  132005: "El texto de la plantilla es más largo de lo que permite WhatsApp. Acórtalo y vuelve a enviarla a aprobación.",
  132007: "El formato de la plantilla no cumple las reglas de Meta. Revisa el texto, las variables y los botones.",
  132012:
    "Falta el archivo del encabezado de la plantilla (imagen, video o documento). Abre la plantilla en el CRM y súbele el archivo del encabezado antes de enviarla.",
  132015: "La plantilla está pausada por Meta por baja calidad (mucha gente la reportó o la ignoró). Usa otra o mejora el mensaje.",
  132016: "La plantilla fue deshabilitada por Meta por baja calidad. Crea una nueva con otro mensaje.",
  132068: "El flujo asociado a la plantilla está bloqueado.",
  132069: "El flujo asociado a la plantilla ya no está disponible.",

  // --- Contenido y archivos ------------------------------------------------
  131053:
    "Formato de archivo no compatible, muy pesado, o Meta no logró descargarlo. Intenta con otro archivo (imágenes JPG/PNG, videos MP4).",
  131008: "Falta un dato obligatorio en el mensaje.",
  131009: "Un dato del mensaje no es válido. Revisa el número de teléfono y el contenido.",
  131052: "No se pudo descargar el archivo para enviarlo.",

  // --- Permisos y sesión ---------------------------------------------------
  190: "La conexión con Meta expiró. Vuelve a conectar tu WhatsApp desde Configuración.",
  200: "Tu cuenta de Meta no tiene permisos suficientes para esta acción. Revisa los permisos del negocio en Meta Business.",
  10: "Meta no permite esta acción con los permisos actuales de la app.",
  368: "Meta bloqueó temporalmente esta acción por actividad inusual. Espera un rato y vuelve a intentar.",

  // --- Genéricos -----------------------------------------------------------
  131000: "Meta tuvo un error interno al procesar el mensaje. Vuelve a intentar en unos minutos.",
  131016: "El servicio de WhatsApp de Meta no está disponible en este momento. Intenta de nuevo más tarde.",
  131021: "No puedes enviarte un mensaje a ti mismo: el número de destino es el mismo de la línea.",
  133: "Meta rechazó la solicitud. Vuelve a intentar en unos minutos.",
  135000:
    "Meta rechazó el mensaje sin dar un motivo específico. Suele pasar con plantillas mal formadas o datos que no coinciden: revisa la plantilla y sus variables.",
  80007: "Alcanzaste el límite de solicitudes a Meta por ahora. Espera unos minutos y vuelve a intentar.",
  4: "Alcanzaste el límite de solicitudes a Meta por ahora. Espera unos minutos y vuelve a intentar.",
};

/** Subcódigos (error_subcode) que merecen su propio mensaje. */
const POR_SUBCODIGO: Record<number, string> = {
  2388023:
    "Ese nombre de plantilla está bloqueado porque acabas de eliminar una con el mismo nombre. Meta reserva el nombre un tiempo: crea la plantilla con otro nombre (por ejemplo, agregándole _2).",
  2388339:
    "Esa cuenta de WhatsApp no acepta plantillas: el número fue movido a otra cuenta en Meta. Escríbenos a soporte para reasignar la línea.",
  2388042: "La plantilla ya existe con ese nombre e idioma. Usa otro nombre o edita la existente.",
  3441034:
    "Ese número no se puede conectar: ya está usado en la app de WhatsApp o en otra cuenta de WhatsApp Business. Debes borrarlo de la app (o liberarlo de la otra cuenta) antes de conectarlo.",
  3441038:
    "Ese número pertenece a otro portafolio de negocios en Meta. Pídele al dueño de esa cuenta que lo libere, o conéctalo desde ese mismo portafolio.",
};

/** Frases en inglés de Meta que aparecen sin código útil. */
const POR_TEXTO: { busca: RegExp; texto: string }[] = [
  {
    busca: /currency is not configured/i,
    texto: POR_CODIGO[131042],
  },
  {
    busca: /unsettled payments/i,
    texto:
      "Tu cuenta de WhatsApp Business tiene cobros pendientes de pago en Meta. Entra a business.facebook.com → Facturación y pagos, paga el saldo y agrega un método de pago válido.",
  },
  {
    busca: /no payment method is set up/i,
    texto:
      "Tu cuenta de WhatsApp Business no tiene método de pago. Entra a business.facebook.com → Facturación y pagos → Cuentas de pago y agrega una tarjeta.",
  },
  {
    busca: /errors? related to your payment method/i,
    texto:
      "Meta no pudo cobrar con tu método de pago (tarjeta vencida, sin cupo o rechazada). Agrega una tarjeta nueva en business.facebook.com → Facturación y pagos.",
  },
  {
    busca: /restrictions on how many messages can be sent from this phone number/i,
    texto: POR_CODIGO[131048],
  },
  {
    busca: /part of an experiment/i,
    texto: POR_CODIGO[130472],
  },
  {
    busca: /stop receiving marketing messages/i,
    texto: POR_CODIGO[131050],
  },
  {
    busca: /maintain a healthy ecosystem engagement/i,
    texto: POR_CODIGO[131049],
  },
  {
    busca: /header component parameter should not be empty/i,
    texto: POR_CODIGO[132012],
  },
  {
    busca: /does not exist in (es|en)/i,
    texto: POR_CODIGO[132001],
  },
  {
    busca: /Invalid OAuth access token|Session has expired|access token/i,
    texto: POR_CODIGO[190],
  },
  {
    busca: /Business Solution Provider/i,
    texto: "Esta acción no está disponible con los permisos actuales de la app de Meta.",
  },
  {
    busca: /rate limit|too many calls/i,
    texto: POR_CODIGO[80007],
  },
];

/**
 * Devuelve el error en español. Si no hay traducción, deja el texto original
 * de Meta (sin el enlace gigante) para no perder información.
 */
export function traducirErrorMeta(error: ErrorMeta | null | undefined): string {
  if (!error) return "No se pudo completar la acción en WhatsApp.";

  if (error.error_subcode && POR_SUBCODIGO[error.error_subcode]) return POR_SUBCODIGO[error.error_subcode];
  if (error.code && POR_CODIGO[error.code]) return POR_CODIGO[error.code];

  const crudo = [error.error_user_msg, error.error_data?.details, error.message, error.title]
    .filter(Boolean)
    .join(" · ");
  for (const { busca, texto } of POR_TEXTO) {
    if (busca.test(crudo)) return texto;
  }

  // Sin traducción: se deja el texto de Meta pero sin URLs kilométricas.
  const limpio = crudo.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
  return limpio || "No se pudo completar la acción en WhatsApp.";
}

/** Igual, pero anteponiendo "No se pudo enviar:" para avisos de entrega. */
export function traducirErrorEnvio(error: ErrorMeta): string {
  return `No se pudo enviar: ${traducirErrorMeta(error)}`;
}

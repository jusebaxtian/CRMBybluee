import {
  Inbox,
  Users,
  Megaphone,
  Zap,
  UserCog,
  FileCheck2,
  PlugZap,
  LayoutDashboard,
  Rocket,
  Bot,
  MousePointerClick,
} from "lucide-react";

export const features = [
  {
    icon: Inbox,
    title: "Bandeja unificada",
    text: "Todas tus conversaciones de WhatsApp en un solo lugar, con estado de entrega y lectura en tiempo real.",
  },
  {
    icon: Users,
    title: "Contactos y etiquetas",
    text: "Organiza a tus clientes por etiquetas, notas y segmentos — sabes exactamente quién es quién.",
  },
  {
    icon: Megaphone,
    title: "Campañas masivas",
    text: "Envía plantillas aprobadas por Meta a miles de contactos, respetando los límites oficiales de WhatsApp.",
  },
  {
    icon: Zap,
    title: "Automatizaciones",
    text: "Flujos que responden solos por etiqueta o palabra clave, con esperas configurables y reparto entre agentes.",
  },
  {
    icon: Bot,
    title: "Agente de IA",
    text: "Si un cliente no responde, la IA redacta y envía el seguimiento por su cuenta, con el tono y enfoque que tú le definas. Lo pausas cuando quieras.",
  },
  {
    icon: MousePointerClick,
    title: "Plantillas con botones",
    text: "Crea plantillas aprobadas por Meta con botones de enlace o respuesta rápida, y automatiza lo que pasa cuando el cliente los toca.",
  },
  {
    icon: UserCog,
    title: "Agentes de respuesta",
    text: "Crea usuarios que solo ven y responden las conversaciones que les asignes — ideal para equipos de ventas.",
  },
  {
    icon: FileCheck2,
    title: "Plantillas aprobadas",
    text: "Sincroniza y reutiliza tus plantillas de Meta para reabrir conversaciones fuera de la ventana de 24 horas.",
  },
];

export const steps = [
  {
    icon: PlugZap,
    title: "Conectas tu número",
    text: "Vinculas tu WhatsApp Business con la API oficial de Meta en minutos, directo desde tu panel.",
  },
  {
    icon: LayoutDashboard,
    title: "Organizas tus conversaciones",
    text: "Cada chat se organiza con etiquetas, contactos y notas — ves de un vistazo en qué va cada cliente.",
  },
  {
    icon: Rocket,
    title: "Automatizas y escalas",
    text: "Activas seguimientos automáticos, sumas agentes de respuesta y llegas a más clientes sin perder el control.",
  },
];

export const includedItems = [
  "Bandeja unificada de WhatsApp",
  "CRM de contactos y etiquetas",
  "Automatizaciones configurables",
  "Campañas masivas con plantillas",
  "Agentes de respuesta por rol",
  "Plantillas aprobadas por Meta",
  "Panel de control completo",
  "Soporte por WhatsApp",
];

export const painPoints = [
  "No tienes tiempo para responder todos los mensajes a mano",
  "Pierdes clientes porque no hay seguimiento organizado",
  "Tu equipo no sabe quién ya habló con cada contacto",
  "Enviar novedades a toda tu base es un trabajo manual",
];

const baseFeatures = [
  "Bandeja unificada de WhatsApp",
  "Contactos y etiquetas",
  "Campañas masivas con plantillas",
  "Automatizaciones y seguimientos",
  "Respuestas rápidas",
  "Plantillas aprobadas por Meta, con botones",
];

// Real per-plan differences — keep in sync with plans.max_agents and
// plan_modules (ai_agent / reports) in the database.
export function getPlanFeatures(planName: string): string[] {
  const name = planName.toLowerCase();

  if (name.includes("inicial")) {
    return baseFeatures;
  }

  if (name.includes("semestral")) {
    return [
      ...baseFeatures,
      "Agente de IA con seguimiento automático",
      "Reportes",
      "Agentes de respuesta ilimitados",
      "Acompañamiento personalizado",
    ];
  }

  // Pro (or any other plan) — includes AI + reports + up to 3 agents.
  return [
    ...baseFeatures,
    "Agente de IA con seguimiento automático",
    "Reportes",
    "Hasta 3 agentes de respuesta",
  ];
}

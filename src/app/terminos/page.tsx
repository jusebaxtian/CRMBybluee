import Link from "next/link";

export const metadata = {
  title: "Términos y condiciones — ByBluee",
};

export default function TermsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-16 text-foreground">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Volver a ByBluee
      </Link>

      <h1 className="mt-6 text-3xl font-semibold">Términos y condiciones</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: agosto de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. El servicio</h2>
          <p>
            ByBluee (&quot;CRM Bybluee&quot;) es una plataforma de gestión de conversaciones,
            contactos y campañas a través de WhatsApp Business Cloud API, ofrecida por
            suscripción mensual o anual. Al crear una cuenta aceptas estos términos.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Cuenta y plan</h2>
          <p>
            Cada cuenta (&quot;workspace&quot;) tiene un plan asociado que define los módulos
            disponibles (bandeja, campañas, automatizaciones, agente de IA, etc.) y sus límites.
            Ofrecemos un período de prueba gratuito de 7 días; al finalizar, se requiere una
            suscripción activa para conservar el acceso.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Conexión con WhatsApp Business (Meta)</h2>
          <p>
            Para usar el servicio, conectas tu propia cuenta de WhatsApp Business a través del
            proceso oficial de Meta (Embedded Signup). Eres responsable de cumplir las
            políticas comerciales y de mensajería de WhatsApp/Meta; ByBluee no es responsable de
            restricciones, suspensiones o límites de mensajería que Meta aplique a tu número.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Uso aceptable</h2>
          <p>
            No está permitido usar la plataforma para enviar mensajes no solicitados (spam),
            contenido ilegal, fraudulento o que viole las políticas de WhatsApp Business.
            Nos reservamos el derecho de suspender cuentas que incumplan esto.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Agente de inteligencia artificial</h2>
          <p>
            Si activas el módulo de agente de IA, conectas tu propia llave de API (OpenAI o
            Anthropic) bajo tu responsabilidad y costo con ese proveedor. ByBluee no genera ni
            controla el contenido específico de las respuestas del modelo, solo provee la
            integración con WhatsApp y el panel de configuración.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Pagos y cancelación</h2>
          <p>
            Los pagos se procesan mensual o anualmente según el plan elegido. Puedes cancelar tu
            suscripción en cualquier momento desde Facturación; el acceso se mantiene hasta el
            final del período ya pagado.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Datos y privacidad</h2>
          <p>
            El tratamiento de tus datos y los de tus contactos se rige por nuestra{" "}
            <Link href="/privacidad" className="text-primary hover:underline">
              Política de privacidad
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">8. Contacto</h2>
          <p>
            Para preguntas sobre estos términos, escríbenos a{" "}
            <a href="mailto:soporte@crmbybluee.blue" className="text-primary hover:underline">
              soporte@crmbybluee.blue
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

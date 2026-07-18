import Link from "next/link";

export const metadata = {
  title: "Política de privacidad — ByBluee",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-16 text-foreground">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Volver a ByBluee
      </Link>

      <h1 className="mt-6 text-3xl font-semibold">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: julio de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold">1. Quiénes somos</h2>
          <p>
            ByBluee (&quot;CRM Bybluee&quot;) es una plataforma de gestión de conversaciones y
            clientes a través de WhatsApp Business, dirigida a emprendedores, asesores y
            pequeñas y medianas empresas en Colombia.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">2. Datos que recopilamos</h2>
          <p>
            Cuando te registras y usas ByBluee, recopilamos: datos de la cuenta (nombre,
            correo electrónico, contraseña cifrada), datos del negocio (nombre de la empresa,
            plan contratado), datos de conexión con WhatsApp Business (número de teléfono,
            identificador de cuenta de WhatsApp Business, tokens de acceso proporcionados por
            Meta), y los datos de tus contactos y conversaciones que gestionas dentro de la
            plataforma (nombre, número de WhatsApp, mensajes, etiquetas y notas que tú mismo
            registras).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">3. Uso de los datos</h2>
          <p>
            Usamos estos datos exclusivamente para operar el servicio: mostrar tu bandeja de
            conversaciones, enviar y recibir mensajes de WhatsApp en tu nombre, gestionar tus
            contactos y campañas, procesar tu suscripción y pagos, y brindarte soporte técnico.
            No vendemos ni compartimos tus datos ni los de tus contactos con terceros para fines
            publicitarios.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">4. Integración con WhatsApp / Meta</h2>
          <p>
            ByBluee se conecta a la API de WhatsApp Business (Meta) mediante el proceso oficial
            de registro (Embedded Signup). Los mensajes que envías y recibes se transmiten a
            través de la infraestructura de Meta conforme a sus propias políticas. Puedes
            consultar la política de privacidad de Meta en{" "}
            <a
              href="https://www.facebook.com/privacy/policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              facebook.com/privacy/policy
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">5. Almacenamiento y seguridad</h2>
          <p>
            Los datos se almacenan en una infraestructura propia con cifrado en tránsito
            (HTTPS/TLS) y controles de acceso por cuenta (workspace). El acceso administrativo
            interno queda registrado con fines de auditoría.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">6. Tus derechos</h2>
          <p>
            Puedes solicitar la corrección o eliminación de tu cuenta y tus datos en cualquier
            momento escribiéndonos a{" "}
            <a
              href="mailto:soporte@crmbybluee.blue"
              className="text-primary hover:underline"
            >
              soporte@crmbybluee.blue
            </a>
            . Al eliminar tu cuenta, tus datos y los de tus contactos asociados se borran de
            forma permanente de nuestra plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">7. Contacto</h2>
          <p>
            Para preguntas sobre esta política de privacidad, escríbenos a{" "}
            <a
              href="mailto:soporte@crmbybluee.blue"
              className="text-primary hover:underline"
            >
              soporte@crmbybluee.blue
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

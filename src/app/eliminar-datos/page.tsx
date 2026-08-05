import Link from "next/link";

export const metadata = {
  title: "Eliminación de datos — ByBluee",
};

export default function DataDeletionPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-16 text-foreground">
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Volver a ByBluee
      </Link>

      <h1 className="mt-6 text-3xl font-semibold">Instrucciones para eliminar tus datos</h1>
      <p className="mt-2 text-sm text-muted">Última actualización: agosto de 2026</p>

      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground">
        <section>
          <p>
            Puedes solicitar la eliminación total de tu cuenta de ByBluee y de todos los datos
            asociados (contactos, conversaciones, campañas, plantillas y conexión con WhatsApp
            Business) en cualquier momento.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Cómo solicitarlo</h2>
          <p>
            Escríbenos a{" "}
            <a href="mailto:soporte@crmbybluee.blue" className="text-primary hover:underline">
              soporte@crmbybluee.blue
            </a>{" "}
            desde el correo asociado a tu cuenta, indicando el nombre de tu empresa/workspace y
            solicitando la eliminación de tus datos. Confirmamos la solicitud y procedemos en un
            plazo máximo de 30 días.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Qué se elimina</h2>
          <p>
            Al procesar tu solicitud, eliminamos de forma permanente: tu cuenta de usuario, la
            información de tu workspace, todos los contactos y conversaciones registrados, el
            historial de mensajes, campañas, plantillas, automatizaciones, y cualquier archivo
            (imágenes, audios, documentos) almacenado en nuestra plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Desconexión de WhatsApp / Meta</h2>
          <p>
            La eliminación de tu cuenta también revoca el acceso de ByBluee a tu cuenta de
            WhatsApp Business conectada. Si además quieres eliminar tus datos directamente desde
            Meta, puedes hacerlo desde la configuración de tu cuenta de Facebook en{" "}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              facebook.com/settings?tab=applications
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Más información</h2>
          <p>
            Consulta también nuestra{" "}
            <Link href="/privacidad" className="text-primary hover:underline">
              Política de privacidad
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

import { TemplatePreview } from "@/components/templates/template-preview";
import { textoConVariables, type OrigenDeVariable } from "@/lib/whatsapp/vista-previa";

/** Lo que hace falta de una plantilla para mostrar como se vera. Todo opcional: una pagina que no cargue algo sigue funcionando. */
export type PlantillaParaVista = {
  id: string;
  meta_template_name: string;
  language?: string;
  body_text?: string | null;
  header_format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  header_text?: string | null;
  header_media_url?: string | null;
  buttons?: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[] | null;
  variables_origen?: OrigenDeVariable[] | null;
};

/**
 * Vista previa de la plantilla elegida, justo debajo del selector: asi se ve que se va a
 * enviar (encabezado, texto y botones) sin ir a Plantillas a buscarla. Las variables salen
 * como [Nombre], [Variable 2]... segun con que dato se rellenan al enviar.
 */
export function VistaPreviaPlantilla({ plantilla, className = "" }: { plantilla?: PlantillaParaVista | null; className?: string }) {
  if (!plantilla) return null;
  if (!plantilla.body_text && !plantilla.header_format) return null;
  return (
    <div className={`max-h-72 overflow-y-auto ${className}`}>
      <p className="mb-1 text-[11px] font-medium text-muted">
        Vista previa · {plantilla.meta_template_name}
        {plantilla.language ? ` (${plantilla.language})` : ""}
      </p>
      <TemplatePreview
        headerFormat={plantilla.header_format ?? null}
        headerText={plantilla.header_text ?? null}
        headerMediaUrl={plantilla.header_media_url ?? null}
        bodyText={textoConVariables(plantilla.body_text, plantilla.variables_origen)}
        buttons={plantilla.buttons ?? null}
      />
    </div>
  );
}

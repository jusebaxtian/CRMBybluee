/**
 * Nombre de plantilla como lo exige Meta: minusculas, numeros y guion bajo,
 * sin espacios ni tildes, maximo 512 caracteres. Se aplica mientras la
 * persona escribe (espacio -> _, "Promoción Verano" -> "promocion_verano") y
 * se vuelve a aplicar en el servidor por si acaso.
 *
 * Deja pasar un "_" final mientras se escribe (si no, al teclear un espacio
 * para seguir con otra palabra desapareceria); el servidor lo recorta con
 * `final: true` antes de guardar.
 */
export function normalizarNombrePlantilla(entrada: string, opciones: { final?: boolean } = {}): string {
  const limpio = entrada
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes y diéresis
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[\s-]+/g, "_") // espacios y guiones -> _
    .replace(/[^a-z0-9_]/g, "") // cualquier otra cosa se descarta
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 512);
  return opciones.final ? limpio.replace(/_+$/, "") : limpio;
}

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/**
 * Telefono del registro: selector de pais + numero local, guardado en E.164.
 *
 * La lista de paises e indicativos sale de libphonenumber-js (la misma base
 * que usa Google), no de una lista escrita a mano. Los nombres en español
 * los da Intl.DisplayNames, disponible en el navegador y en Node.
 */
export type Pais = {
  iso: CountryCode;
  nombre: string;
  indicativo: string; // "+57"
  bandera: string; // 🇨🇴 (emoji; Windows no lo dibuja, por eso la UI usa banderaUrl)
  banderaUrl: string; // imagen PNG de flagcdn.com
};

export const PAIS_POR_DEFECTO: CountryCode = "CO";

function banderaDe(iso: string): string {
  // Cada letra ISO se convierte en su "regional indicator" Unicode.
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

let cache: Pais[] | null = null;

export function listaDePaises(): Pais[] {
  if (cache) return cache;
  const nombres = new Intl.DisplayNames(["es"], { type: "region" });
  cache = getCountries()
    .map((iso) => ({
      iso,
      nombre: nombres.of(iso) ?? iso,
      indicativo: `+${getCountryCallingCode(iso)}`,
      bandera: banderaDe(iso),
      banderaUrl: `https://flagcdn.com/w40/${iso.toLowerCase()}.png`,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return cache;
}

export type TelefonoCompuesto = {
  /** "+57" */
  countryCode: string;
  /** "3001234567" tal como lo escribio la persona, solo digitos */
  local: string;
  /** "+573001234567" */
  e164: string;
  /** "573001234567": lo que espera WhatsApp y workspaces.phone */
  digitos: string;
};

/**
 * Valida el numero local contra las reglas del pais elegido y devuelve las
 * tres formas que se guardan. null si el numero no es valido para ese pais.
 */
export function componerTelefono(iso: string, local: string): TelefonoCompuesto | null {
  const codigo = iso.toUpperCase() as CountryCode;
  const soloDigitos = local.replace(/\D/g, "");
  if (!soloDigitos) return null;
  let parsed;
  try {
    parsed = parsePhoneNumberFromString(soloDigitos, codigo);
  } catch {
    return null;
  }
  if (!parsed || !parsed.isValid() || parsed.country !== codigo) return null;
  const e164 = parsed.number; // "+573001234567"
  return {
    countryCode: `+${parsed.countryCallingCode}`,
    local: parsed.nationalNumber,
    e164,
    digitos: e164.slice(1),
  };
}

/**
 * Recuperacion de contraseña por correo: desactivada porque la plataforma no
 * tiene SMTP (decision del 14 sep 2026). Se reemplaza por el codigo por
 * WhatsApp; mientras tanto, el cliente escribe a soporte y el admin cambia la
 * clave desde Admin. Con false, el login no muestra el enlace y /recuperar y
 * /restablecer responden 404.
 */
export const RECUPERACION_POR_CORREO = false;

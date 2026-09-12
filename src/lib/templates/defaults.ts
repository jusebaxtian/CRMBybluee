/**
 * Categoria con la que se abre el formulario de plantilla nueva.
 *
 * Era "UTILITY", escrito por separado en el formulario, en su reset y en los
 * dos puntos del servidor que lo leen. Casi todas las plantillas que crean
 * los clientes son de marketing, asi que cada una arrancaba con la categoria
 * equivocada y habia que cambiarla a mano. Una sola definicion para que el
 * formulario y el servidor no puedan volver a discrepar.
 *
 * Solo afecta al valor inicial del formulario: las plantillas existentes
 * conservan su categoria y el usuario puede elegir otra al crear.
 */
export const CATEGORIA_PLANTILLA_POR_DEFECTO = "MARKETING" as const;

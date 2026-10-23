/**
 * Los datos para pagar por transferencia: Nequi, Daviplata, Bre-B, llave y QR.
 *
 * Es el UNICO sitio donde viven. Antes estaban escritos a mano en la pantalla de
 * Facturacion, y cada servicio de pago tenia su propio texto en la base (uno
 * decia solo "Nequi: …", otro sumaba Bre-B), asi que dos pantallas le daban al
 * cliente datos distintos para pagarle a la misma persona. Facturacion y los
 * servicios de pago usan este componente.
 */
export function DatosDeTransferencia() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center">
      <div className="flex-1 text-xs text-muted">
        <p>Nequi: 316 623 0373</p>
        <p>Daviplata: 316 623 0373</p>
        <p>Bre-B: @3166230373</p>
        <p>Llave Nequi Negocios: 0093148895</p>
        <p>A nombre de: Ju** Tol**</p>
      </div>
      {/* QR para pagar desde el celular sin escribir datos. */}
      <a
        href="/qr-nequi.jpg"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex shrink-0 flex-col items-center gap-1"
        title="Abrir el QR en grande"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qr-nequi.jpg"
          alt="Código QR de Nequi / Bre-B para pagar"
          className="h-[132px] w-[132px] rounded-[10px] border border-border object-cover object-center transition group-hover:border-primary"
          style={{ objectPosition: "50% 41%" }}
        />
        <span className="text-[11px] text-muted group-hover:text-primary">Escanear QR</span>
      </a>
    </div>
  );
}

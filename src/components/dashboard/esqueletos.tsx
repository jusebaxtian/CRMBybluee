/**
 * Esqueletos de carga: mismo tamaño y radio que el contenido final, fondo
 * rgba(255,255,255,.05) como pide el diseño. Sin animacion llamativa; solo
 * ocupan el sitio para que la pantalla no salte al llegar los datos.
 */
function Hueso({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[6px] bg-dash-skeleton ${className}`} />;
}

export function EsqueletoTarjeta({ alto = "min-h-[238px]" }: { alto?: string }) {
  return (
    <div className={`rounded-[13px] border border-dash-border bg-dash-card p-[18px] ${alto}`}>
      <Hueso className="h-3 w-1/3" />
      <Hueso className="mt-4 h-8 w-1/2" />
      <Hueso className="mt-6 h-3 w-2/3" />
    </div>
  );
}

export function EsqueletoKpis() {
  return (
    <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-4 max-[1100px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[700px]:grid-cols-[minmax(0,1fr)]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-[13px] border border-dash-border bg-dash-card p-[18px]">
          <Hueso className="h-3 w-24" />
          <Hueso className="mt-3 h-[34px] w-16" />
          <Hueso className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoConexiones() {
  return (
    <div className="rounded-[15px] border border-dash-green-20 bg-[linear-gradient(180deg,var(--dash-green-7),rgba(27,168,74,0.02))] p-5">
      <Hueso className="h-4 w-56" />
      <div className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 max-[1100px]:grid-cols-[repeat(2,minmax(0,1fr))] max-[700px]:grid-cols-[minmax(0,1fr)]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[190px] rounded-[13px] border border-dash-border-soft bg-dash-card-nested" />
        ))}
      </div>
    </div>
  );
}

export function EsqueletoFila({ alto }: { alto: string }) {
  return <Hueso className={`w-full rounded-[13px] ${alto}`} />;
}

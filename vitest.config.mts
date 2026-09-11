import { defineConfig } from "vitest/config";

// Las pruebas de esta fase cubren logica pura (aislamiento entre inquilinos,
// sustitucion de variables, rangos de fecha). No renderizan React, asi que no
// hace falta jsdom ni testing-library: el entorno "node" corre mas rapido y
// deja menos piezas que mantener. Cuando haya que probar componentes se
// agrega el entorno de navegador, no antes.
export default defineConfig({
  // Resuelve el alias "@/..." leyendo tsconfig.json. Vite lo soporta de forma
  // nativa desde la v8, sin el plugin vite-tsconfig-paths.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});

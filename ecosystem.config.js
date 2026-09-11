// PRODUCCION. Dos procesos: el que atiende la web y los webhooks, y el que
// corre los trabajos de fondo.
//
// Estaban juntos, y por eso un reinicio del proceso web mataba el webhook que
// estuviera procesando: el mensaje entrante quedaba guardado pero no llegaban
// a correr las automatizaciones ni la IA. Paso el 7 de septiembre de 2026 con
// dos contactos que nunca recibieron su flujo de bienvenida.
//
// RUN_BACKGROUND_JOBS=0 apaga los intervalos en el proceso web. La variable
// viene encendida por defecto a proposito: si se olvida, corren los dos, que
// es derrochador pero inofensivo -- todos los trabajos reclaman su tarea de
// forma atomica. Al reves, olvidarla dejaria a los clientes sin mensajes.
//
// El reparto de memoria no es simetrico porque el riesgo no lo es. El que se
// dispara durante un envio masivo es el trabajador, y el que atiende a los
// clientes conviene que se reinicie antes y mas barato.
module.exports = {
  apps: [
    {
      name: "crm-bybluee",
      script: "npm",
      args: "start",
      cwd: "/opt/crm-bybluee",
      env: { RUN_BACKGROUND_JOBS: "0" },
      max_memory_restart: "800M",
      autorestart: true,
    },
    {
      name: "crm-bybluee-worker",
      script: "npm",
      args: "start",
      cwd: "/opt/crm-bybluee",
      // Sin RUN_BACKGROUND_JOBS: los trabajos corren aqui.
      //
      // Levanta un servidor Next completo del que nadie consume nada: nginx
      // solo enruta al proceso web. Es deliberado -- `next start` es lo que
      // dispara instrumentation.ts, y un segundo punto de entrada seria codigo
      // nuevo que mantener para ahorrar unos megas de RAM.
      env: {
        PORT: "3001",
        // Permite pedir un volcado de heap en caliente con
        // `kill -USR2 <pid>`. Sin esto habria que reiniciar el proceso con
        // otra bandera, y un reinicio borra justo el estado que se quiere
        // mirar.
        //
        // OJO: el .heapsnapshot se escribe en cwd, o sea dentro de
        // /opt/crm-bybluee, y durante una fuga puede pesar mas de 2 GB.
        // Moverlo a /opt/backups/ y borrarlo en cuanto se haya analizado.
        NODE_OPTIONS: "--heapsnapshot-signal=SIGUSR2",
      },
      max_memory_restart: "1200M",
      autorestart: true,
    },
  ],
};

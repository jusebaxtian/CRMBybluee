// pm2 arranca la app con `npm start` desde /opt/crm-bybluee.
//
// max_memory_restart existe porque el proceso crece hasta topar el limite de
// heap de Node (~2 GB) y ahi Node aborta de golpe, matando el webhook que
// estuviera procesando: el mensaje entrante queda guardado pero no llegan a
// correr las automatizaciones ni la IA. Reiniciando a 1200 MB pm2 lo baja
// limpiamente antes de ese punto.
//
// Es una mitigacion, no la cura: la fuga de memoria sigue ahi.
module.exports = {
  apps: [
    {
      name: "crm-bybluee",
      script: "npm",
      args: "start",
      cwd: "/opt/crm-bybluee",
      max_memory_restart: "1200M",
      autorestart: true,
    },
  ],
};

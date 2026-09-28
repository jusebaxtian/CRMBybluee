const sharp = require("sharp");

// Carta (8.5 pulgadas) a 300 dpi: Word la inserta a todo el ancho util.
const ANCHO = 2550;
const MARGEN = 60;
const VERDE = "#1ba84a";
const TINTA = "#13131c";
const GRIS = "#6b6b78";
const TIPO = "Segoe UI, Arial, Helvetica, sans-serif";

const svgEncabezado = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="360">
  <rect width="${ANCHO}" height="360" fill="#ffffff"/>
  <text x="430" y="170" font-family="${TIPO}" font-size="96" font-weight="700" fill="${TINTA}">Bybluee</text>
  <text x="434" y="238" font-family="${TIPO}" font-size="42" font-weight="600" fill="${VERDE}" letter-spacing="8">CRM</text>
  <rect x="0" y="330" width="${ANCHO}" height="14" fill="${VERDE}"/>
  <rect x="0" y="344" width="${ANCHO}" height="6" fill="${TINTA}"/>
</svg>`;

// El pie no lleva logo: a ese tamaño el robot se vuelve una mancha. Va la
// linea verde, el nombre y el dominio, con aire a los lados.
const svgPie = `
<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="170">
  <rect width="${ANCHO}" height="170" fill="#ffffff"/>
  <rect x="0" y="0" width="${ANCHO}" height="8" fill="${VERDE}"/>
  <text x="${MARGEN}" y="110" font-family="${TIPO}" font-size="46" font-weight="700" fill="${TINTA}">Bybluee<tspan dx="22" fill="${VERDE}" font-weight="600">CRM</tspan></text>
  <text x="${ANCHO - MARGEN}" y="110" text-anchor="end" font-family="${TIPO}" font-size="40" fill="${GRIS}">crmbybluee.blue</text>
</svg>`;

(async () => {
  const logo = await sharp("public/logo.png").resize(260, 260).toBuffer();

  await sharp(Buffer.from(svgEncabezado))
    .composite([{ input: logo, top: 40, left: 120 }])
    .png()
    .withMetadata({ density: 300 })
    .toFile("marca/bybluee-encabezado.png");

  await sharp(Buffer.from(svgPie))
    .png()
    .withMetadata({ density: 300 })
    .toFile("marca/bybluee-pie.png");

  console.log("listo");
})();

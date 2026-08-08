import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const LARGURA_CAPTURA = 1400;

/** Converte qualquer cor CSS (incl. oklch) para hex, que o jsPDF entende. */
function paraHex(cor: string): string {
  const fallback = "#ffffff";
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return fallback;
  }
}

async function capturar(el: HTMLElement, fundo: string) {
  return html2canvas(el, {
    scale: 2,
    backgroundColor: fundo,
    useCORS: true,
    logging: false,
    windowWidth: LARGURA_CAPTURA,
  });
}


/**
 * Exporta um elemento como PDF A4 paisagem, sem margens.
 * Se o elemento tiver filhos marcados com [data-pdf-page], cada um vira
 * uma página inteira, ajustada para caber (evitando quebras no meio do conteúdo).
 */
export async function exportarElementoParaPdf(el: HTMLElement, nomeArquivo: string) {
  const fundo = getComputedStyle(document.body).backgroundColor || "#ffffff";
  el.classList.add("pdf-exportando");

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();

  try {
    const blocos = Array.from(el.querySelectorAll<HTMLElement>("[data-pdf-page]"));
    let pagina = 0;

    if (blocos.length > 0) {
      for (const bloco of blocos) {
        const canvas = await capturar(bloco, fundo);
        const escala = Math.min(larguraPagina / canvas.width, alturaPagina / canvas.height);
        const largura = canvas.width * escala;
        const altura = canvas.height * escala;

        if (pagina > 0) pdf.addPage();
        pdf.setFillColor(fundo);
        pdf.rect(0, 0, larguraPagina, alturaPagina, "F");
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.94),
          "JPEG",
          (larguraPagina - largura) / 2,
          0,
          largura,
          altura,
        );
        pagina += 1;
      }
    } else {
      const canvas = await capturar(el, fundo);
      const escala = larguraPagina / canvas.width;
      const alturaFatiaPx = Math.floor(alturaPagina / escala);
      let y = 0;

      while (y < canvas.height) {
        const alturaFatia = Math.min(alturaFatiaPx, canvas.height - y);
        const fatia = document.createElement("canvas");
        fatia.width = canvas.width;
        fatia.height = alturaFatia;
        const ctx = fatia.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, fatia.width, fatia.height);
        ctx.drawImage(canvas, 0, y, canvas.width, alturaFatia, 0, 0, canvas.width, alturaFatia);

        if (pagina > 0) pdf.addPage();
        pdf.addImage(
          fatia.toDataURL("image/jpeg", 0.94),
          "JPEG",
          0,
          0,
          larguraPagina,
          alturaFatia * escala,
        );
        y += alturaFatia;
        pagina += 1;
      }
    }

    pdf.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
  } finally {
    el.classList.remove("pdf-exportando");
  }
}

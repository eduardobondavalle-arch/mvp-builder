import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/**
 * Captura um elemento do app e gera um PDF A4 retrato paginado,
 * preservando o layout visual da interface.
 */
export async function exportarElementoParaPdf(el: HTMLElement, nomeArquivo: string) {
  const fundo = getComputedStyle(document.body).backgroundColor || "#ffffff";

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: fundo,
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();

  const margem = 18;
  const larguraUtil = larguraPagina - margem * 2;
  const escala = larguraUtil / canvas.width;
  const alturaUtil = alturaPagina - margem * 2;
  const alturaFatiaPx = Math.floor(alturaUtil / escala);

  let y = 0;
  let pagina = 0;

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
      margem,
      margem,
      larguraUtil,
      alturaFatia * escala,
    );

    y += alturaFatia;
    pagina += 1;
  }

  pdf.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
}

import { jsPDF } from "jspdf";

const PAGE_WIDTH = 576;
const PAGE_HEIGHT = 792;
const MARGIN = 34;
const INK = [10, 37, 59];
const BLUE = [14, 101, 174];
const TEAL = [21, 113, 110];
const AMBER = [167, 96, 13];
const MUTED = [73, 88, 101];
const RULE = [211, 219, 225];
const PALE = [242, 246, 248];

function fill(pdf, color) { pdf.setFillColor(...color); }
function stroke(pdf, color) { pdf.setDrawColor(...color); }
function ink(pdf, color = INK) { pdf.setTextColor(...color); }
function font(pdf, size, weight = "normal") { pdf.setFont("helvetica", weight); pdf.setFontSize(size); }

function sectionTitle(pdf, title, y, number) {
  fill(pdf, BLUE);
  pdf.rect(MARGIN, y - 9, 3, 12, "F");
  font(pdf, 11, "bold");
  ink(pdf);
  pdf.text(title.toUpperCase(), MARGIN + 11, y);
  font(pdf, 7, "bold");
  ink(pdf, MUTED);
  pdf.text(number, PAGE_WIDTH - MARGIN, y, { align: "right" });
}

function fitLine(pdf, value, maxWidth, minSize = 9, startSize = 12) {
  let size = startSize;
  font(pdf, size, "bold");
  while (size > minSize && pdf.getTextWidth(value) > maxWidth) {
    size -= 0.5;
    font(pdf, size, "bold");
  }
  if (pdf.getTextWidth(value) <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length && pdf.getTextWidth(`${trimmed}...`) > maxWidth) trimmed = trimmed.slice(0, -1);
  return `${trimmed}...`;
}

function siteLabel(url) {
  return new URL(url).hostname.replace(/^www\./, "");
}

export function createReportPdf(model) {
  const pdf = new jsPDF({ unit: "pt", format: [PAGE_WIDTH, PAGE_HEIGHT], compress: false });
  pdf.setProperties({ title: `VPSF Home Evaluation - ${model.address}`, subject: "Printable VPSF home evaluation report", creator: "VPSF Calculator" });

  fill(pdf, INK);
  pdf.rect(0, 0, PAGE_WIDTH, 69, "F");
  fill(pdf, BLUE);
  pdf.rect(0, 66, PAGE_WIDTH, 3, "F");
  font(pdf, 25, "bold");
  ink(pdf, [255, 255, 255]);
  pdf.text("VPSF", MARGIN, 36);
  font(pdf, 8, "bold");
  pdf.text("VALUE PER SQUARE FOOT", MARGIN + 91, 33);
  ink(pdf, [240, 187, 69]);
  pdf.text("HOME EVALUATION REPORT", PAGE_WIDTH - MARGIN, 33, { align: "right" });
  font(pdf, 8);
  ink(pdf, [225, 233, 240]);
  pdf.text("PROPERTY PERFORMANCE  /  PRINT EDITION", PAGE_WIDTH - MARGIN, 49, { align: "right" });

  font(pdf, 8, "bold");
  ink(pdf, BLUE);
  pdf.text("ASSESSED PROPERTY", MARGIN, 88);
  ink(pdf);
  const address = String(model.address || "Property address not provided");
  font(pdf, 12, "bold");
  const addressWidth = PAGE_WIDTH - 2 * MARGIN;
  let addressLines = pdf.splitTextToSize(address, addressWidth);
  if (addressLines.length > 1) {
    font(pdf, 9, "bold");
    addressLines = pdf.splitTextToSize(address, addressWidth);
  }
  pdf.text(addressLines.slice(0, 2), MARGIN, addressLines.length > 1 ? 103 : 107, { lineHeightFactor: 1.15 });
  font(pdf, 8);
  ink(pdf, MUTED);
  pdf.text(model.facts || "Property details not supplied", MARGIN, 126);

  fill(pdf, PALE);
  pdf.roundedRect(MARGIN, 137, PAGE_WIDTH - 2 * MARGIN, 85, 4, 4, "F");
  font(pdf, 8, "bold");
  ink(pdf, MUTED);
  pdf.text("TOTAL VPSF SCORE", MARGIN + 15, 155);
  font(pdf, 34, "bold");
  ink(pdf);
  pdf.text(String(model.total), MARGIN + 15, 192);
  font(pdf, 9);
  ink(pdf, MUTED);
  pdf.text("/ 1,000", MARGIN + 90, 190);
  font(pdf, 9, "bold");
  ink(pdf, AMBER);
  pdf.text(String(model.rating).toUpperCase(), MARGIN + 15, 209);
  stroke(pdf, RULE);
  pdf.line(181, 152, 181, 207);
  font(pdf, 8, "bold");
  ink(pdf, BLUE);
  pdf.text("HOME EVALUATION OVERVIEW", 195, 155);
  font(pdf, 9);
  ink(pdf);
  const overviewLines = pdf.splitTextToSize(String(model.overview || ""), PAGE_WIDTH - 195 - MARGIN - 13).slice(0, 4);
  pdf.text(overviewLines, 195, 172, { lineHeightFactor: 1.28 });

  sectionTitle(pdf, "Performance highlights", 246, "01 / 03");
  model.highlights.slice(0, 3).forEach((highlight, index) => {
    const y = 264 + index * 17;
    fill(pdf, TEAL);
    pdf.circle(MARGIN + 4, y - 2, 2, "F");
    font(pdf, 9);
    ink(pdf);
    pdf.text(String(highlight), MARGIN + 14, y);
  });

  stroke(pdf, RULE);
  pdf.line(MARGIN, 312, PAGE_WIDTH - MARGIN, 312);
  sectionTitle(pdf, "Seven-pillar scorecard", 331, "02 / 03");
  font(pdf, 7, "bold");
  ink(pdf, MUTED);
  pdf.text("PILLAR", MARGIN, 349);
  pdf.text("SCORE / AVAILABLE", 395, 349);
  pdf.text("GRADE", PAGE_WIDTH - MARGIN, 349, { align: "right" });
  model.scores.slice(0, 7).forEach((score, index) => {
    const y = 371 + index * 22;
    font(pdf, 9, "bold");
    ink(pdf);
    pdf.text(score.label, MARGIN, y);
    fill(pdf, RULE);
    pdf.roundedRect(149, y - 7, 174, 6, 3, 3, "F");
    fill(pdf, BLUE);
    const barWidth = Math.max(0, Math.min(174, 174 * score.fraction));
    if (barWidth > 0) pdf.roundedRect(149, y - 7, barWidth, 6, Math.min(3, barWidth / 2), 3, "F");
    font(pdf, 9);
    ink(pdf);
    pdf.text(`${score.value} / ${score.max}`, 395, y);
    font(pdf, 9, "bold");
    pdf.text(score.grade, PAGE_WIDTH - MARGIN, y, { align: "right" });
    stroke(pdf, RULE);
    pdf.line(MARGIN, y + 7, PAGE_WIDTH - MARGIN, y + 7);
  });

  sectionTitle(pdf, "Products to investigate", 545, "03 / 03");
  font(pdf, 8);
  ink(pdf, MUTED);
  pdf.text("Selected from lower-scoring pillars; suitability and gains require verification.", MARGIN, 559);
  if (!model.products.length) {
    font(pdf, 9);
    ink(pdf);
    pdf.text("No verified product links available for this report.", MARGIN, 590);
  }
  model.products.slice(0, 3).forEach((product, index) => {
    const y = 583 + index * 43;
    stroke(pdf, RULE);
    pdf.line(MARGIN, y - 12, PAGE_WIDTH - MARGIN, y - 12);
    font(pdf, 9, "bold");
    ink(pdf);
    pdf.text(fitLine(pdf, product.name, 347, 8, 9), MARGIN, y);
    font(pdf, 8, "bold");
    ink(pdf, TEAL);
    pdf.text(product.pillar.toUpperCase(), PAGE_WIDTH - MARGIN, y, { align: "right" });
    font(pdf, 8);
    ink(pdf, MUTED);
    pdf.text(`${product.company}  |`, MARGIN, y + 15);
    const linkX = MARGIN + pdf.getTextWidth(`${product.company}  |`) + 6;
    const linkText = `Visit ${siteLabel(product.url)}`;
    ink(pdf, BLUE);
    pdf.text(linkText, linkX, y + 15);
    stroke(pdf, BLUE);
    pdf.line(linkX, y + 17, linkX + pdf.getTextWidth(linkText), y + 17);
    pdf.link(linkX, y + 5, pdf.getTextWidth(linkText), 13, { url: product.url });
  });

  stroke(pdf, RULE);
  pdf.line(MARGIN, 715, PAGE_WIDTH - MARGIN, 715);
  font(pdf, 7, "bold");
  ink(pdf, MUTED);
  pdf.text("METHOD & LIMITATIONS", MARGIN, 730);
  font(pdf, 7);
  const caveat = "Model-based score from available property details; not a certification. Market percentile, savings and CO2 reductions have not been calculated. Product performance depends on fit, installation and verification.";
  pdf.text(pdf.splitTextToSize(caveat, PAGE_WIDTH - 2 * MARGIN), MARGIN, 743, { lineHeightFactor: 1.25 });
  font(pdf, 7, "bold");
  ink(pdf, BLUE);
  pdf.text("VPSF  /  VALUE PER SQUARE FOOT", MARGIN, 778);
  ink(pdf, MUTED);
  pdf.text("1 / 1", PAGE_WIDTH - MARGIN, 778, { align: "right" });
  return pdf;
}

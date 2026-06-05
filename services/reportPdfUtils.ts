import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyProfile } from "../types";

export const reportColors = {
  blue: [0, 87, 163] as [number, number, number],
  navy: [40, 58, 86] as [number, number, number],
  text: [31, 41, 55] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  border: [209, 213, 219] as [number, number, number],
};

export const notProvided = (value: unknown): string => {
  const text = String(value ?? "").trim();
  return text || "Not provided";
};

export const cleanFilePart = (value: string) =>
  notProvided(value).replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "Report";

export const companyName = (profile: CompanyProfile | null | undefined, fallback?: string) =>
  notProvided(profile?.companyName || fallback);

export function addReportFooter(doc: jsPDF, label: string, margin = 15) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...reportColors.muted);
    doc.text(label, margin, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
}

export function drawCompanyHeader(doc: jsPDF, profile: CompanyProfile | null | undefined, title?: string, margin = 15) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoSize = 17;

  if (profile?.companyLogo) {
    try {
      doc.addImage(`data:image/png;base64,${profile.companyLogo}`, "PNG", margin, 12, logoSize, logoSize);
    } catch {
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin, 12, logoSize, logoSize, 1.5, 1.5, "F");
    }
  } else {
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin, 12, logoSize, logoSize, 1.5, 1.5, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...reportColors.text);
  doc.text(companyName(profile), margin + logoSize + 6, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...reportColors.muted);
  const detail = [profile?.address, profile?.website].filter(Boolean).join(" | ");
  if (detail) doc.text(detail, margin + logoSize + 6, 24, { maxWidth: pageWidth - margin * 2 - logoSize - 6 });
  if (title) doc.text(title, pageWidth - margin, 18, { align: "right" });
  doc.setDrawColor(...reportColors.border);
  doc.line(margin, 36, pageWidth - margin, 36);
}

export function sectionTitle(doc: jsPDF, title: string, y: number, margin = 15) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...reportColors.navy);
  doc.text(title, margin, y);
  return y + 8;
}

export function keyValueTable(doc: jsPDF, startY: number, rows: Array<[string, unknown]>, margin = 15) {
  autoTable(doc, {
    startY,
    body: rows.map(([label, value]) => [label, notProvided(value)]),
    theme: "grid",
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2.4, overflow: "linebreak", valign: "top" },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: "bold", fillColor: [248, 250, 252] },
      1: { cellWidth: "auto" },
    },
  });
  return ((doc as any).lastAutoTable?.finalY || startY) + 8;
}

export function addWrappedParagraph(doc: jsPDF, text: string, y: number, margin = 15, fontSize = 9.5) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...reportColors.text);
  const lines = doc.splitTextToSize(notProvided(text), pageWidth - margin * 2);
  doc.text(lines, margin, y);
  return y + lines.length * (fontSize * 0.42) + 5;
}

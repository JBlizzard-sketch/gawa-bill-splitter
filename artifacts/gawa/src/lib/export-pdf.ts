import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

function fmt(n: number) {
  return `Ksh ${new Intl.NumberFormat("en-KE").format(n)}`;
}

function statusLabel(s: string) {
  if (s === "paid") return "Paid";
  if (s === "requested") return "Requested";
  if (s === "failed") return "Failed";
  return "Pending";
}

export async function exportEventPdf(event: {
  id: number;
  title: string;
  description?: string | null;
  totalAmount: number;
  splitType: string;
  payerName: string;
  status: string;
  createdAt: string;
  participants: Array<{
    name: string;
    mpesaPhone: string;
    shareAmount: number;
    paymentStatus: string;
  }>;
}, shareUrl: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;

  // ── Header brand strip ────────────────────────────────────────────
  doc.setFillColor(34, 197, 94); // Gawa green
  doc.rect(0, 0, W, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("GAWA", margin, 14);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Split Bills · Send Mpesa", margin + 22, 14);

  // "RECEIPT" label right-aligned
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT", W - margin, 14, { align: "right" });

  // ── Event title block ─────────────────────────────────────────────
  let y = 32;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(event.title, margin, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const created = new Date(event.createdAt).toLocaleDateString("en-KE", {
    day: "numeric", month: "long", year: "numeric"
  });
  doc.text(`${created}  ·  Paid by ${event.payerName}  ·  ${event.splitType} split`, margin, y);

  if (event.description) {
    y += 5;
    doc.text(event.description, margin, y);
  }

  // ── Summary boxes ─────────────────────────────────────────────────
  y += 10;
  const boxW = (W - margin * 2 - 6) / 3;
  const boxes = [
    { label: "Total Amount", value: fmt(event.totalAmount) },
    { label: "Collected", value: fmt(event.participants.filter(p => p.paymentStatus === "paid").reduce((s, p) => s + p.shareAmount, 0)) },
    { label: "Outstanding", value: fmt(event.participants.filter(p => p.paymentStatus !== "paid").reduce((s, p) => s + p.shareAmount, 0)) },
  ];

  boxes.forEach((box, i) => {
    const x = margin + i * (boxW + 3);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(box.label.toUpperCase(), x + 4, y + 6);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(box.value, x + 4, y + 14);
  });

  // ── Participants table ────────────────────────────────────────────
  y += 26;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("Who owes what", margin, y);
  y += 2;

  const paidCount = event.participants.filter(p => p.paymentStatus === "paid").length;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Name", "M-Pesa Number", "Amount", "Status"]],
    body: event.participants.map(p => [
      p.name,
      p.mpesaPhone,
      fmt(p.shareAmount),
      statusLabel(p.paymentStatus),
    ]),
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [249, 252, 249] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 50 },
      2: { cellWidth: 35, halign: "right" },
      3: {
        cellWidth: 30,
        halign: "center",
        fontStyle: "bold",
      },
    },
    didDrawCell: (data) => {
      if (data.column.index === 3 && data.section === "body") {
        const status = event.participants[data.row.index]?.paymentStatus;
        if (status === "paid") {
          doc.setTextColor(34, 197, 94);
        } else if (status === "failed") {
          doc.setTextColor(239, 68, 68);
        } else {
          doc.setTextColor(150, 150, 150);
        }
      }
    },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section === "body") {
        const status = event.participants[data.row.index]?.paymentStatus;
        if (status === "paid") data.cell.styles.textColor = [34, 197, 94];
        else if (status === "failed") data.cell.styles.textColor = [239, 68, 68];
        else data.cell.styles.textColor = [150, 150, 150];
      }
    },
  });

  // ── QR code + footer ─────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  const footerY = finalY + 12;

  try {
    const qrDataUrl = await QRCode.toDataURL(shareUrl, {
      width: 128,
      margin: 1,
      color: { dark: "#141414", light: "#FFFFFF" },
    });
    const qrSize = 28;
    doc.addImage(qrDataUrl, "PNG", margin, footerY, qrSize, qrSize);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("Scan to view split", margin + qrSize + 4, footerY + 8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7.5);
    doc.text(shareUrl, margin + qrSize + 4, footerY + 14);
    doc.text(`${paidCount} of ${event.participants.length} participants paid`, margin + qrSize + 4, footerY + 20);
  } catch {
    // QR generation failed — skip silently
  }

  // Thin footer line
  const lineY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, lineY, W - margin, lineY);
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text("Generated by Gawa · Split Bills, Send Mpesa", margin, lineY + 5);
  doc.text(new Date().toLocaleString("en-KE"), W - margin, lineY + 5, { align: "right" });

  const filename = `gawa-${event.title.toLowerCase().replace(/\s+/g, "-")}-receipt.pdf`;
  doc.save(filename);
}

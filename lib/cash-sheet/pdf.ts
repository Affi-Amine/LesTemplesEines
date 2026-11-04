import PdfPrinter from "pdfmake"
import type { Content, TDocumentDefinitions, TableCell } from "pdfmake/interfaces"
import { formatInTimeZone } from "date-fns-tz"

import { TIMEZONE } from "@/lib/cash-sheet/build"
import { sumAmounts, VOUCHER_LABELS, type CashSheet } from "@/lib/cash-sheet/types"

// pdfmake ships Roboto as base64 in its browser bundle; the server printer
// takes the same bytes as Buffers, so no font file has to be deployed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfs = require("pdfmake/build/vfs_fonts.js") as Record<string, string> & { pdfMake?: { vfs: Record<string, string> } }
const files = vfs.pdfMake?.vfs || vfs
const font = (name: string) => Buffer.from(files[name], "base64")

const printer = new PdfPrinter({
  Roboto: {
    normal: font("Roboto-Regular.ttf"),
    bold: font("Roboto-Medium.ttf"),
    italics: font("Roboto-Italic.ttf"),
    bolditalics: font("Roboto-MediumItalic.ttf"),
  },
})

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

export function euros(cents: number) {
  const value = (cents / 100).toFixed(2).replace(".", ",")
  const [whole, decimals] = value.split(",")
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decimals}`
}

const cell = (cents: number) => (cents ? euros(cents) : "")

function longDate(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  const day = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${day} ${d} ${MONTHS[m - 1]} ${y}`
}

function shortDate(date: string) {
  const [y, m, d] = date.split("-")
  return `${d} / ${MONTHS[Number(m) - 1]} / ${y}`
}

function stamp(iso: string) {
  return formatInTimeZone(new Date(iso), TIMEZONE, "dd/MM/yyyy 'à' HH:mm")
}

/** Splits the address into street and "postcode city" the way the sheet prints it. */
function splitAddress(address: string, city: string) {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean)
  const street = parts[0] || address
  const postcode = address.match(/\b\d{5}\b/)?.[0] || ""
  const town = city || parts.slice(1).join(" ") || ""
  return { street: street.replace(/\b\d{5}\b/, "").trim(), town: [postcode, town.replace(/\b\d{5}\b/, "").trim()].filter(Boolean).join(" ") }
}

export function cashSheetFilename(sheet: CashSheet) {
  return `Feuille-de-caisse_${sheet.date}_${sheet.reference.split("-").at(-1)}.pdf`
}

export function renderCashSheetPdf(sheet: CashSheet): Promise<Buffer> {
  const { street, town } = splitAddress(sheet.salon.address, sheet.salon.city)
  const closed = Boolean(sheet.closedAt)
  const closureLabel = closed ? stamp(sheet.closedAt!) : "Aperçu — non clôturée"
  const cashTotal = sheet.totals.card + sheet.totals.cash
  const grandTotal = sumAmounts(sheet.totals)
  const footerAddress = [sheet.salon.name, `${street}, ${town}`].filter(Boolean).join(" - ")

  const header = (label: string, value: string): TableCell[] => [
    { text: label, color: "#555555" },
    { text: value, bold: true },
  ]

  const lineRows: TableCell[][] = sheet.lines.map((line) => {
    const muted = line.status !== "paid"
    const style = muted ? { color: "#777777", italics: true } : {}
    const client = line.status === "no_show" ? `${line.client} (absent)` : line.status === "unpaid" ? `${line.client} (non réglé)` : line.client
    return [
      { text: line.time, ...style },
      { text: client, ...style },
      { text: line.service, ...style },
      { text: cell(line.amounts.card), alignment: "right" },
      { text: cell(line.amounts.cash), alignment: "right" },
      { text: cell(line.amounts.treatwell), alignment: "right" },
      { text: cell(line.amounts.online), alignment: "right" },
      { text: cell(line.amounts.other), alignment: "right" },
      { text: line.vouchers.map((v) => VOUCHER_LABELS[v]).join(", "), ...style },
      { text: line.staff, ...style },
      { text: line.duration, alignment: "right", ...style },
    ]
  })
  if (!lineRows.length) lineRows.push([{ text: "Aucune prestation enregistrée ce jour.", colSpan: 11, italics: true, color: "#777777", alignment: "center" }, "", "", "", "", "", "", "", "", "", ""])

  const totalsRow: TableCell[] = [
    { text: "TOTAL JOURNÉE", colSpan: 3, bold: true, fillColor: "#eeeeee" }, "", "",
    { text: euros(sheet.totals.card), bold: true, alignment: "right", fillColor: "#eeeeee" },
    { text: euros(sheet.totals.cash), bold: true, alignment: "right", fillColor: "#eeeeee" },
    { text: euros(sheet.totals.treatwell), bold: true, alignment: "right", fillColor: "#eeeeee" },
    { text: euros(sheet.totals.online), bold: true, alignment: "right", fillColor: "#eeeeee" },
    { text: euros(sheet.totals.other), bold: true, alignment: "right", fillColor: "#eeeeee" },
    { text: "", fillColor: "#eeeeee" }, { text: "", fillColor: "#eeeeee" }, { text: "", fillColor: "#eeeeee" },
  ]

  const recap = (label: string, value: string, bold = false): TableCell[] => [
    { text: label, bold, fillColor: bold ? "#eeeeee" : undefined },
    { text: value, bold, alignment: "right", fillColor: bold ? "#eeeeee" : undefined },
  ]

  const content: Content[] = [
    { text: "FEUILLE DE CAISSE JOURNALIÈRE", style: "title" },
    { text: "Récapitulatif des prestations et des encaissements", style: "subtitle" },
    {
      columns: [
        {
          width: "*",
          table: {
            widths: [90, "*"],
            body: [
              header("Établissement", `${sheet.salon.name} – ${sheet.salon.city}`),
              header("Adresse", street),
              header("Code postal / Ville", town),
              header("Responsable", sheet.signerName || "—"),
            ],
          },
          layout: "lightHorizontalLines",
        },
        { width: 12, text: "" },
        {
          width: "*",
          table: {
            widths: [90, "*"],
            body: [
              header("Date", longDate(sheet.date)),
              header("Jour / Mois / Année", shortDate(sheet.date)),
              header("Clôture", closureLabel),
              header("Référence", sheet.reference),
            ],
          },
          layout: "lightHorizontalLines",
        },
      ],
      margin: [0, 10, 0, 12],
    },
    {
      table: {
        headerRows: 1,
        widths: [26, "*", "*", 32, 32, 30, 36, 32, 50, 50, 24],
        body: [
          ["Temps", "Client", "Prestation", "CB", "Esp.", "T/W", "En ligne", "Autre", "CC / Abo.", "Masseuse", "Heure"].map((text) => ({ text, bold: true, fillColor: "#eeeeee" })),
          ...lineRows,
          totalsRow,
        ],
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999999", vLineColor: () => "#999999", paddingTop: () => 3, paddingBottom: () => 3 },
      fontSize: 7.5,
    },
    { text: "RÉCAPITULATIF DES ENCAISSEMENTS", style: "section", margin: [0, 14, 0, 6] },
    {
      columns: [
        {
          width: "*",
          table: {
            widths: ["*", 70],
            body: [
              recap("Carte bancaire (CB)", `${euros(sheet.totals.card)} €`),
              recap("Espèces", `${euros(sheet.totals.cash)} €`),
              recap("TOTAL CAISSE (CB + Espèces)", `${euros(cashTotal)} €`, true),
              recap("Paiement en ligne (les-temples)", `${euros(sheet.totals.online)} €`),
              recap("Treatwell (T/W)", `${euros(sheet.totals.treatwell)} €`),
              recap("Autres moyens (chèque, sur place non précisé)", `${euros(sheet.totals.other)} €`),
              recap("TOTAL GÉNÉRAL (tous modes de paiement)", `${euros(grandTotal)} €`, true),
              recap("Carte cadeau utilisée (nombre de personnes)", String(sheet.counts.giftCards)),
              recap("Abonnement / forfait utilisé (nombre de personnes)", String(sheet.counts.packs)),
              recap("Carte tampon utilisée (nombre de personnes)", String(sheet.counts.stamps)),
              recap("Nombre de lignes enregistrées", String(sheet.counts.lines)),
              recap("Clients absents - No Show (nombre)", String(sheet.counts.noShows)),
              recap("Montant non encaissé (absences, hors total)", `${euros(sheet.noShowAmountCents)} €`),
              recap("Prestations non réglées (nombre / montant, hors total)", `${sheet.counts.unpaid} / ${euros(sheet.unpaidAmountCents)} €`),
            ],
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => "#999999", vLineColor: () => "#999999" },
          fontSize: 8.5,
        },
        { width: 12, text: "" },
        {
          width: 180,
          table: {
            widths: ["*"],
            heights: [14, 150, 30],
            body: [
              [{ text: "Signature du responsable", bold: true, fontSize: 8.5 }],
              [{ text: "" }],
              [{
                stack: [
                  { text: sheet.signerName || " ", bold: true, alignment: "center", fontSize: 9 },
                  { text: closed ? `Fait le ${stamp(sheet.closedAt!)}` : "Non clôturée", alignment: "center", fontSize: 7.5, color: "#555555" },
                ],
              }],
            ],
          },
          layout: { hLineWidth: (i: number) => (i === 2 ? 0.5 : i === 0 || i === 3 ? 0.5 : 0), vLineWidth: () => 0.5, hLineColor: () => "#999999", vLineColor: () => "#999999" },
        },
      ],
    },
    {
      text: "Les montants de ce document correspondent aux encaissements enregistrés dans le système à l’heure de la clôture. Une fois la clôture validée, la date, l’heure et les montants ne peuvent plus être modifiés. Les cartes cadeaux, forfaits et cartes tampon ne sont pas comptabilisés dans les montants en euros. Les absences (no show) et les prestations non réglées sont indiquées à titre d’information et ne sont pas incluses dans les totaux.",
      fontSize: 7,
      color: "#555555",
      margin: [0, 12, 0, 0],
    },
  ]

  const definition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [28, 32, 28, 40],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    info: { title: `Feuille de caisse ${sheet.reference}`, author: sheet.salon.name },
    styles: {
      title: { fontSize: 16, bold: true, alignment: "center" },
      subtitle: { fontSize: 9, alignment: "center", color: "#555555", margin: [0, 2, 0, 0] },
      section: { fontSize: 11, bold: true, alignment: "center" },
    },
    content,
    footer: (page, pages) => ({
      columns: [
        { text: footerAddress, fontSize: 7, color: "#555555" },
        { text: `Page ${page} / ${pages}`, fontSize: 7, color: "#555555", alignment: "right" },
      ],
      margin: [28, 14, 28, 0],
    }),
  }

  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(definition)
    const chunks: Buffer[] = []
    doc.on("data", (chunk: Buffer) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
    doc.end()
  })
}

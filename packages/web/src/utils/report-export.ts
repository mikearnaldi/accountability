/**
 * Report Export Utilities
 *
 * Provides functions for exporting financial reports to PDF and Excel formats,
 * as well as triggering browser print functionality.
 */

import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a row in a report table for export
 */
export interface ReportRow {
  readonly cells: readonly (string | number)[]
  readonly style?: "normal" | "header" | "subtotal" | "total"
}

/**
 * Represents a section in a report for export
 */
export interface ReportSection {
  readonly title: string
  readonly rows: readonly ReportRow[]
}

/**
 * Report metadata for export headers
 */
export interface ReportMetadata {
  readonly title: string
  readonly subtitle?: string
  readonly company?: string
  readonly asOfDate?: string
  readonly currency?: string
  readonly generatedAt?: string
}

/**
 * Configuration for table exports
 */
export interface TableExportConfig {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly (string | number)[])[]
  readonly metadata: ReportMetadata
  readonly columnWidths?: readonly number[]
}

// =============================================================================
// Excel Export
// =============================================================================

/**
 * Exports a report table to an Excel file
 */
export function exportToExcel(config: TableExportConfig, filename: string): void {
  const { headers, rows, metadata } = config

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()

  // Build data array starting with metadata rows
  const data: (string | number)[][] = []

  // Add title and metadata
  data.push([metadata.title])
  if (metadata.subtitle !== undefined) data.push([metadata.subtitle])
  if (metadata.company !== undefined) data.push([`Company: ${metadata.company}`])
  if (metadata.asOfDate !== undefined) data.push([`As of: ${metadata.asOfDate}`])
  if (metadata.currency !== undefined) data.push([`Currency: ${metadata.currency}`])
  data.push([]) // Empty row before data

  // Add headers
  data.push([...headers])

  // Add data rows
  for (const row of rows) {
    data.push([...row])
  }

  // Add generated timestamp
  data.push([])
  data.push([`Generated: ${metadata.generatedAt ?? new Date().toISOString()}`])

  // Create worksheet from data array
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Set column widths (default to auto)
  if (config.columnWidths !== undefined) {
    worksheet["!cols"] = config.columnWidths.map((w) => ({ wch: w }))
  } else {
    // Auto-calculate column widths based on content
    const colWidths = headers.map((header, colIndex) => {
      let maxWidth = header.length
      for (const row of rows) {
        const cellValue = row[colIndex]
        const cellLength = cellValue !== undefined ? String(cellValue).length : 0
        if (cellLength > maxWidth) maxWidth = cellLength
      }
      return { wch: Math.min(maxWidth + 2, 50) } // Cap at 50 characters
    })
    worksheet["!cols"] = colWidths
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report")

  // Generate and download file
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Exports a multi-section report to Excel
 */
export function exportMultiSectionToExcel(
  sections: readonly ReportSection[],
  metadata: ReportMetadata,
  filename: string
): void {
  const workbook = XLSX.utils.book_new()
  const data: (string | number)[][] = []

  // Add title and metadata
  data.push([metadata.title])
  if (metadata.subtitle !== undefined) data.push([metadata.subtitle])
  if (metadata.company !== undefined) data.push([`Company: ${metadata.company}`])
  if (metadata.asOfDate !== undefined) data.push([`As of: ${metadata.asOfDate}`])
  if (metadata.currency !== undefined) data.push([`Currency: ${metadata.currency}`])
  data.push([]) // Empty row before data

  // Add each section
  for (const section of sections) {
    data.push([section.title])
    for (const row of section.rows) {
      // Add indentation based on style
      const indent = row.style === "normal" ? "  " : ""
      const formattedCells = row.cells.map((cell, idx) =>
        idx === 0 && typeof cell === "string" ? `${indent}${cell}` : cell
      )
      data.push([...formattedCells])
    }
    data.push([]) // Empty row between sections
  }

  // Add generated timestamp
  data.push([`Generated: ${metadata.generatedAt ?? new Date().toISOString()}`])

  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Auto-calculate column widths
  const maxCols = Math.max(...sections.flatMap((s) => s.rows.map((r) => r.cells.length)))
  const colWidths = Array(maxCols)
    .fill(0)
    .map((_, colIndex) => {
      let maxWidth = 10
      for (const section of sections) {
        for (const row of section.rows) {
          const cellValue = row.cells[colIndex]
          const cellLength = cellValue !== undefined ? String(cellValue).length : 0
          if (cellLength > maxWidth) maxWidth = cellLength
        }
      }
      return { wch: Math.min(maxWidth + 2, 60) }
    })
  worksheet["!cols"] = colWidths

  XLSX.utils.book_append_sheet(workbook, worksheet, "Report")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

// =============================================================================
// PDF Export
// =============================================================================

/**
 * Exports a report table to a PDF file
 */
export function exportToPdf(config: TableExportConfig, filename: string): void {
  const { headers, rows, metadata } = config

  // Create PDF document (A4 size)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  })

  let yPos = 20

  // Add title
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(metadata.title, 14, yPos)
  yPos += 8

  // Add subtitle if present
  if (metadata.subtitle !== undefined) {
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(metadata.subtitle, 14, yPos)
    yPos += 6
  }

  // Add metadata
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  if (metadata.company !== undefined) {
    doc.text(`Company: ${metadata.company}`, 14, yPos)
    yPos += 5
  }
  if (metadata.asOfDate !== undefined) {
    doc.text(`As of: ${metadata.asOfDate}`, 14, yPos)
    yPos += 5
  }
  if (metadata.currency !== undefined) {
    doc.text(`Currency: ${metadata.currency}`, 14, yPos)
    yPos += 5
  }

  yPos += 5

  // Add table using autoTable
  autoTable(doc, {
    startY: yPos,
    head: [headers.map((h) => String(h))],
    body: rows.map((row) => row.map((cell) => String(cell))),
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246], // Blue header
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251] // Light gray for alternating rows
    },
    margin: { left: 14, right: 14 },
    styles: {
      cellPadding: 2,
      overflow: "linebreak"
    },
    columnStyles: getColumnStyles(headers.length)
  })

  // Add footer with generated timestamp
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Generated: ${metadata.generatedAt ?? new Date().toISOString()}`,
      14,
      doc.internal.pageSize.height - 10
    )
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 10
    )
  }

  // Download the PDF
  doc.save(`${filename}.pdf`)
}

/**
 * Exports a multi-section report to PDF (like balance sheet)
 */
export function exportMultiSectionToPdf(
  sections: readonly ReportSection[],
  metadata: ReportMetadata,
  filename: string
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  })

  let yPos = 20

  // Add title
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(metadata.title, 14, yPos)
  yPos += 8

  // Add subtitle if present
  if (metadata.subtitle !== undefined) {
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text(metadata.subtitle, 14, yPos)
    yPos += 6
  }

  // Add metadata
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  if (metadata.company !== undefined) {
    doc.text(`Company: ${metadata.company}`, 14, yPos)
    yPos += 5
  }
  if (metadata.asOfDate !== undefined) {
    doc.text(`As of: ${metadata.asOfDate}`, 14, yPos)
    yPos += 5
  }
  if (metadata.currency !== undefined) {
    doc.text(`Currency: ${metadata.currency}`, 14, yPos)
    yPos += 5
  }

  yPos += 10

  // Process each section
  for (const section of sections) {
    // Check if we need a new page
    if (yPos > doc.internal.pageSize.height - 40) {
      doc.addPage()
      yPos = 20
    }

    // Add section title
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(section.title, 14, yPos)
    yPos += 6

    // Convert section rows to table format
    const tableRows = section.rows.map((row) => {
      const cells = row.cells.map((cell) => String(cell))
      return cells
    })

    if (tableRows.length > 0) {
      const colCount = Math.max(...section.rows.map((r) => r.cells.length))

      autoTable(doc, {
        startY: yPos,
        body: tableRows,
        theme: "plain",
        bodyStyles: {
          fontSize: 9
        },
        margin: { left: 14, right: 14 },
        styles: {
          cellPadding: 1.5,
          overflow: "linebreak"
        },
        columnStyles: getColumnStyles(colCount),
        didParseCell: (data) => {
          // Style rows based on their type
          const row = section.rows[data.row.index]
          if (row !== undefined) {
            if (row.style === "header" || row.style === "subtotal") {
              data.cell.styles.fontStyle = "bold"
              data.cell.styles.fillColor = [249, 250, 251]
            } else if (row.style === "total") {
              data.cell.styles.fontStyle = "bold"
              data.cell.styles.fillColor = [229, 231, 235]
            }
          }
        }
      })

      // Get the final Y position after the table
      // jspdf-autotable adds lastAutoTable property to the document
      const finalY = getLastAutoTableFinalY(doc) ?? yPos + 20
      yPos = finalY + 10
    }
  }

  // Add footer with generated timestamp
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(
      `Generated: ${metadata.generatedAt ?? new Date().toISOString()}`,
      14,
      doc.internal.pageSize.height - 10
    )
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 10
    )
  }

  doc.save(`${filename}.pdf`)
}

// =============================================================================
// Print
// =============================================================================

/**
 * Triggers the browser's print dialog
 */
export function printReport(): void {
  window.print()
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Type guard to check if an object has a lastAutoTable property with finalY
 * jspdf-autotable adds this property to the jsPDF document after rendering a table
 */
function hasLastAutoTable(
  doc: unknown
): doc is { lastAutoTable: { finalY: number } } {
  if (typeof doc !== "object" || doc === null) {
    return false
  }
  if (!("lastAutoTable" in doc)) {
    return false
  }
  // After 'in' check, TypeScript knows lastAutoTable exists
  const lastAutoTable: unknown = doc.lastAutoTable
  if (typeof lastAutoTable !== "object" || lastAutoTable === null) {
    return false
  }
  if (!("finalY" in lastAutoTable)) {
    return false
  }
  // After 'in' check, TypeScript knows finalY exists
  return typeof lastAutoTable.finalY === "number"
}

/**
 * Safely get the finalY value from a jsPDF document after autoTable renders
 */
function getLastAutoTableFinalY(doc: jsPDF): number | undefined {
  if (hasLastAutoTable(doc)) {
    return doc.lastAutoTable.finalY
  }
  return undefined
}

/**
 * Get column styles for jsPDF autoTable based on column count
 * Last column is typically right-aligned for amounts
 */
function getColumnStyles(colCount: number): Record<number, { halign?: "left" | "right" | "center" }> {
  const styles: Record<number, { halign?: "left" | "right" | "center" }> = {}

  // First column left-aligned (descriptions)
  styles[0] = { halign: "left" }

  // Remaining columns right-aligned (amounts)
  for (let i = 1; i < colCount; i++) {
    styles[i] = { halign: "right" }
  }

  return styles
}

/**
 * Formats a number as a currency string for export
 */
export function formatAmount(amount: number, currency?: string): string {
  if (amount === 0) return "—"
  const formatted = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
  return currency !== undefined ? `${currency} ${formatted}` : formatted
}

/**
 * Generates a filename-safe string from a report title
 */
export function generateFilename(title: string, asOfDate?: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  if (asOfDate !== undefined) {
    const datePart = asOfDate.replace(/[^0-9]/g, "")
    return `${sanitized}-${datePart}`
  }

  return sanitized
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFormField } from '../components/pdf/PDFFormBuilder'

type FieldValue = string | boolean | { text: string; font: string }

// Font mapping from CSS font-family to font file
const fontFileMap: Record<string, string> = {
  "'Dancing Script', cursive": '/fonts/DancingScript-Regular.ttf',
  "'Great Vibes', cursive": '/fonts/GreatVibes-Regular.ttf',
  "'Pacifico', cursive": '/fonts/Pacifico-Regular.ttf',
}

export async function generateFilledPDF(
  pdfUrl: string,
  fields: PDFFormField[],
  values: Record<string, FieldValue>,
  isAcroForm?: boolean
): Promise<Uint8Array> {
  // Fetch the original PDF
  const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer())

  // Load the PDF
  const pdfDoc = await PDFDocument.load(existingPdfBytes)

  // Register fontkit for custom font support
  pdfDoc.registerFontkit(fontkit)

  // Load custom signature fonts
  const signatureFonts: Record<string, Awaited<ReturnType<typeof pdfDoc.embedFont>>> = {}
  for (const [cssFont, fontPath] of Object.entries(fontFileMap)) {
    try {
      const fontBytes = await fetch(fontPath).then(res => res.arrayBuffer())
      signatureFonts[cssFont] = await pdfDoc.embedFont(fontBytes)
    } catch (error) {
      console.warn(`Failed to load font ${fontPath}:`, error)
    }
  }

  // If the PDF has AcroForm fields, fill them by name
  if (isAcroForm) {
    const form = pdfDoc.getForm()

    for (const field of fields) {
      const value = values[field.id]
      if (value === undefined || value === null || value === '') continue

      const acroName = field.acroFieldName || field.name

      try {
        if (field.type === 'checkbox') {
          const checkbox = form.getCheckBox(acroName)
          if (value === true) {
            checkbox.check()
          } else {
            checkbox.uncheck()
          }
        } else if (field.type === 'signature') {
          const textField = form.getTextField(acroName)
          const sigValue = typeof value === 'object' && 'text' in value ? value.text : String(value)
          textField.setText(sigValue)
        } else {
          const textField = form.getTextField(acroName)
          textField.setText(String(value))
        }
      } catch (e) {
        console.warn(`Could not fill AcroForm field "${acroName}":`, e)
      }
    }

    // Flatten the form so fields become part of the page content
    form.flatten()
  } else {
    // Legacy: coordinate-based drawing for non-AcroForm PDFs
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fallbackSignatureFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const pages = pdfDoc.getPages()

    for (const field of fields) {
      const value = values[field.id]
      if (!value) continue

      const page = pages[field.page - 1]
      if (!page) continue

      const pageHeight = page.getHeight()
      const pageWidth = page.getWidth()

      const x = (field.x / 100) * pageWidth
      const y = pageHeight - ((field.y / 100) * pageHeight) - ((field.height / 100) * pageHeight)
      const width = (field.width / 100) * pageWidth
      const height = (field.height / 100) * pageHeight

      if (field.type === 'checkbox') {
        if (value === true) {
          page.drawText('✓', {
            x: x + 2,
            y: y + 2,
            size: Math.min(width, height) - 4,
            font: helveticaBold,
            color: rgb(0, 0, 0),
          })
        }
      } else if (field.type === 'signature') {
        const sigValue = typeof value === 'object' && 'text' in value ? value : { text: String(value), font: '' }
        if (sigValue.text) {
          const signatureFont = signatureFonts[sigValue.font] || fallbackSignatureFont
          const fontSize = Math.min(height * 0.7, 24)
          page.drawText(sigValue.text, {
            x: x + 4,
            y: y + (height - fontSize) / 2,
            size: fontSize,
            font: signatureFont,
            color: rgb(0, 0, 0.5),
          })
        }
      } else if (field.type === 'textarea') {
        const text = String(value)
        const fontSize = 10
        const lines = text.split('\n')
        let currentY = y + height - fontSize - 2

        for (const line of lines) {
          if (currentY < y) break
          page.drawText(line, {
            x: x + 2,
            y: currentY,
            size: fontSize,
            font: helvetica,
            color: rgb(0, 0, 0),
          })
          currentY -= fontSize + 2
        }
      } else {
        const text = String(value)
        const fontSize = Math.min(height * 0.7, 12)
        page.drawText(text, {
          x: x + 2,
          y: y + (height - fontSize) / 2,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        })
      }
    }
  }

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

export function uint8ArrayToBlob(uint8Array: Uint8Array): Blob {
  return new Blob([new Uint8Array(uint8Array)], { type: 'application/pdf' })
}

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
  const res = await fetch(pdfUrl)
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`)
  const existingPdfBytes = await res.arrayBuffer()

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
      if (value === undefined || value === null || value === '') continue

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

/**
 * Generate a filled PDF from AcroForm viewer values.
 * Values are keyed by AcroForm field name (not field ID).
 * Special keys: _signature_text, _signature_font, _signature_date, _print_name
 */
export async function generateAcroFilledPDF(
  pdfUrl: string,
  values: Record<string, string | boolean>
): Promise<Uint8Array> {
  const res = await fetch(pdfUrl)
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`)
  const existingPdfBytes = await res.arrayBuffer()
  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  pdfDoc.registerFontkit(fontkit)

  const form = pdfDoc.getForm()
  const allFields = form.getFields()

  // Load signature font if needed
  const sigFontCss = values['_signature_font'] as string
  let signatureFont: Awaited<ReturnType<typeof pdfDoc.embedFont>> | null = null
  if (sigFontCss && fontFileMap[sigFontCss]) {
    try {
      const fontBytes = await fetch(fontFileMap[sigFontCss]).then(res => res.arrayBuffer())
      signatureFont = await pdfDoc.embedFont(fontBytes)
    } catch (e) {
      console.warn('Failed to load signature font:', e)
    }
  }

  // Build a lookup: pdf-lib field names may be fully qualified (e.g., "Form1.Name")
  // while pdf.js annotations return partial names (e.g., "Name"). Try exact match first,
  // then fall back to partial/suffix match.
  const findValue = (name: string): string | boolean | undefined => {
    if (values[name] !== undefined) return values[name]
    // Try matching the last segment of a dotted name
    const lastSegment = name.split('.').pop()
    if (lastSegment && values[lastSegment] !== undefined) return values[lastSegment]
    // Try finding a value key that ends with this field name
    for (const key of Object.keys(values)) {
      if (key.endsWith(`.${name}`) || name.endsWith(`.${key}`)) return values[key]
    }
    return undefined
  }

  // Fill AcroForm fields from collected values
  for (const field of allFields) {
    const name = field.getName()
    const value = findValue(name)

    if (value === undefined || value === null || value === '') continue

    try {
      const fieldType = field.constructor.name
      if (fieldType === 'PDFCheckBox') {
        const cb = form.getCheckBox(name)
        if (value === true || value === 'true') {
          cb.check()
        }
      } else if (fieldType === 'PDFTextField') {
        const tf = form.getTextField(name)
        // If this is a signature field, use signature font
        if (/sig/i.test(name) && signatureFont && values['_signature_text']) {
          tf.setText(values['_signature_text'] as string)
          tf.updateAppearances(signatureFont)
        } else {
          tf.setText(String(value))
        }
      }
    } catch (e) {
      console.warn(`Could not fill field "${name}":`, e)
    }
  }

  // Helper to detect manager fields
  const isManagerFieldName = (name: string) => /manager/i.test(name) || /supervisor/i.test(name) || /admin.*sig/i.test(name)

  // Load manager signature font if provided
  const mgrSigFontCss = values['_manager_signature_font'] as string
  let managerSigFont: Awaited<ReturnType<typeof pdfDoc.embedFont>> | null = null
  if (mgrSigFontCss && fontFileMap[mgrSigFontCss]) {
    try {
      const fontBytes = await fetch(fontFileMap[mgrSigFontCss]).then(res => res.arrayBuffer())
      managerSigFont = await pdfDoc.embedFont(fontBytes)
    } catch (e) {
      console.warn('Failed to load manager signature font:', e)
    }
  }

  // Fill employee signature into non-manager sig fields
  if (values['_signature_text']) {
    for (const field of allFields) {
      const name = field.getName()
      if (/sig/i.test(name) && !isManagerFieldName(name) && !findValue(name) && field.constructor.name === 'PDFTextField') {
        try {
          const tf = form.getTextField(name)
          tf.setText(values['_signature_text'] as string)
          if (signatureFont) tf.updateAppearances(signatureFont)
        } catch (e) {
          // Field might already be filled
        }
      }
    }
  }

  // Fill employee date into non-manager date fields
  if (values['_signature_date']) {
    for (const field of allFields) {
      const name = field.getName()
      if (/date/i.test(name) && !isManagerFieldName(name) && !findValue(name) && field.constructor.name === 'PDFTextField') {
        try {
          const tf = form.getTextField(name)
          tf.setText(values['_signature_date'] as string)
        } catch (e) {
          // Field might already be filled
        }
      }
    }
  }

  // Fill manager signature fields
  if (values['_manager_signature_text']) {
    for (const field of allFields) {
      const name = field.getName()
      if (isManagerFieldName(name) && /sig/i.test(name) && field.constructor.name === 'PDFTextField') {
        try {
          const tf = form.getTextField(name)
          tf.setText(values['_manager_signature_text'] as string)
          if (managerSigFont) tf.updateAppearances(managerSigFont)
        } catch (e) {
          console.warn(`Could not fill manager sig field "${name}":`, e)
        }
      }
    }
  }

  // Fill manager date fields
  if (values['_manager_signature_date']) {
    for (const field of allFields) {
      const name = field.getName()
      if (isManagerFieldName(name) && /date/i.test(name) && field.constructor.name === 'PDFTextField') {
        try {
          const tf = form.getTextField(name)
          tf.setText(values['_manager_signature_date'] as string)
        } catch (e) {
          console.warn(`Could not fill manager date field "${name}":`, e)
        }
      }
    }
  }

  // Fill manager approved/rejected checkbox fields
  for (const field of allFields) {
    const name = field.getName()
    if (isManagerFieldName(name) || /approved/i.test(name) || /rejected/i.test(name)) {
      const val = findValue(name)
      if (val !== undefined && field.constructor.name === 'PDFCheckBox') {
        try {
          const cb = form.getCheckBox(name)
          if (val === true || val === 'true') cb.check()
        } catch (e) {
          // ignore
        }
      }
    }
  }

  form.flatten()
  return pdfDoc.save()
}

export function uint8ArrayToBlob(uint8Array: Uint8Array): Blob {
  return new Blob([new Uint8Array(uint8Array)], { type: 'application/pdf' })
}

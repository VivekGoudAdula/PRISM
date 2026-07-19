import { config } from 'dotenv';
import { PDFParse } from 'pdf-parse';
import pdfExtractModule from 'pdf.js-extract';
import Tesseract from 'tesseract.js';

config();

let pdfExtractInstance: any = null;

async function getPdfExtractInstance() {
  if (!pdfExtractInstance) {
    const PDFExtractClass: any = await pdfExtractModule;
    pdfExtractInstance = new PDFExtractClass();
  }
  return pdfExtractInstance;
}

/**
 * Extracts embedded images from a PDF buffer.
 */
async function extractImagesFromPdf(buffer: Buffer): Promise<string[]> {
  const pdfExtract = await getPdfExtractInstance();
  return new Promise((resolve, reject) => {
    pdfExtract.extractBuffer(buffer, { includeImages: true }, (err: any, data: any) => {
      if (err) {
        return reject(err);
      }
      const images: string[] = [];
      if (data && data.pages) {
        for (const page of data.pages) {
          if (page.images) {
            for (const img of page.images) {
              if (img.data) {
                images.push(img.data);
              }
            }
          }
        }
      }
      resolve(images);
    });
  });
}

/**
 * Centrally extracts text from base64 file content based on type (txt, pdf, scanned pdf OCR fallback).
 */
export async function extractText(
  filename: string,
  content_base64: string
): Promise<{ text: string; method: 'pdf-text' | 'ocr' | 'plain' }> {
  const normalizedFilename = filename.toLowerCase();

  if (normalizedFilename.endsWith('.txt')) {
    const text = Buffer.from(content_base64, 'base64').toString('utf-8');
    return { text, method: 'plain' };
  }

  if (normalizedFilename.endsWith('.pdf')) {
    const buffer = Buffer.from(content_base64, 'base64');
    let text = '';
    let isScanned = false;
    let parser: any = null;

    try {
      parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      text = pdfData.text ? pdfData.text.trim() : '';
      if (text.length < 20) {
        isScanned = true;
      }
    } catch (err) {
      console.warn(`Failed to parse PDF text layer for ${filename}, attempting OCR fallback:`, err);
      isScanned = true;
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch (e) {
          // ignore
        }
      }
    }

    if (isScanned) {
      console.log(`Running OCR fallback on scanned/image PDF: ${filename}`);
      try {
        const images = await extractImagesFromPdf(buffer);
        if (images.length === 0) {
          throw new Error('No embedded images found in scanned PDF');
        }

        let ocrText = '';
        for (let i = 0; i < images.length; i++) {
          const imgData = images[i];
          let imageBuffer: Buffer;
          if (imgData.startsWith('data:')) {
            const base64Part = imgData.split(',')[1];
            imageBuffer = Buffer.from(base64Part, 'base64');
          } else {
            imageBuffer = Buffer.from(imgData, 'base64');
          }

          console.log(`OCR processing image ${i + 1}/${images.length} for ${filename}...`);
          const result = await Tesseract.recognize(imageBuffer, 'eng');
          ocrText += result.data.text + '\n';
        }

        return { text: ocrText.trim(), method: 'ocr' };
      } catch (ocrErr: any) {
        console.error(`OCR fallback failed for ${filename}:`, ocrErr);
        throw new Error(`Failed to extract text from PDF via both text-layer and OCR fallback: ${ocrErr.message}`);
      }
    }

    return { text, method: 'pdf-text' };
  }

  if (normalizedFilename.endsWith('.docx')) {
    const buffer = Buffer.from(content_base64, 'base64');
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return { text: result.value, method: 'plain' };
    } catch (err: any) {
      console.error(`Mammoth docx extraction failed for ${filename}:`, err);
      throw new Error(`Failed to extract text from DOCX: ${err.message}`);
    }
  }

  throw new Error(`Unsupported file type: ${filename}. Only .txt, .pdf, and .docx are supported.`);
}

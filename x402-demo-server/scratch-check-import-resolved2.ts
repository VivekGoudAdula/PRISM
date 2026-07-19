import pdfExtractModule from 'pdf.js-extract';

async function test() {
  const PDFExtract = await pdfExtractModule;
  console.log('PDFExtract:', PDFExtract);
  const instance = new (PDFExtract as any)();
  console.log('Instance created successfully:', !!instance);
}

test();

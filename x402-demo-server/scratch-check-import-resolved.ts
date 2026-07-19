import pdfExtractModule from 'pdf.js-extract';

async function test() {
  const resolved = await pdfExtractModule;
  console.log('Resolved default export:', resolved);
  console.log('Keys of resolved:', Object.keys(resolved as any));
  const PDFExtract = (resolved as any).PDFExtract;
  console.log('PDFExtract constructor:', PDFExtract);
  const instance = new PDFExtract();
  console.log('Instance created successfully:', !!instance);
}

test();

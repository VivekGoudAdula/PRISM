import { extractText } from './handlers/lib/extract-document';

async function runTests() {
  console.log('--- STARTING EXTRACTION TESTS ---');

  // Test 1: Plain Text file (.txt)
  try {
    console.log('\nTest 1: Plain Text File');
    const txtBase64 = Buffer.from('This is some sample text for testing plain text file extraction.', 'utf-8').toString('base64');
    const result = await extractText('test_document.txt', txtBase64);
    console.log('Result:', result);
  } catch (err: any) {
    console.error('Test 1 failed:', err.message);
  }

  // Test 2: Invalid File Extension
  try {
    console.log('\nTest 2: Invalid File Extension');
    await extractText('test.png', 'base64data');
  } catch (err: any) {
    console.log('Correctly caught error:', err.message);
  }

  // Test 3: Standard PDF (Simple text layer)
  // Let's create a minimal valid PDF base64 representing:
  // %PDF-1.4 ... (just enough to not crash pdf-parse and return some text)
  // Since creating a valid PDF binary by hand is complex, we can use a small actual PDF or catch the error.
  console.log('\n--- END OF BASIC TESTS ---');
}

runTests();

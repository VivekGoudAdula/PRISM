async function test402() {
  console.log('====================================================');
  console.log('VERIFYING HTTP 402 PAYMENT GATE ON /claim-extract');
  console.log('====================================================\n');

  try {
    const res = await fetch('http://localhost:4021/claim-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_description: 'extract claims from this article' }),
    });

    console.log(`HTTP Status Code: ${res.status} ${res.statusText}`);
    console.log('Headers:');
    res.headers.forEach((v, k) => {
      if (k.toLowerCase().includes('payment') || k.toLowerCase().includes('cors') || k.toLowerCase().includes('content')) {
        console.log(`  ${k}: ${v}`);
      }
    });

    const bodyText = await res.text();
    console.log('\nResponse Body:');
    try {
      console.log(JSON.stringify(JSON.parse(bodyText), null, 2));
    } catch {
      console.log(bodyText);
    }

    if (res.status === 402) {
      console.log('\n✅ VERIFICATION PASSED: Endpoint returned HTTP 402 Payment Required!');
    } else {
      console.log(`\n❌ VERIFICATION FAILED: Expected 402, got ${res.status}`);
    }
  } catch (err: any) {
    console.error('Fetch error (make sure server is running on port 4021):', err.message);
  }
}

test402();

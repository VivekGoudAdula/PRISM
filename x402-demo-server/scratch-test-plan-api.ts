async function testPlanTask() {
  const sampleResumeTxt = `
JANE DOE
Senior Full Stack Engineer
Email: jane.doe@example.com | Phone: (555) 019-2834 | San Francisco, CA

SUMMARY
Experienced Full Stack Engineer with 7+ years of expertise in TypeScript, React, Node.js, Python, PostgreSQL, and AWS. Proven track record of scaling high-throughput APIs and building modern web applications.

EXPERIENCE
Senior Software Engineer | TechCorp Inc. (2021 - Present)
- Architected microservices serving over 2 million daily active users with 99.99% uptime.
- Optimized database queries reducing P99 latency by 45%.

EDUCATION
B.S. in Computer Science | Stanford University (2014 - 2018)

SKILLS
TypeScript, JavaScript, React, Node.js, Express, Python, Django, PostgreSQL, MongoDB, Docker, AWS
`;

  const base64Content = Buffer.from(sampleResumeTxt).toString('base64');

  try {
    const res = await fetch('http://localhost:4021/plan-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_description: 'Screen these resumes for a Senior Full Stack Engineer role',
        files: [
          { filename: 'resume1.txt', content_base64: base64Content },
          { filename: 'resume2.txt', content_base64: base64Content },
          { filename: 'resume3.txt', content_base64: base64Content },
        ],
      }),
    });

    const data: any = await res.json();
    console.log('=== /plan-task REAL API TEST RESULTS ===');
    console.log('Category:', data.category);
    console.log('Provider:', data.providerName);
    console.log('Execution Quantity:', data.executionQuantity);
    console.log('Original Input Tokens:', data.originalInputTokens);
    console.log('Plan ID:', data.planId);
  } catch (err: any) {
    console.error('Plan task test failed:', err.message);
  }
}

testPlanTask();

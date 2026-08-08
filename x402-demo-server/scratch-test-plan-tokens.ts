import { estimateTokens } from './services/tokenAnalytics';

const sampleResumeText = `
JANE DOE
Senior Full Stack Engineer
Email: jane.doe@example.com | Phone: (555) 019-2834 | San Francisco, CA

SUMMARY
Experienced Full Stack Engineer with 7+ years of expertise in TypeScript, React, Node.js, Python, PostgreSQL, and AWS. Proven track record of scaling high-throughput APIs and building modern web applications.

EXPERIENCE
Senior Software Engineer | TechCorp Inc. (2021 - Present)
- Architected microservices serving over 2 million daily active users with 99.99% uptime.
- Optimized database queries reducing P99 latency by 45%.
- Led a team of 5 engineers in migrating legacy monolith to event-driven serverless architecture.

Software Engineer | StartupLabs (2018 - 2021)
- Developed responsive React dashboard for real-time analytics.
- Integrated payment processing gateway handling $5M+ monthly transactions.

EDUCATION
B.S. in Computer Science | Stanford University (2014 - 2018)

SKILLS
TypeScript, JavaScript, React, Node.js, Express, Python, Django, PostgreSQL, MongoDB, Docker, AWS, GraphQL, REST APIs
`;

const prompt = 'Screen these 3 resumes for a Senior Full Stack Engineer position requiring TypeScript, React, and Node.js experience.';

const resume1Tokens = estimateTokens(sampleResumeText);
const promptTokens = estimateTokens(prompt);
const totalFor3Resumes = promptTokens + (resume1Tokens * 3) + (3 * 250);

console.log('--- TOKEN ESTIMATION ANALYSIS ---');
console.log(`Prompt tokens: ${promptTokens}`);
console.log(`Sample Resume (1 file) extracted text tokens: ${resume1Tokens}`);
console.log(`Total estimated original input tokens for 3 resumes: ${totalFor3Resumes}`);
console.log(`Base64 token count (PREVIOUS BROKEN METHOD): ~99,479 tokens`);
console.log(`New Extracted Text Method: ~${totalFor3Resumes} tokens`);

import { buildSemanticMap } from '../handlers/lib/semantic-map';
import fs from 'fs';
import path from 'path';

async function testSemanticMap() {
  const sampleResume = `
Jane Doe
Senior Full Stack Engineer & Cloud Architect
Email: jane.doe@example.com | Phone: (555) 123-4567 | Location: San Francisco, CA

SUMMARY
Passionate Software Engineer with over 8 years of professional experience building scalable backend microservices, real-time distributed data pipelines, and responsive web applications. Proven expertise in TypeScript, Node.js, Python, React, AWS, Docker, Kubernetes, and PostgreSQL.

SKILLS
- Programming Languages: TypeScript, JavaScript, Python, Go, SQL, HTML5, CSS3
- Frameworks & Libraries: React, Next.js, Node.js, Express, Hono, FastAPI, Tailwind CSS
- Databases & Caching: PostgreSQL, MongoDB, Redis, DynamoDB
- DevOps & Cloud: AWS (S3, EC2, Lambda, ECS), Docker, Kubernetes, CI/CD (GitHub Actions)
- Architecture & Principles: RESTful APIs, GraphQL, Microservices, Event-Driven Architecture, Unit Testing (Jest, Vitest)

WORK EXPERIENCE
Senior Full Stack Engineer | TechCorp Solutions (2021 - Present)
- Architected and deployed microservices processing over 10 million API requests daily using Node.js and AWS ECS.
- Led frontend redesign in Next.js and Tailwind CSS, improving core web vitals by 40% and page load speed by 1.5 seconds.
- Mentored a team of 6 junior and mid-level engineers, conducting weekly code reviews and technical design docs.

Software Engineer | Innovate Systems Inc (2018 - 2021)
- Developed real-time analytics dashboard with React and WebSockets.
- Optimized database queries in PostgreSQL, reducing query execution time by 60%.
- Integrated Stripe and Algorand smart contract payment gateways for enterprise clients.

EDUCATION
Bachelor of Science in Computer Science | University of California, Berkeley (2014 - 2018)
- GPA: 3.8 / 4.0
- Honors: Dean's List, ACM Programming Competition Finalist
`;

  console.log('Testing buildSemanticMap on sample resume text...');
  const result = await buildSemanticMap('resume_screening', sampleResume, 'jane_doe_resume.txt');
  console.log('\n--- Extraction Result ---');
  console.log('Semantic Map:', JSON.stringify(result.map, null, 2));
  console.log(`Raw Tokens: ${result.raw_tokens}`);
  console.log(`Map Tokens: ${result.map_tokens}`);
  const saved = result.raw_tokens - result.map_tokens;
  const pct = ((saved / result.raw_tokens) * 100).toFixed(2);
  console.log(`Tokens Saved: ${saved} (${pct}% reduction)`);

  const logFile = path.join(process.cwd(), 'data', 'savings-log.json');
  if (fs.existsSync(logFile)) {
    console.log('\ndata/savings-log.json contents:');
    console.log(fs.readFileSync(logFile, 'utf-8'));
  }
}

testSemanticMap().catch(console.error);

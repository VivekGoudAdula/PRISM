import assert from 'assert';
import { evaluateCandidateDeterministic } from '../handlers/lib/resume-evaluator';

async function runResumeTest() {
  console.log('====================================================');
  console.log('PRISM — RESUME SCREENING DIFFERENTIATION TEST');
  console.log('====================================================\n');

  const testFiles = [
    {
      filename: 'Akshay_Sagar_Profile.pdf',
      extracted_text: 'Akshay Sagar\nSenior Backend Engineer\nSkills: Node.js, TypeScript, PostgreSQL, Docker, AWS, Microservices',
      semantic_map: { name: 'Akshay Sagar', skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'] }
    },
    {
      filename: 'Polla Vishnu Vardhan.pdf',
      extracted_text: 'Polla Vishnu Vardhan\nFull Stack Developer\nSkills: Python, React, SQL, Git, REST API',
      semantic_map: { name: 'Polla Vishnu Vardhan', skills: ['Python', 'React', 'SQL', 'Git'] }
    },
    {
      filename: 'RESUME.pdf',
      extracted_text: 'Jane Doe\nDevOps Engineer\nSkills: Kubernetes, Docker, Terraform, AWS, CI/CD',
      semantic_map: { name: 'Jane Doe', skills: ['Kubernetes', 'Docker', 'Terraform', 'AWS'] }
    },
    {
      filename: 'Vivek_Goud_Adula_Profile.pdf',
      extracted_text: 'Vivek Goud Adula\nLead Backend Developer\nSkills: Go, Node.js, Python, PostgreSQL, Redis, System Design, Microservices, AWS',
      semantic_map: { name: 'Vivek Goud Adula', skills: ['Go', 'Node.js', 'Python', 'PostgreSQL', 'Redis', 'System Design'] }
    }
  ];

  const targetRole = 'Screen these candidate resumes for a Senior Backend Developer role';
  const results = testFiles.map((f) => evaluateCandidateDeterministic(f.filename, f.extracted_text, f.semantic_map, targetRole));

  console.log('--- Screened Candidates Output ---');
  results.forEach((c) => {
    console.log(`Candidate: ${c.name.padEnd(22)} | Score: ${Math.round(c.match_score * 100)}% | Role: ${c.role.padEnd(26)} | Domain: ${c.primary_domain}`);
    console.log(`  Key Skills: ${c.key_skills.join(', ')}`);
    console.log(`  Reason: ${c.reason}\n`);
  });

  // Verification 1: Match scores must NOT all be identical (no flat 88%)
  const scores = results.map((r) => r.match_score);
  const uniqueScores = new Set(scores);
  assert(uniqueScores.size > 1, `Scores MUST be differentiated across candidates! Got all: ${Array.from(uniqueScores).join(', ')}`);

  // Verification 2: Candidate names must NOT be generic 'RESUME' when text has a name
  const janeDoe = results.find((r) => r.name.includes('Jane Doe'));
  assert(janeDoe, 'Candidate name Jane Doe should be extracted from text when filename is generic RESUME.pdf');

  // Verification 3: No score is flat 0.88 across all candidates
  const all88 = scores.every((s) => s === 0.88);
  assert(!all88, 'Scores MUST NOT be flat 88%');

  console.log('✅ ALL RESUME SCREENING DIFFERENTIATION TESTS PASSED!');
}

runResumeTest().catch((err) => {
  console.error('❌ Resume screening test failed:', err.message || err);
  process.exit(1);
});

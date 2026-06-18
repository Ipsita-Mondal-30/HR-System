const TECH_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Golang', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala',
  'React', 'React.js', 'Next.js', 'Nextjs', 'Vue', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Nodejs', 'Express', 'NestJS',
  'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Spring', 'Laravel', '.NET', 'ASP.NET',
  'AWS', 'Azure', 'GCP', 'Google Cloud', 'Kubernetes', 'K8s', 'Docker', 'Terraform', 'Ansible', 'Jenkins', 'CI/CD',
  'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch', 'DynamoDB', 'Cassandra', 'SQL', 'NoSQL',
  'GraphQL', 'REST API', 'REST', 'gRPC', 'Microservices', 'Kafka', 'RabbitMQ',
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'NLP', 'Computer Vision',
  'Data Science', 'Data Engineering', 'Pandas', 'NumPy', 'Spark', 'Apache Spark', 'Hadoop', 'Airflow', 'dbt',
  'Tableau', 'Power BI', 'Looker', 'ETL', 'Data Analytics',
  'HTML', 'CSS', 'Tailwind', 'Bootstrap', 'SASS', 'Webpack', 'Vite',
  'Git', 'GitHub', 'GitLab', 'Jira', 'Agile', 'Scrum',
  'Figma', 'UI/UX', 'Product Management',
  'DevOps', 'SRE', 'Linux', 'Bash', 'Shell',
  'iOS', 'Android', 'React Native', 'Flutter',
  'Solidity', 'Blockchain', 'Web3',
  'Cybersecurity', 'Penetration Testing',
  'Salesforce', 'SAP', 'Oracle',
  'Snowflake', 'BigQuery', 'Redshift',
  'LLM', 'OpenAI', 'Gemini', 'RAG', 'LangChain',
  'Cypress', 'Selenium', 'Jest', 'Mocha', 'Playwright',
  'Prisma', 'TypeORM', 'Sequelize', 'Mongoose',
  'Firebase', 'Supabase',
  'Cloudflare', 'Nginx',
  'Prometheus', 'Grafana', 'Datadog',
];

const SKILL_ALIASES = {
  'react.js': 'React',
  reactjs: 'React',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  'vue.js': 'Vue',
  vuejs: 'Vue',
  golang: 'Go',
  k8s: 'Kubernetes',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  ml: 'Machine Learning',
  dl: 'Deep Learning',
  tf: 'TensorFlow',
  js: 'JavaScript',
  ts: 'TypeScript',
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
};

function normalizeSkill(raw) {
  const key = raw.trim().toLowerCase();
  if (SKILL_ALIASES[key]) return SKILL_ALIASES[key];
  const found = TECH_SKILLS.find((s) => s.toLowerCase() === key);
  return found || raw.trim();
}

function extractSkillsFromText(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set();

  for (const skill of TECH_SKILLS) {
    const pattern = new RegExp(`\\b${skill.replace(/[.+*?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(lower)) {
      found.add(normalizeSkill(skill));
    }
  }

  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    const pattern = new RegExp(`\\b${alias.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(lower)) found.add(canonical);
  }

  return Array.from(found).slice(0, 30);
}

function detectRemote(title = '', description = '', location = '') {
  const combined = `${title} ${description} ${location}`.toLowerCase();
  return /remote|work from home|wfh|hybrid|anywhere/.test(combined);
}

function extractCity(locationStr = '') {
  if (!locationStr) return 'Unknown';
  const parts = locationStr.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[0] || locationStr;
}

module.exports = {
  TECH_SKILLS,
  extractSkillsFromText,
  detectRemote,
  extractCity,
  normalizeSkill,
};

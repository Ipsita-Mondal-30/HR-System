const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.askedQuestions = new Map();
    this.questionBank = this.initializeQuestionBank();
    
    // Try to initialize Gemini, but don't fail if it doesn't work
    try {
      if (process.env.GEMINI_API_KEY) {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
        this.model = this.genAI.getGenerativeModel({ model: modelName });
        console.log(`✅ Gemini AI initialized (model: ${modelName})`);
      } else {
        console.warn('⚠️ GEMINI_API_KEY not set, using intelligent fallback system');
      }
    } catch (error) {
      console.warn('⚠️ Gemini initialization failed, using intelligent fallback:', error.message);
    }
  }

  formatJobContext(jobContext = {}, jobRole) {
    const title = jobContext.title || jobRole || jobContext.jobRole || 'this role';
    const skills = Array.isArray(jobContext.skills)
      ? jobContext.skills.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const description = String(jobContext.description || jobContext.jobDescription || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2500);
    return {
      title,
      company: jobContext.companyName || '',
      skills,
      description,
      experienceRequired: jobContext.experienceRequired,
    };
  }

  inferRoleCategory(title = '') {
    const t = String(title).toLowerCase();
    if (/(software|developer|sde|frontend|backend|full.?stack|programmer|react|node|java|python|golang|devops|sre|mobile|android|ios|\bengineer\b)/.test(t) && !/prompt engineer|sales engineer/.test(t)) {
      return 'software';
    }
    if (/(data scientist|machine learning|ml engineer|ai engineer|nlp|deep learning)/.test(t)) return 'data';
    if (/(data analyst|business analyst|bi analyst|analytics)/.test(t)) return 'analyst';
    if (/(product manager|product owner|\bpm\b)/.test(t)) return 'product';
    if (/(design|ux|ui)/.test(t)) return 'design';
    if (/(\bhr\b|human resource|recruiter|talent acquisition|people ops)/.test(t)) return 'hr';
    if (/(market|seo|content|brand|growth)/.test(t)) return 'marketing';
    if (/(sales|account executive|bdr|sdr|business development)/.test(t)) return 'sales';
    if (/(finance|accountant|accounting|controller)/.test(t)) return 'finance';
    return 'default';
  }

  questionFocus(askedCount) {
    const foci = [
      'motivation and fit for THIS exact role — not a generic tell-me-about-yourself',
      'a core required skill from the job description, with a real project example',
      'a STAR behavioral question tied to the day-to-day work of this role',
      'a technical, case, or situational question a hiring manager for this job would actually ask',
      'collaboration, trade-offs, or a likely challenge in this role',
      'how they would approach the first 30-90 days in this specific job',
    ];
    return foci[Math.min(Number(askedCount) || 0, foci.length - 1)];
  }

  initializeQuestionBank() {
    return {
      software: {
        easy: [
          'Walk me through a recent feature you shipped. What was your part, and which tools did you use?',
          'How do you debug a production issue when you cannot reproduce it locally?',
          'How do you use Git in a team — branching, reviews, and handling merge conflicts?',
        ],
        medium: [
          'Describe a performance problem you diagnosed. What did you measure, change, and what was the result?',
          'How do you decide between shipping quickly and writing more tests for a user-facing change?',
          'Tell me about an API or data model you designed and how others consumed it.',
        ],
        hard: [
          'Design a system for this role that could handle a 10x traffic spike. Where are the bottlenecks?',
          'How would you roll back a bad deploy that already affected users?',
          'What would you improve first in a messy legacy codebase, and why?',
        ],
      },
      data: {
        easy: [
          'Describe a dataset you analyzed. What question were you answering, and what did you find?',
          'How do you check whether a metric or model result is trustworthy?',
        ],
        medium: [
          'Walk me through a model or dashboard you built and how stakeholders used it.',
          'Tell me about a time messy data almost led to a wrong conclusion. What did you do?',
        ],
        hard: [
          'How would you design an experiment or evaluation plan for a new ML feature in production?',
        ],
      },
      analyst: {
        easy: [
          'How do you turn a vague business question into an analysis you can actually run?',
          'Which metrics would you watch weekly for this role, and why?',
        ],
        medium: [
          'Tell me about an insight you found that changed a decision. What was the evidence?',
        ],
        hard: [
          'Two teams disagree on a number. How do you reconcile definitions and present a recommendation?',
        ],
      },
      product: {
        easy: [
          'How do you decide what to build next when everything feels important?',
          'Describe a product you shipped and how you knew it succeeded.',
        ],
        medium: [
          'Tell me about a time engineering said no. How did you negotiate scope?',
        ],
        hard: [
          'A key metric dropped 15% this week. How would you investigate and what would you do in the first 48 hours?',
        ],
      },
      hr: {
        easy: [
          'Walk me through how you would screen candidates for a role like this one.',
          'How do you handle a hiring manager who wants to skip steps in the process?',
        ],
        medium: [
          'Describe a difficult employee or candidate situation and how you resolved it.',
        ],
        hard: [
          'How would you improve time-to-hire without lowering quality for this company?',
        ],
      },
      marketing: {
        easy: [
          'Describe a campaign you ran. Who was the audience, and what was the result?',
          'How do you decide which channel to invest in next?',
        ],
        medium: [
          'Tell me about content or a campaign that underperformed. What did you change?',
        ],
        hard: [
          'How would you build a 90-day plan to grow awareness for this company with a limited budget?',
        ],
      },
      sales: {
        easy: [
          'Walk me through how you qualify a lead for a role like this.',
          'Describe a deal you closed and what the customer actually cared about.',
        ],
        medium: [
          'Tell me about a deal you lost. What would you do differently?',
        ],
        hard: [
          'How would you build a pipeline for this product in a new territory in 90 days?',
        ],
      },
      design: {
        easy: [
          'Walk me through a design you are proud of. What problem were you solving?',
          'How do you gather and use feedback from users or stakeholders?',
        ],
        medium: [
          'Describe a time research contradicted a stakeholder request. What did you do?',
        ],
        hard: [
          'How would you redesign a confusing flow in this product, and how would you measure success?',
        ],
      },
      finance: {
        easy: [
          'Walk me through a close, forecast, or analysis you owned.',
          'How do you explain a variance to a non-finance partner?',
        ],
        medium: [
          'Tell me about a control or process you improved to reduce risk or errors.',
        ],
        hard: [
          'Leadership wants a cost cut of 12%. How would you analyze options and recommend a plan?',
        ],
      },
      default: {
        easy: [
          'What in this job description matches work you have already done? Give one concrete example.',
          'Walk me through a typical project you owned from start to finish.',
        ],
        medium: [
          'Describe a time you had to learn something quickly to deliver. What did you do?',
          'Tell me about a disagreement at work and how you resolved it.',
        ],
        hard: [
          'If you started this role on Monday, what would you do in the first two weeks and how would you measure progress?',
        ],
      },
    };
  }

  async generateFirstQuestion(jobRole, skills, sessionId, jobContext = {}) {
    const ctx = this.formatJobContext({ ...jobContext, skills: jobContext.skills || skills, title: jobRole }, jobRole);
    console.log(`🎤 [${sessionId}] Generating first question for ${ctx.title}...`);

    if (this.model) {
      try {
        const prompt = `You are a hiring manager interviewing for this exact job. Ask ONE opening spoken question.

Role: ${ctx.title}${ctx.company ? ` at ${ctx.company}` : ''}
Required skills: ${ctx.skills.join(', ') || 'see job description'}
Job description: ${ctx.description || 'Not provided — still make the question specific to the job title'}

Rules:
- The question MUST be about this role's work, not generic ("tell me about yourself", "where do you see yourself in 5 years").
- Easy difficulty, 1-2 sentences, natural to speak aloud.
- Focus: ${this.questionFocus(0)}
Return ONLY the question text.`;

        const result = await this.model.generateContent(prompt);
        const question = this.cleanQuestion((await result.response).text());
        this.trackQuestion(sessionId, question);
        console.log(`✅ [${sessionId}] Gemini generated: "${question.substring(0, 60)}..."`);
        return question;
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini failed, using fallback:`, error.message);
      }
    }

    const question = this.getUniqueQuestion(ctx.title, 'easy', sessionId, ctx);
    console.log(`✅ [${sessionId}] Fallback generated: "${question.substring(0, 60)}..."`);
    return question;
  }

  async decideNextQuestion(jobRole, skills, evaluation, askedCount, sessionId, previousQuestions = [], previousAnswer = '', jobContext = {}) {
    const difficulty = evaluation === 'correct' ? 'hard' : evaluation === 'partial' ? 'medium' : 'easy';
    const ctx = this.formatJobContext({ ...jobContext, skills: jobContext.skills || skills, title: jobRole }, jobRole);
    console.log(`🎯 [${sessionId}] Generating ${difficulty} question #${askedCount + 1} for ${ctx.title}...`);

    if (this.model) {
      try {
        const askedInSession = this.askedQuestions.get(sessionId) || [];
        const allPrevious = [...askedInSession, ...previousQuestions];
        const answerContext = previousAnswer?.trim()
          ? `Last answer (follow up only if it stays on this job): "${previousAnswer.trim().slice(0, 400)}"`
          : '';

        const prompt = `You are a hiring manager for this exact job. Ask ONE new spoken interview question.

Role: ${ctx.title}${ctx.company ? ` at ${ctx.company}` : ''}
Required skills: ${ctx.skills.join(', ') || 'see job description'}
Job description: ${ctx.description || 'Not provided — still stay specific to the job title'}
Difficulty: ${difficulty}
This is question ${askedCount + 1}. Focus: ${this.questionFocus(askedCount)}
Already asked (do not repeat): ${allPrevious.slice(-6).join(' | ') || 'none'}
${answerContext}

Rules:
- Must sound like a real interview for THIS job, not a generic behavioral bank.
- Mention a skill, responsibility, or scenario from the job when possible.
- One question, 1-3 sentences, easy to speak aloud.
Return ONLY the question text.`;

        const result = await this.model.generateContent(prompt);
        const question = this.cleanQuestion((await result.response).text());
        this.trackQuestion(sessionId, question);
        console.log(`✅ [${sessionId}] Gemini generated: "${question.substring(0, 60)}..."`);
        return { question, difficulty };
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini failed, using fallback`);
      }
    }

    const question = this.getUniqueQuestion(ctx.title, difficulty, sessionId, ctx);
    console.log(`✅ [${sessionId}] Fallback generated: "${question.substring(0, 60)}..."`);
    return { question, difficulty };
  }

  async evaluateAnswer(jobRole, question, answer, sessionId) {
    console.log(`🔍 [${sessionId}] Evaluating answer (length: ${answer?.length || 0})...`);
    
    const trimmed = (answer || '').trim();
    const dontKnow = /\b(i don'?t know|not sure|no idea|can'?t answer|unsure)\b/i.test(trimmed);

    if (dontKnow) {
      console.log(`💡 [${sessionId}] Candidate unsure — will offer a hint`);
      return {
        evaluation: 'incorrect',
        penalty: 8,
        confidenceLevel: 'low',
        needsHint: true,
        hint: `That's okay. For ${jobRole}, think of one real project or situation — even from school or a side project — and walk through what you did and what happened.`,
      };
    }

    // Quick checks
    if (!trimmed || trimmed.length < 5) {
      console.log(`⚠️ [${sessionId}] Very short answer, marking as incorrect`);
      return { evaluation: 'incorrect', penalty: 18, confidenceLevel: 'low' };
    }

    if (trimmed.length < 20) {
      console.log(`⚠️ [${sessionId}] Short answer, marking as partial`);
      return { evaluation: 'partial', penalty: 12, confidenceLevel: 'low' };
    }

    // Try Gemini first
    if (this.model) {
      try {
        const prompt = `You are scoring a mock interview answer for this role: ${jobRole}.
Question: ${question}
Answer: ${answer}

Judge whether the answer would satisfy a hiring manager for this job (examples, specifics, relevance), not just length.
Return JSON only: {"evaluation": "correct|partial|incorrect", "penalty": 0-20, "reason": "one sentence citing what was strong or missing"}`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const parsed = this.parseJsonFromText(text);
        if (parsed) {
          const evaluation = parsed.evaluation;
          const penalty = Math.max(0, Math.min(20, parsed.penalty || 10));
          
          if (evaluation === 'correct' || evaluation === 'partial' || evaluation === 'incorrect') {
            const confidenceLevel = evaluation === 'correct' ? 'high' : evaluation === 'partial' ? 'medium' : 'low';
            console.log(`✅ [${sessionId}] Gemini evaluation: ${evaluation}, Penalty: ${penalty}`);
            return { evaluation, penalty, reason: parsed.reason, confidenceLevel };
          }
        }
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini evaluation failed, using heuristic`);
      }
    }
    
    // Intelligent heuristic evaluation
    const wordCount = answer.trim().split(/\s+/).length;
    const hasExamples = /example|instance|time when|situation|project|experience/i.test(answer);
    const hasDetails = /because|specifically|particularly|detail|implement|develop/i.test(answer);
    
    let evaluation, penalty;
    
    if (wordCount >= 50 && hasExamples && hasDetails) {
      evaluation = 'correct';
      penalty = Math.floor(Math.random() * 5) + 2; // 2-6
    } else if (wordCount >= 30 && (hasExamples || hasDetails)) {
      evaluation = 'partial';
      penalty = Math.floor(Math.random() * 6) + 7; // 7-12
    } else if (wordCount >= 20) {
      evaluation = 'partial';
      penalty = Math.floor(Math.random() * 4) + 10; // 10-13
    } else {
      evaluation = 'incorrect';
      penalty = Math.floor(Math.random() * 5) + 14; // 14-18
    }
    
    const confidenceLevel = evaluation === 'correct' ? 'high' : evaluation === 'partial' ? 'medium' : 'low';
    console.log(`✅ [${sessionId}] Heuristic evaluation: ${evaluation}, Penalty: ${penalty}`);
    return { evaluation, penalty, reason: `Based on answer length and content quality`, confidenceLevel };
  }

  async analyzeInterviewForEmail(jobRole, questions, fullTranscript, sessionId, jobContext = {}) {
    const ctx = this.formatJobContext({ ...jobContext, title: jobRole }, jobRole);
    console.log(`📊 [${sessionId}] Analyzing interview for ${ctx.title}...`);

    const totalPenalties = questions.reduce((sum, q) => sum + (q.penalty || 10), 0);
    const maxPenalties = Math.max(questions.length * 20, 1);
    const baseScore = Math.max(0, Math.round(100 - (totalPenalties / maxPenalties) * 100));
    const qaBlock = (questions || [])
      .map((q, i) => {
        const answer = q.transcript || q.answer || '(no answer recorded)';
        return `Q${i + 1} [${q.evaluation || 'unscored'}]: ${q.question}\nA${i + 1}: ${String(answer).slice(0, 800)}`;
      })
      .join('\n\n');

    console.log(`📊 [${sessionId}] Base score from penalties: ${baseScore}/100`);

    if (this.model) {
      try {
        const prompt = `You are an interview coach writing a PERSONAL, SPECIFIC report after a mock interview.

Role: ${ctx.title}${ctx.company ? ` at ${ctx.company}` : ''}
Required skills: ${ctx.skills.join(', ') || 'not listed'}
Job description: ${ctx.description || 'not provided'}
Penalty-based starting score: ${baseScore}/100

Transcript:
${qaBlock || fullTranscript || 'No transcript'}

You MUST cite what the candidate actually said. Do not give generic advice like "use the STAR method" unless you also say which question it applies to.

Return ONLY valid JSON:
{
  "finalScore": <0-100 integer>,
  "summary": "<3-4 sentences: what they did well and what was missing FOR THIS ROLE, referencing real answers>",
  "strengths": ["<4-6 items that quote or paraphrase their answers>"],
  "weaknesses": ["<4-6 items naming the question or skill that was weak>"],
  "recommendations": ["<5-7 concrete practice steps for this job this week>"],
  "actionPlan": ["<4-6 next actions>"],
  "skillsDemonstrated": ["<skills they actually showed>"],
  "skillsToPractice": ["<skills this job needs that they did not show well>"],
  "questionFeedback": [
    {
      "question": "<exact question>",
      "whatWentWell": "<1-2 sentences about their answer>",
      "whatToImprove": "<1-2 sentences of specific coaching>",
      "betterAnswer": "<a stronger 3-5 sentence sample answer for THIS question>"
    }
  ]
}

Include questionFeedback for EVERY question. Keep each field concise.`;

        const result = await this.model.generateContent(prompt);
        const analysis = this.parseJsonFromText((await result.response).text());
        if (analysis) {
          const finalScore = Math.max(0, Math.min(100, Math.round(analysis.finalScore || baseScore)));
          const questionFeedback = Array.isArray(analysis.questionFeedback)
            ? analysis.questionFeedback
            : [];
          console.log(`✅ [${sessionId}] Gemini analysis complete. Final Score: ${finalScore}/100`);
          this.askedQuestions.delete(sessionId);
          return {
            overallScore: finalScore,
            strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
            improvements: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
            recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
            actionPlan: Array.isArray(analysis.actionPlan) ? analysis.actionPlan : [],
            skillsDemonstrated: Array.isArray(analysis.skillsDemonstrated) ? analysis.skillsDemonstrated : [],
            skillsToPractice: Array.isArray(analysis.skillsToPractice) ? analysis.skillsToPractice : [],
            questionFeedback,
            summary: analysis.summary || '',
            detailedFeedback: analysis.summary || '',
          };
        }
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini analysis failed, using intelligent fallback:`, error.message);
      }
    }

    const analysis = this.generateIntelligentFeedback(ctx.title, questions, baseScore, ctx);
    console.log(`✅ [${sessionId}] Fallback analysis complete. Final Score: ${analysis.overallScore}/100`);
    this.askedQuestions.delete(sessionId);
    return analysis;
  }

  async analyzeInterview(jobRole, questions, fullTranscript, sessionId = 'video', jobContext = {}) {
    return this.analyzeInterviewForEmail(jobRole, questions, fullTranscript, sessionId, jobContext);
  }

  generateIntelligentFeedback(jobRole, questions, score, jobContext = {}) {
    const ctx = this.formatJobContext({ ...jobContext, title: jobRole }, jobRole);
    const strengths = [];
    const improvements = [];
    const recommendations = [];
    const questionFeedback = [];
    const skillsToPractice = [...(ctx.skills || [])].slice(0, 6);
    const skillsDemonstrated = [];

    (questions || []).forEach((q, i) => {
      const answer = String(q.transcript || q.answer || '').trim();
      const label = q.question || `Question ${i + 1}`;
      const words = answer ? answer.split(/\s+/).length : 0;
      const evalLabel = q.evaluation || (words < 12 ? 'incorrect' : words < 40 ? 'partial' : 'correct');

      if (!answer) {
        improvements.push(`You did not answer: "${label.slice(0, 90)}". Prepare a 60-90 second STAR story for it.`);
        questionFeedback.push({
          question: label,
          whatWentWell: 'No answer was recorded for this question.',
          whatToImprove: 'Pause, then give a specific example with situation, what you did, and the result.',
          betterAnswer: `For a ${ctx.title} interview, answer with one real example, the action you took, and a measurable outcome.`,
        });
        return;
      }

      if (evalLabel === 'correct' || words >= 50) {
        strengths.push(`On "${label.slice(0, 70)}..." you gave a substantial answer (${words} words).`);
        skillsDemonstrated.push(`Q${i + 1} response`);
        questionFeedback.push({
          question: label,
          whatWentWell: `You covered this with a ${words}-word answer${q.reason ? ` (${q.reason})` : ''}. Keep the concrete details.`,
          whatToImprove: 'Add one metric or result so a hiring manager can see impact.',
          betterAnswer: `Keep your example, then add: what changed because of your work, and how it would apply as a ${ctx.title}${ctx.company ? ` at ${ctx.company}` : ''}.`,
        });
      } else if (evalLabel === 'partial') {
        improvements.push(`Your answer to "${label.slice(0, 70)}..." was thin. Expand with one project example.`);
        questionFeedback.push({
          question: label,
          whatWentWell: `You started an answer (${words} words) but it lacked depth for a ${ctx.title} interview.`,
          whatToImprove: 'Name the situation, your action, and the outcome. Tie it to this job.',
          betterAnswer: `A stronger answer: pick a real example related to ${ctx.skills[0] || ctx.title}, describe the problem, what you did, and the result.`,
        });
      } else {
        improvements.push(`"${label.slice(0, 70)}..." needed a real example, not a short reply.`);
        questionFeedback.push({
          question: label,
          whatWentWell: words ? 'You attempted the question.' : 'No useful answer was captured.',
          whatToImprove: 'Practice a 60-second spoken answer with a specific story.',
          betterAnswer: `For ${ctx.title}, interviewers want a concrete story. Use STAR and mention ${ctx.skills.slice(0, 2).join(' or ') || 'a relevant skill'}.`,
        });
      }
    });

    if (ctx.skills.length) {
      recommendations.push(
        `Practice speaking 60-second examples for: ${ctx.skills.slice(0, 5).join(', ')}.`
      );
    }
    if (ctx.company) {
      recommendations.push(`Research ${ctx.company} and prepare why you want this ${ctx.title} role there.`);
    }
    recommendations.push(`Rewrite a STAR answer for each weak question above and say it out loud twice.`);
    recommendations.push(`Retry this ${ctx.title} mock interview after practicing those stories.`);
    if (ctx.description) {
      recommendations.push('Re-read the job description and map one example to each main requirement.');
    }

    if (!strengths.length) {
      strengths.push(`You completed a ${ctx.title} mock interview — that is a start.`);
    }
    if (!improvements.length) {
      improvements.push(`Add measurable results when you describe work relevant to ${ctx.title}.`);
    }

    const summary =
      score >= 80
        ? `Solid ${ctx.title} practice. You gave usable answers on several questions; tighten them with metrics and job-specific language.`
        : score >= 60
          ? `You showed some fit for ${ctx.title}, but several answers were too light. Use the per-question notes below and practice out loud.`
          : `This ${ctx.title} round needs more specific examples. The notes below tell you exactly which questions to rebuild before a real interview.`;

    return {
      overallScore: Math.max(0, Math.min(100, Math.round(score))),
      strengths: strengths.slice(0, 8),
      improvements: improvements.slice(0, 8),
      recommendations: recommendations.slice(0, 8),
      actionPlan: recommendations.slice(0, 6),
      skillsDemonstrated: [...new Set(skillsDemonstrated)].slice(0, 8),
      skillsToPractice: skillsToPractice,
      questionFeedback,
      summary,
      detailedFeedback: summary,
    };
  }

  getUniqueQuestion(jobRole, difficulty, sessionId, jobContext = {}) {
    const ctx = this.formatJobContext({ ...jobContext, title: jobRole }, jobRole);
    const category = this.inferRoleCategory(ctx.title);
    const bank = this.questionBank[category] || this.questionBank.default;
    const fromBank = bank[difficulty] || bank.easy || [];
    const skillQs = (ctx.skills || []).slice(0, 6).map((skill) => {
      if (difficulty === 'hard') {
        return `If you joined as ${ctx.title}${ctx.company ? ` at ${ctx.company}` : ''}, how would you raise the quality of work involving ${skill} in your first 90 days?`;
      }
      if (difficulty === 'medium') {
        return `Walk me through a time you used ${skill} to solve a messy problem that would matter as a ${ctx.title}.`;
      }
      return `This ${ctx.title} role needs ${skill}. Tell me about a specific project where you used it, and what the outcome was.`;
    });
    const roleQs = [
      `Why do you want to be a ${ctx.title}${ctx.company ? ` at ${ctx.company}` : ''}, and which part of the job matches your experience?`,
      `What part of the ${ctx.title} job do you think is hardest day to day, and how have you handled something similar?`,
    ];
    const questions = [...skillQs, ...fromBank, ...roleQs];
    const askedInSession = this.askedQuestions.get(sessionId) || [];
    const availableQuestions = questions.filter((q) => !askedInSession.includes(q));
    const questionPool = availableQuestions.length > 0 ? availableQuestions : questions;
    const question = questionPool[Math.floor(Math.random() * questionPool.length)];
    this.trackQuestion(sessionId, question);
    return question;
  }

  trackQuestion(sessionId, question) {
    if (!this.askedQuestions.has(sessionId)) {
      this.askedQuestions.set(sessionId, []);
    }
    this.askedQuestions.get(sessionId).push(question);
  }

  cleanQuestion(text) {
    return text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^Question:\s*/i, '')
      .trim();
  }

  parseJsonFromText(text) {
    if (!text) return null;
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const block = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (block) jsonMatch = [block[1]];
    }
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  /**
   * Detailed Gemini analysis for a job application (candidate-facing).
   */
  async analyzeApplication(ctx) {
    const {
      jobTitle,
      companyName,
      jobDescription = '',
      jobSkills = [],
      resumeText = '',
      coverLetter = '',
      candidateSkills = [],
      candidateExperience = '',
      applicationStatus = 'pending',
    } = ctx;

    const jdSkills = Array.isArray(jobSkills) ? jobSkills : [];
    const candSkills = Array.isArray(candidateSkills) ? candidateSkills : [];
    const resumeSnippet = (resumeText || '').trim().slice(0, 3500);
    const coverSnippet = (coverLetter || '').trim().slice(0, 1200);

    const normalize = (s) => String(s).toLowerCase().trim();
    const jdNorm = jdSkills.map(normalize);
    const matchingSkills = candSkills.filter((s) => jdNorm.includes(normalize(s)));
    const missingSkills = jdSkills.filter((s) => !candSkills.some((c) => normalize(c) === normalize(s)));
    const keywordScore =
      jdSkills.length > 0
        ? Math.round((matchingSkills.length / jdSkills.length) * 100)
        : resumeSnippet.length > 100
          ? 55
          : 40;

    if (this.model) {
      try {
        const prompt = `You are a supportive career coach helping a job candidate improve their application.

Job: ${jobTitle} at ${companyName}
Status: ${applicationStatus}
Required skills: ${jdSkills.join(', ') || 'Not specified'}
Job description excerpt: ${jobDescription.slice(0, 2000)}

Candidate skills: ${candSkills.join(', ') || 'Not listed'}
Experience: ${candidateExperience || 'Not provided'}
Resume/profile excerpt: ${resumeSnippet || 'Limited profile data'}
Cover letter: ${coverSnippet || 'None'}

Return ONLY valid JSON:
{
  "matchScore": <0-100 integer>,
  "summary": "<2 sentences overall assessment>",
  "explanation": "<3-4 sentences: fit for role, what stood out, gaps>",
  "matchingSkills": ["<skills candidate has that match>"],
  "missingSkills": ["<important gaps>"],
  "strengths": ["<4-5 specific strengths from their profile>"],
  "improvements": ["<4-6 areas to improve, be specific>"],
  "actionPlan": ["<5-7 concrete steps they can take this week>"],
  "resumeTips": ["<3-4 resume/CV improvements>"],
  "interviewTips": ["<3-4 interview prep tips for this role>"],
  "tags": ["<5-8 relevant keywords>"]
}

Be encouraging but honest. Tailor advice to this exact role.`;

        const result = await this.model.generateContent(prompt);
        const parsed = this.parseJsonFromText((await result.response).text());

        if (parsed && typeof parsed.matchScore === 'number') {
          const matchScore = Math.max(0, Math.min(100, Math.round(parsed.matchScore)));
          return {
            matchScore,
            matchInsights: {
              matchScore,
              summary: parsed.summary || parsed.explanation?.slice(0, 200) || '',
              explanation: parsed.explanation || parsed.summary || '',
              matchingSkills: Array.isArray(parsed.matchingSkills) ? parsed.matchingSkills : matchingSkills,
              missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : missingSkills,
              tags: Array.isArray(parsed.tags) ? parsed.tags : [],
              strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
              improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
              actionPlan: Array.isArray(parsed.actionPlan) ? parsed.actionPlan : [],
              resumeTips: Array.isArray(parsed.resumeTips) ? parsed.resumeTips : [],
              interviewTips: Array.isArray(parsed.interviewTips) ? parsed.interviewTips : [],
              analyzedAt: new Date(),
              source: 'gemini',
            },
          };
        }
      } catch (error) {
        console.warn('⚠️ Gemini application analysis failed:', error.message);
      }
    }

    const matchScore = keywordScore;
    const improvements =
      missingSkills.length > 0
        ? missingSkills.slice(0, 6).map((s) => `Build experience with ${s} — add a project or course to your profile`)
        : ['Add more quantified achievements to your resume (metrics, impact)'];

    return {
      matchScore,
      matchInsights: {
        matchScore,
        summary: `You match ${matchingSkills.length} of ${jdSkills.length || 'several'} key skills for ${jobTitle}.`,
        explanation: `Based on your profile vs this role: ${matchingSkills.length > 0 ? `Strong alignment on ${matchingSkills.slice(0, 4).join(', ')}.` : 'Highlight transferable skills in your resume.'} ${missingSkills.length > 0 ? `Focus on developing: ${missingSkills.slice(0, 4).join(', ')}.` : ''}`,
        matchingSkills: matchingSkills.slice(0, 15),
        missingSkills: missingSkills.slice(0, 15),
        tags: [...matchingSkills, ...missingSkills].slice(0, 10),
        strengths: matchingSkills.length
          ? [`Skills aligned with role: ${matchingSkills.slice(0, 5).join(', ')}`]
          : ['Completed application — profile under review'],
        improvements,
        actionPlan: [
          'Update your profile skills to match the job description keywords',
          'Add 1–2 bullet points per role with measurable outcomes',
          'Practice interview prep for this job title in Talora',
          'Research the company and prepare 3 questions for HR',
        ],
        resumeTips: [
          'Lead with skills that appear in the job posting',
          'Use action verbs and numbers (%, $, time saved)',
        ],
        interviewTips: [
          `Prepare STAR stories for ${jobTitle} responsibilities`,
          'Review the job description and map your experience to each requirement',
        ],
        analyzedAt: new Date(),
        source: 'fallback',
      },
    };
  }

  cleanupOldSessions() {
    if (this.askedQuestions.size > 100) {
      console.log('🧹 Cleaning up old session questions...');
      this.askedQuestions.clear();
    }
  }
}

module.exports = new GeminiService();

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

  initializeQuestionBank() {
    return {
      'Software Engineer': {
        easy: [
          'Tell me about a recent project you worked on and what technologies you used.',
          'What programming languages are you most comfortable with and why?',
          'How do you typically approach debugging a complex issue?',
          'Describe your experience with version control systems like Git.',
          'What motivates you to work in software development?'
        ],
        medium: [
          'Explain a time when you had to optimize code for better performance.',
          'How do you ensure code quality in your projects?',
          'Describe your experience with agile development methodologies.',
          'Tell me about a technical challenge you faced and how you solved it.',
          'How do you stay updated with new technologies and programming trends?'
        ],
        hard: [
          'Design a scalable system for handling millions of concurrent users.',
          'Explain the trade-offs between different database architectures.',
          'How would you approach refactoring a legacy codebase?',
          'Describe your experience with microservices architecture.',
          'What strategies do you use for system design and architecture decisions?'
        ]
      },
      'default': {
        easy: [
          'Tell me about yourself and your professional background.',
          'What interests you about this role?',
          'Describe a typical day in your current or most recent position.',
          'What are your key strengths that make you suitable for this role?',
          'How do you handle working under pressure?'
        ],
        medium: [
          'Describe a challenging situation you faced at work and how you handled it.',
          'Tell me about a time you had to work with a difficult team member.',
          'How do you prioritize tasks when you have multiple deadlines?',
          'Give an example of when you had to learn something new quickly.',
          'Describe a project where you took initiative.'
        ],
        hard: [
          'Where do you see yourself in 5 years and how does this role fit?',
          'Tell me about a time you failed and what you learned from it.',
          'How would you handle a situation where you disagree with your manager?',
          'Describe your leadership style and give an example.',
          'What would you do if you discovered a major error in a completed project?'
        ]
      }
    };
  }

  async generateFirstQuestion(jobRole, skills, sessionId) {
    console.log(`🎤 [${sessionId}] Generating first question for ${jobRole}...`);
    
    // Try Gemini first
    if (this.model) {
      try {
        const skillHint = Array.isArray(skills) && skills.length ? skills.slice(0, 3).join(', ') : 'general skills';
        const randomSeed = Math.random().toString(36).substring(7);
        
        const prompt = `You are a voice interviewer starting a mock interview for ${jobRole}. Generate ONE short, spoken-friendly opening question (easy difficulty). Relevant skills: ${skillHint}. Seed: ${randomSeed}. Return ONLY the question text, no quotes or labels.`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const question = this.cleanQuestion(response.text());
        
        this.trackQuestion(sessionId, question);
        console.log(`✅ [${sessionId}] Gemini generated: "${question.substring(0, 60)}..."`);
        return question;
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini failed, using fallback:`, error.message);
      }
    }
    
    // Intelligent fallback
    const question = this.getUniqueQuestion(jobRole, 'easy', sessionId);
    console.log(`✅ [${sessionId}] Fallback generated: "${question.substring(0, 60)}..."`);
    return question;
  }

  async decideNextQuestion(jobRole, skills, evaluation, askedCount, sessionId, previousQuestions = [], previousAnswer = '') {
    const difficulty = evaluation === 'correct' ? 'hard' : evaluation === 'partial' ? 'medium' : 'easy';
    console.log(`🎯 [${sessionId}] Generating ${difficulty} question #${askedCount + 1}...`);
    
    // Try Gemini first
    if (this.model) {
      try {
        const skillHint = Array.isArray(skills) && skills.length ? skills.slice(0, 3).join(', ') : 'role-related skills';
        const askedInSession = this.askedQuestions.get(sessionId) || [];
        const allPrevious = [...askedInSession, ...previousQuestions];
        const randomSeed = Math.random().toString(36).substring(7);
        const answerContext = previousAnswer?.trim()
          ? ` Candidate's last answer (use for a natural follow-up when appropriate): "${previousAnswer.trim().slice(0, 500)}".`
          : '';
        
        const prompt = `You are a friendly voice interviewer for a ${jobRole} role. Generate ONE unique ${difficulty} difficulty spoken interview question. Skills: ${skillHint}. Seed: ${randomSeed}.${answerContext} Do NOT repeat: ${allPrevious.join('; ')}. Return ONLY the question text, no quotes or labels.`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const question = this.cleanQuestion(response.text());
        
        this.trackQuestion(sessionId, question);
        console.log(`✅ [${sessionId}] Gemini generated: "${question.substring(0, 60)}..."`);
        return { question, difficulty };
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini failed, using fallback`);
      }
    }
    
    // Intelligent fallback
    const question = this.getUniqueQuestion(jobRole, difficulty, sessionId);
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
        hint: `That's okay. Here's a tip: think about a project or situation where you used skills relevant to ${jobRole}, even in school or a side project. Want to try answering with that in mind?`
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
        const prompt = `Evaluate this interview answer. Role: ${jobRole}. Question: ${question}. Answer: ${answer}. Return JSON: {"evaluation": "correct|partial|incorrect", "penalty": 0-20, "reason": "brief reason"}`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
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

  async analyzeInterviewForEmail(jobRole, questions, fullTranscript, sessionId) {
    console.log(`📊 [${sessionId}] Analyzing interview...`);
    
    // Calculate base score from penalties
    const totalPenalties = questions.reduce((sum, q) => sum + (q.penalty || 10), 0);
    const maxPenalties = questions.length * 20;
    const baseScore = Math.max(0, Math.round(100 - (totalPenalties / maxPenalties) * 100));

    console.log(`📊 [${sessionId}] Base score from penalties: ${baseScore}/100`);
    
    // Try Gemini first
    if (this.model) {
      try {
        const prompt = `Analyze this ${jobRole} interview. Base score: ${baseScore}/100. Transcript: ${fullTranscript}. Return JSON: {"finalScore": 0-100, "strengths": [4-6 items], "weaknesses": [4-6 items], "recommendations": [5-7 items], "summary": "2-3 sentences"}`;

        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        let jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
          jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) jsonMatch = [jsonMatch[1]];
        }

        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          const finalScore = Math.max(0, Math.min(100, Math.round(analysis.finalScore || baseScore)));
          
          console.log(`✅ [${sessionId}] Gemini analysis complete. Final Score: ${finalScore}/100`);
          this.askedQuestions.delete(sessionId);
          
          return {
            overallScore: finalScore,
            strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
            improvements: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
            recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
            summary: analysis.summary || 'Good effort overall.'
          };
        }
      } catch (error) {
        console.warn(`⚠️ [${sessionId}] Gemini analysis failed, using intelligent fallback`);
      }
    }
    
    // Intelligent fallback analysis
    const finalScore = baseScore + Math.floor(Math.random() * 11) - 5; // ±5 variation
    const adjustedScore = Math.max(0, Math.min(100, finalScore));
    
    const analysis = this.generateIntelligentFeedback(jobRole, questions, adjustedScore);
    console.log(`✅ [${sessionId}] Fallback analysis complete. Final Score: ${adjustedScore}/100`);
    
    this.askedQuestions.delete(sessionId);
    return analysis;
  }

  generateIntelligentFeedback(jobRole, questions, score) {
    const strengths = [];
    const improvements = [];
    const recommendations = [];
    
    // Analyze based on score
    if (score >= 80) {
      strengths.push('Demonstrated strong understanding of the role requirements');
      strengths.push('Provided detailed and relevant examples');
      strengths.push('Communicated clearly and confidently');
      strengths.push('Showed good problem-solving approach');
      improvements.push('Could provide even more specific metrics or outcomes');
      improvements.push('Consider adding more industry-specific terminology');
      recommendations.push('Continue practicing with real-world scenarios');
      recommendations.push('Research the company culture and values');
      recommendations.push('Prepare questions to ask the interviewer');
    } else if (score >= 60) {
      strengths.push('Showed willingness to engage with questions');
      strengths.push('Demonstrated basic understanding of concepts');
      strengths.push('Maintained professional demeanor');
      improvements.push('Provide more specific examples from experience');
      improvements.push('Structure answers using the STAR method');
      improvements.push('Include more technical details where relevant');
      improvements.push('Work on answer length and depth');
      recommendations.push('Practice the STAR method (Situation, Task, Action, Result)');
      recommendations.push('Prepare 5-7 strong examples from your experience');
      recommendations.push('Research common interview questions for ' + jobRole);
      recommendations.push('Practice speaking your answers out loud');
      recommendations.push('Review technical concepts related to the role');
    } else {
      strengths.push('Completed the interview practice session');
      strengths.push('Showed initiative in preparing for interviews');
      improvements.push('Answers need significantly more detail and examples');
      improvements.push('Focus on providing concrete examples from experience');
      improvements.push('Work on structuring answers more clearly');
      improvements.push('Increase answer length with relevant information');
      improvements.push('Demonstrate deeper understanding of role requirements');
      recommendations.push('Study the STAR method and practice extensively');
      recommendations.push('Prepare detailed examples for each skill area');
      recommendations.push('Practice answering questions for 2-3 minutes each');
      recommendations.push('Record yourself and review your answers');
      recommendations.push('Research the company and role thoroughly');
      recommendations.push('Consider mock interviews with a friend or mentor');
      recommendations.push('Review job description and align your experience');
    }
    
    const summary = score >= 80 
      ? 'Strong performance overall. You demonstrated good knowledge and communication skills. With minor refinements, you\'ll be well-prepared for real interviews.'
      : score >= 60
      ? 'Decent performance with room for improvement. Focus on providing more specific examples and structuring your answers better. Keep practicing!'
      : 'Needs significant improvement. Focus on preparing detailed examples and practicing your delivery. Don\'t be discouraged - every practice session helps you improve!';
    
    return {
      overallScore: score,
      strengths,
      improvements,
      recommendations,
      summary
    };
  }

  getUniqueQuestion(jobRole, difficulty, sessionId) {
    const bank = this.questionBank[jobRole] || this.questionBank['default'];
    const questions = bank[difficulty] || bank['easy'];
    const askedInSession = this.askedQuestions.get(sessionId) || [];
    
    // Find questions not yet asked
    const availableQuestions = questions.filter(q => !askedInSession.includes(q));
    
    // If all questions asked, use any question with variation
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

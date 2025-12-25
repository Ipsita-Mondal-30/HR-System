const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {

    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ CRITICAL: GEMINI_API_KEY not set in environment!');

    console.log("🔥 LOADED GEMINI SERVICE FROM:", __filename);
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("🔥 LOADED GEMINI SERVICE FROM:", __filename);

    // Initialize model - will try gemini-1.5-flash first, fallback handled in methods
    // Note: Model availability depends on API key permissions
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
});

    this.askedQuestions = new Map(); // Track questions per session
  }

  async generateFirstQuestion(jobRole, skills, sessionId) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const skillHint = Array.isArray(skills) && skills.length ? skills.slice(0, 3).join(', ') : 'general skills';
      const randomSeed = Math.random().toString(36).substring(7);
      
      // Add timestamp-based variation for different interview sessions
      const sessionVariation = Date.now().toString().slice(-6);
      const questionTypes = ['experience', 'motivation', 'skills', 'projects', 'challenges', 'goals'];
      const questionType = questionTypes[parseInt(sessionVariation.slice(-1)) % questionTypes.length];
      
      const prompt = `You are a real human interviewer having a natural conversation with a candidate. You're warm, professional, and genuinely interested in learning about them.

Job Role: ${jobRole}
Required Skills: ${skillHint}
Question Focus: ${questionType}
Unique Session ID: ${sessionVariation}

Generate ONE natural, conversational opening question that feels like a real person asking (not a robot reading a script).

IMPORTANT GUIDELINES:
- Write as if you're speaking naturally to someone, not reading from a list
- Make it specific to ${jobRole} role and ${skillHint} skills
- Use natural language variations - don't follow templates
- Make it feel like you genuinely want to know about them
- Keep it warm and welcoming
- Easy to answer (opening question)
- DO NOT use phrases like "tell me about yourself" or generic templates
- Vary your language - use different phrasings than typical interview scripts

Question should focus on: ${questionType === 'experience' ? 'their background and experience' : questionType === 'motivation' ? 'what drew them to this field' : questionType === 'skills' ? 'their technical skills' : questionType === 'projects' ? 'recent projects they worked on' : questionType === 'challenges' ? 'challenges they faced' : 'their career goals'}

Return ONLY the question text. No quotes, no prefixes, no formatting. Just the question as you would naturally ask it.`;

      console.log(`🎤 [${sessionId}] Generating first question for ${jobRole}...`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const question = this.cleanQuestion(response.text());
      
      // Track this question
      if (!this.askedQuestions.has(sessionId)) {
        this.askedQuestions.set(sessionId, []);
      }
      this.askedQuestions.get(sessionId).push(question);
      
      console.log(`✅ [${sessionId}] Generated: "${question.substring(0, 60)}..."`);
      return question;
    } catch (error) {
      console.error(`❌ [${sessionId}] Error generating first question:`, error.message);
      console.log(`⚠️ [${sessionId}] Using fallback question generation`);
      // Generate intelligent fallback question
      return this.generateFallbackFirstQuestion(jobRole, skills, sessionId);
    }
  }

  generateFallbackFirstQuestion(jobRole, skills, sessionId) {
    // Use actual skills from the job, not generic terms
    const specificSkills = Array.isArray(skills) && skills.length 
      ? skills.filter(s => s && s.trim().length > 0).slice(0, 2)
      : [];
    const skillText = specificSkills.length > 0 
      ? specificSkills.join(' and ')
      : 'the required technical skills';
    
    // Add more variety with timestamp-based selection
    const variation = Date.now().toString().slice(-3);
    const questionTemplates = [
      `I'm curious - what got you interested in ${jobRole} work in the first place?`,
      `Before we dive in, I'd love to hear about a recent project where you worked with ${skillText}. What was that like?`,
      `What do you find most engaging about working as a ${jobRole}?`,
      `Can you walk me through your experience with ${skillText}? I'm interested in your background there.`,
      `I'd like to understand your journey - what drew you to pursue ${jobRole} as a career?`,
      `Tell me about your experience with ${skillText}. What have you worked on that you're particularly proud of?`,
      `What aspects of ${jobRole} work do you find most challenging, and how do you approach those challenges?`,
      `I'm interested in your background - can you share a bit about how you got started with ${skillText}?`
    ];
    
    // Use sessionId and timestamp for better randomization
    const randomIndex = (parseInt(variation) + sessionId.charCodeAt(0) + Date.now()) % questionTemplates.length;
    const question = questionTemplates[randomIndex];
    
    console.log(`✅ [${sessionId}] Fallback question: "${question.substring(0, 60)}..."`);
    return question;
  }

  async decideNextQuestion(jobRole, skills, evaluation, askedCount, sessionId, previousQuestions = [], previousAnswer = '') {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const difficulty = evaluation === 'correct' ? 'harder' : evaluation === 'partial' ? 'medium' : 'easier';
      
      // Get previously asked questions for this session
      const askedInSession = this.askedQuestions.get(sessionId) || [];
      const allPrevious = [...askedInSession, ...previousQuestions];
      
      // Ensure we reference actual skills, not generic terms
      const specificSkills = Array.isArray(skills) && skills.length 
        ? skills.filter(s => s && s.trim().length > 0).slice(0, 3)
        : [];
      const skillsText = specificSkills.length > 0 
        ? specificSkills.join(', ')
        : `${jobRole}-related technical skills`;

      // Build conversation context
      const conversationHistory = allPrevious.length > 0 
        ? allPrevious.slice(-3).map((q, i) => `Q${allPrevious.length - 3 + i + 1}: ${q}`).join('\n')
        : '';

      // Extract key topics/entities from previous answer for better connection
      const previousAnswerSummary = previousAnswer 
        ? `Key things they mentioned: ${previousAnswer.substring(0, 300)}`
        : '';

      const prompt = `You are a real human interviewer in a natural, flowing conversation. You're genuinely interested and your questions naturally build on what they just said. This feels like talking to a colleague, not reading questions from a list.

Job Role: ${jobRole}
Required Technical Skills: ${skillsText}
Difficulty Level: ${difficulty} (based on their previous answer quality: ${evaluation})
Question Number: ${askedCount + 1} of ~6

${previousAnswer ? `WHAT THE CANDIDATE JUST SAID:
"${previousAnswer.substring(0, 600)}${previousAnswer.length > 600 ? '...' : ''}"
${previousAnswerSummary}

CRITICAL: Your next question MUST flow naturally from their answer. It should feel like you're genuinely curious about something specific they mentioned.

EFFECTIVE CONVERSATION FLOW EXAMPLES:
- If they mentioned "React" → "I see. You mentioned using React - how did you approach state management when the app grew larger?"
- If they said "worked on a project" → "That sounds interesting. Can you walk me through how you structured that project from the start?"
- If they mentioned "faced challenges" → "Right. You mentioned some challenges - what was your approach to solving those?"
- If they talked about "team collaboration" → "Got it. How did you handle communication when working with that team?"

Your question should feel like a natural follow-up - like you're genuinely interested in what they said.` : ''}

${conversationHistory ? `CONVERSATION SO FAR:
${conversationHistory}

Remember: Keep building on what was discussed. Each question should grow from the last answer.` : ''}

CONVERSATION RULES:
1. ALWAYS start with a brief acknowledgment (1-3 words): "I see", "That's interesting", "Hmm, okay", "Right", "Got it", "Interesting"
2. Your question MUST directly reference something they just mentioned - a specific technology, project, challenge, approach, etc.
3. Make it feel natural - like you're genuinely curious about what they said
4. Use conversational, friendly language - not formal interview script language
5. Keep the thread going - build on their answer, don't jump to a new topic

Generate as TWO parts separated by "|||":
Part 1: Brief acknowledgment (like "I see", "That's interesting", "Right", "Got it")
Part 2: Your next question that DIRECTLY references something specific from their last answer

Example format: "That's interesting ||| You mentioned using React there - how do you typically handle state management in larger applications?"

Return ONLY the text in format: "[acknowledgment] ||| [connected question]"`;

      console.log(`🎯 [${sessionId}] Generating conversational ${difficulty} question #${askedCount + 1}...`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let fullResponse = this.cleanQuestion(response.text());
      
      // Parse acknowledgment and question
      let acknowledgment = '';
      let question = fullResponse;
      
      if (fullResponse.includes('|||')) {
        const parts = fullResponse.split('|||').map(p => p.trim());
        acknowledgment = parts[0] || '';
        question = parts[1] || parts[0] || fullResponse;
      }
      
      // Add natural fillers more organically if no acknowledgment was generated
      if (!acknowledgment && askedCount > 0 && Math.random() < 0.4) {
        const fillers = ['Hmm, ', 'Okay, ', 'Alright, ', 'I see, ', 'Got it, '];
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        acknowledgment = filler.trim();
      }
      
      // Combine acknowledgment + question
      if (acknowledgment && question) {
        question = `${acknowledgment} ${question.charAt(0).toLowerCase() + question.slice(1)}`;
      }
      
      // Track this question
      if (!this.askedQuestions.has(sessionId)) {
        this.askedQuestions.set(sessionId, []);
      }
      this.askedQuestions.get(sessionId).push(question);
      
      console.log(`✅ [${sessionId}] Generated conversational question: "${question.substring(0, 80)}..."`);
      return { question, difficulty };
    } catch (error) {
      console.error(`❌ [${sessionId}] Error generating next question:`, error.message);
      console.log(`⚠️ [${sessionId}] Using fallback question generation`);
      // Generate intelligent fallback question
      return this.generateFallbackNextQuestion(jobRole, skills, evaluation, askedCount, sessionId, previousQuestions, previousAnswer);
    }
  }

  generateFallbackNextQuestion(jobRole, skills, evaluation, askedCount, sessionId, previousQuestions = [], previousAnswer = '') {
    // Use actual skills from the job
    const specificSkills = Array.isArray(skills) && skills.length 
      ? skills.filter(s => s && s.trim().length > 0).slice(0, 2)
      : [];
    const skillText = specificSkills.length > 0 
      ? specificSkills.join(' and ')
      : 'the technical requirements';
    const singleSkill = specificSkills.length > 0 ? specificSkills[0] : 'your technical skills';
    
    const difficulty = evaluation === 'correct' ? 'harder' : evaluation === 'partial' ? 'medium' : 'easier';
    const variation = Date.now().toString().slice(-3);
    
    const questionTemplates = {
      easy: [
        `I'd like to understand your background better - can you tell me about your experience working with ${skillText}?`,
        `What's been your favorite part about working as a ${jobRole} so far?`,
        `Can you walk me through what a typical project looks like for you as a ${jobRole}?`,
        `How did you first get interested in ${jobRole} work?`,
        `I'm curious about your journey - what led you to focus on ${singleSkill}?`
      ],
      medium: [
        `Can you walk me through a challenging project you worked on that involved ${skillText}? What made it challenging?`,
        `When you're facing a complex problem in ${jobRole} work, what's your approach? Can you give me an example?`,
        `Tell me about a time you had to quickly learn something new related to ${singleSkill} for a project. How did that go?`,
        `How do you stay up to date with changes and trends in ${skillText}? What resources do you use?`,
        `Can you describe a situation where you had to collaborate with others on a ${jobRole} project? What was your role?`
      ],
      hard: [
        `Let's say you're designing a complex system for ${jobRole}. Walk me through your thought process and how you'd approach it.`,
        `Tell me about a time you had to make a really difficult technical decision involving ${skillText}. What factors did you consider?`,
        `Imagine you're working on a ${jobRole} project with conflicting requirements and tight deadlines. How would you prioritize and handle that?`,
        `What's the most technically challenging problem you've solved in ${jobRole} work? I'd love to hear how you approached it.`,
        `If you were architecting a large-scale solution using ${skillText}, what would be your key considerations and why?`
      ]
    };
    
    const templates = questionTemplates[difficulty === 'harder' ? 'hard' : difficulty === 'easier' ? 'easy' : 'medium'];
    let question;
    let attempts = 0;
    
    // Try to find a question that's not in previousQuestions with better randomization
    do {
      const randomIndex = (parseInt(variation) + askedCount * 7 + attempts * 13 + sessionId.charCodeAt(0)) % templates.length;
      question = templates[randomIndex];
      attempts++;
    } while (previousQuestions.includes(question) && attempts < templates.length);
    
    // If all questions were used, add variation
    if (previousQuestions.includes(question)) {
      const variations = [
        ', and can you walk me through a specific example?',
        '. I\'m particularly interested in the technical details.',
        '. What challenges did you face?',
        '? How did you approach it?'
      ];
      const variationIndex = (askedCount + parseInt(variation)) % variations.length;
      question = question.replace(/\?$/, variations[variationIndex]);
    }
    
    // Add conversational filler if appropriate (not on first question, sometimes)
    if (askedCount > 0 && Math.random() < 0.4) {
      const fillers = ['Hmm, ', 'Okay, ', 'Alright, ', 'I see, ', 'Got it, '];
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      question = `${filler}${question.charAt(0).toLowerCase() + question.slice(1)}`;
    }
    
    console.log(`✅ [${sessionId}] Fallback ${difficulty} question: "${question.substring(0, 60)}..."`);
    return { question, difficulty: difficulty === 'harder' ? 'hard' : difficulty };
  }

  async evaluateAnswer(jobRole, question, answer, sessionId) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      const lowerAnswer = answer.toLowerCase().trim();
      
      // Handle "I don't know" responses with hints and reassurance
      const dontKnowPhrases = /\b(i\s+don'?t\s+know|i'm\s+not\s+sure|i\s+have\s+no\s+idea|not\s+really|not\s+sure|unclear|unsure)\b/gi;
      if (dontKnowPhrases.test(answer) && answer.trim().length < 50) {
        console.log(`💡 [${sessionId}] Candidate said they don't know - will provide hint`);
        return { 
          evaluation: 'partial', 
          penalty: 8, 
          confidenceLevel: 'low',
          needsHint: true,
          hint: `That's okay! Here's a hint: Think about ${question.substring(0, 100)}. What aspects of this have you encountered before?`
        };
      }

      // Quick checks
      if (!answer || answer.trim().length < 5) {
        console.log(`⚠️ [${sessionId}] Very short answer, marking as incorrect`);
        return { evaluation: 'incorrect', penalty: 15, confidenceLevel: 'low', needsRepetition: true };
      }

      if (answer.trim().length < 20) {
        console.log(`⚠️ [${sessionId}] Short answer, likely partial`);
        return { evaluation: 'partial', penalty: 10, confidenceLevel: 'medium' };
      }

      // Detect confidence/hesitation from answer text
      const confidenceLevel = this.detectConfidenceLevel(answer);
      console.log(`🎯 [${sessionId}] Confidence level detected: ${confidenceLevel}`);

      const prompt = `You are an expert interview evaluator.

Role: ${jobRole}
Question: ${question}
Candidate's Answer: ${answer}

Evaluate this answer and return a JSON object with:
{
  "evaluation": "correct" | "partial" | "incorrect",
  "penalty": <number 0-20>,
  "reason": "<brief reason>"
}

Evaluation criteria:
- "correct" (penalty 0-5): Good answer, relevant, demonstrates understanding
- "partial" (penalty 6-12): Incomplete, needs more detail, somewhat relevant
- "incorrect" (penalty 13-20): Off-topic, wrong, very poor, or too vague

Penalty guidelines:
- 0-3: Excellent answer
- 4-7: Good answer with minor issues
- 8-12: Acceptable but needs improvement
- 13-16: Poor answer
- 17-20: Very poor or irrelevant answer

Special handling:
- If candidate seems unsure or says "I don't know", treat as "partial" (penalty 8-10)
- Be understanding and encouraging

Return ONLY valid JSON, no other text.`;

      console.log(`🔍 [${sessionId}] Evaluating answer...`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON
      const jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const evaluation = parsed.evaluation;
        const penalty = Math.max(0, Math.min(20, parsed.penalty || 10));
        
        if (evaluation === 'correct' || evaluation === 'partial' || evaluation === 'incorrect') {
          // Detect confidence/hesitation if not already detected
          const detectedConfidence = confidenceLevel || this.detectConfidenceLevel(answer);
          
          // Check again for "I don't know" patterns
          const lowerAnswer = answer.toLowerCase().trim();
          const dontKnowPhrases = /\b(i\s+don'?t\s+know|i'm\s+not\s+sure|i\s+have\s+no\s+idea|not\s+really|not\s+sure|unclear|unsure)\b/gi;
          const isDontKnow = dontKnowPhrases.test(answer) && answer.trim().length < 100;
          
          if (isDontKnow) {
            console.log(`💡 [${sessionId}] Candidate expressed uncertainty - providing reassurance`);
            return { 
              evaluation: 'partial', 
              penalty: 8, 
              reason: parsed.reason, 
              confidenceLevel: 'low',
              needsHint: true,
              hint: `That's completely okay! Let me give you a hint. Think about ${question.substring(0, 150)}. What comes to mind, even if it's just a small part?`
            };
          }
          
          console.log(`✅ [${sessionId}] Evaluation: ${evaluation}, Penalty: ${penalty}, Confidence: ${detectedConfidence}`);
          return { evaluation, penalty, reason: parsed.reason, confidenceLevel: detectedConfidence };
        }
      }
      
      console.log(`⚠️ [${sessionId}] Could not parse evaluation, using default`);
      const detectedConfidence = confidenceLevel || this.detectConfidenceLevel(answer);
      return { evaluation: 'partial', penalty: 10, confidenceLevel: detectedConfidence };
    } catch (error) {
      console.error(`❌ [${sessionId}] Error evaluating answer:`, error.message);
      const detectedConfidence = this.detectConfidenceLevel(answer);
      return { evaluation: 'partial', penalty: 10, confidenceLevel: detectedConfidence };
    }
  }

  detectConfidenceLevel(answer) {
    const lowerAnswer = answer.toLowerCase();
    
    // Detect hesitation markers
    const hesitationMarkers = /\b(um+|uh+|er+|ah+|hmm+|well+\s+|like+\s+|you know+)/gi;
    const hesitationCount = (lowerAnswer.match(hesitationMarkers) || []).length;
    
    // Check for very short answers (potential hesitation)
    const wordCount = answer.trim().split(/\s+/).length;
    const isVeryShort = wordCount < 10;
    
    // Check for uncertainty words
    const uncertaintyWords = /\b(maybe|perhaps|i think|i guess|i suppose|kind of|sort of|probably|might|possibly)/gi;
    const uncertaintyCount = (lowerAnswer.match(uncertaintyWords) || []).length;
    
    // Check for confident indicators (structured, clear explanations)
    const hasStructure = /\b(first|second|third|then|next|finally|because|since|therefore)/gi.test(lowerAnswer);
    const hasExamples = /\b(for example|for instance|specifically|such as)/gi.test(lowerAnswer);
    const isDetailed = wordCount > 30;
    
    // Determine confidence level
    if (hesitationCount >= 3 || (isVeryShort && uncertaintyCount >= 2)) {
      return 'low'; // Hesitation detected
    } else if ((hasStructure && hasExamples) || (isDetailed && uncertaintyCount === 0)) {
      return 'high'; // Confidence detected
    } else {
      return 'medium'; // Neutral
    }
  }

  async analyzeInterviewForEmail(jobRole, questions, fullTranscript, sessionId, bodyLanguageData = []) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }

      // Calculate base score from penalties
      const totalPenalties = questions.reduce((sum, q) => sum + (q.penalty || 10), 0);
      const maxPenalties = questions.length * 20;
      const baseScore = Math.max(0, 100 - (totalPenalties / maxPenalties) * 100);

      const prompt = `You are an expert interview coach providing detailed, constructive feedback on a voice interview.

Job Role: ${jobRole}
Number of Questions: ${questions.length}
Base Score (from answer quality): ${Math.round(baseScore)}/100

Full Interview Transcript:
${fullTranscript}

CRITICAL: Analyze the ACTUAL transcript content above. Generate feedback that is SPECIFIC to what the candidate actually said in this interview. DO NOT use generic feedback - every piece of feedback must reference specific content from their answers.

Analyze this interview and provide comprehensive feedback in JSON format:
{
  "finalScore": <number 0-100, adjust base score by ±10 based on overall performance, communication, and depth>,
  "strengths": [<array of 4-6 SPECIFIC, concrete strengths - reference specific things they said or demonstrated>],
  "weaknesses": [<array of 4-6 SPECIFIC areas needing improvement - reference what they actually said or didn't say>],
  "recommendations": [<array of 5-7 ACTIONABLE, specific improvement tips based on their actual performance>],
  "resources": [<array of 3-5 learning resources with format: {"title": "Resource Name", "url": "https://example.com", "type": "article|course|video|documentation"}>],
  "courses": [<array of 3-5 recommended courses with format: {"title": "Course Name", "platform": "Coursera|Udemy|freeCodeCamp|YouTube|Other", "url": "https://example.com"}>],
  "summary": "<2-3 sentence overall assessment that references specific aspects of their interview performance>"
}

IMPORTANT SCORING GUIDELINES:
- Base score: ${Math.round(baseScore)}/100 (calculated from answer quality)
- Adjust finalScore by ±10 based on: communication clarity, depth of answers, confidence, relevance to role
- finalScore should be between ${Math.max(0, Math.round(baseScore) - 10)} and ${Math.min(100, Math.round(baseScore) + 10)}

FEEDBACK QUALITY REQUIREMENTS:
- Strengths: Be SPECIFIC and reference actual answers (e.g., "You demonstrated strong problem-solving when you explained [specific thing they mentioned]" not "Good problem-solving")
- Weaknesses: Be SPECIFIC based on what they said or didn't say (e.g., "When asked about [topic], your answer lacked concrete examples like specific projects or technologies" not "Need more examples")
- Recommendations: Be ACTIONABLE and tailored to their actual performance (e.g., "Based on your answer about [topic], practice using the STAR method" not "Use STAR method")
- Resources: Provide 3-5 helpful learning resources (articles, documentation, videos) relevant to ${jobRole} and areas needing improvement. Include real URLs when possible (can use common platforms like MDN, React docs, etc.)
- Courses: Provide 3-5 recommended online courses from platforms like Coursera, Udemy, freeCodeCamp, YouTube, etc. relevant to ${jobRole} and skill gaps. Include course titles and platform names.
- Summary: Reference specific aspects of their interview performance, be honest but encouraging
${bodyLanguageData.length > 0 ? `\nOPTIONAL BODY LANGUAGE FEEDBACK (if relevant, use VERY gentle language):
- You MAY gently mention body language tips IF patterns were observed
- Use soft, supportive language like "Try maintaining eye contact" or "Practice steady posture"
- NEVER use judgmental language like "nervous", "lacked confidence", or "poor body language"
- This is ONLY for improvement tips, never for criticism
- Only include if it adds value to their prep` : ''}

Return ONLY valid JSON, no other text.`;

      console.log(`📊 [${sessionId}] Analyzing interview (base score: ${Math.round(baseScore)})...`);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON
      let jsonMatch = text.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) jsonMatch = [jsonMatch[1]];
      }

      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        const finalScore = Math.max(0, Math.min(100, Math.round(analysis.finalScore || baseScore)));
        
        console.log(`✅ [${sessionId}] Analysis complete. Final Score: ${finalScore}/100`);
        
        // Clean up session tracking
        this.askedQuestions.delete(sessionId);
        
        return {
          overallScore: finalScore,
          strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
          improvements: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
          recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
          resources: Array.isArray(analysis.resources) ? analysis.resources : [],
          courses: Array.isArray(analysis.courses) ? analysis.courses : [],
          summary: analysis.summary || 'Good effort overall.'
        };
      }

      throw new Error('Could not parse analysis JSON');
    } catch (error) {
      console.error(`❌ [${sessionId}] Error analyzing interview:`, error.message);
      console.log(`⚠️ [${sessionId}] Using fallback analysis`);
      return this.generateFallbackAnalysis(jobRole, questions, fullTranscript, bodyLanguageData);
    }
  }

  generateFallbackAnalysis(jobRole, questions, fullTranscript, bodyLanguageData = []) {
    // Calculate score from penalties with more nuanced calculation
    const totalPenalties = questions.reduce((sum, q) => sum + (q.penalty || 10), 0);
    const maxPenalties = questions.length * 20;
    const baseScore = 100 - (totalPenalties / maxPenalties) * 100;
    
    // Add variation based on answer quality indicators
    let scoreVariation = 0;
    
    // Analyze answer quality more deeply
    const answerQualities = questions.map(q => {
      const answer = (q.transcript || q.answer || '').trim();
      const wordCount = answer.split(/\s+/).length;
      const hasStructure = /\b(first|second|then|next|finally|because|since)\b/i.test(answer);
      const hasExamples = /\b(for example|for instance|specifically|such as)\b/i.test(answer);
      const hasTechnicalTerms = /(javascript|react|python|node|api|database|algorithm|design|architecture)/i.test(answer);
      
      let quality = 0;
      if (wordCount > 30) quality += 10;
      if (hasStructure) quality += 5;
      if (hasExamples) quality += 5;
      if (hasTechnicalTerms) quality += 5;
      
      return { wordCount, hasStructure, hasExamples, hasTechnicalTerms, quality };
    });
    
    const avgQuality = answerQualities.reduce((sum, q) => sum + q.quality, 0) / answerQualities.length;
    scoreVariation = (avgQuality - 10) * 1.5; // Adjust by quality
    
    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore + scoreVariation)));
    
    // Analyze actual transcript content for personalized feedback
    const transcriptLower = fullTranscript.toLowerCase();
    const wordCounts = questions.map(q => {
      const answer = q.transcript || q.answer || '';
      return answer.split(/\s+/).length;
    });
    const avgAnswerLength = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    
    // Extract specific mentions from transcript
    const mentionsSkills = questions.some(q => {
      const answer = (q.transcript || q.answer || '').toLowerCase();
      return answer.length > 20 && (answer.includes('project') || answer.includes('experience') || answer.includes('worked'));
    });
    
    const hasTechnicalTerms = transcriptLower.includes('javascript') || transcriptLower.includes('react') || 
                             transcriptLower.includes('python') || transcriptLower.includes('database') ||
                             transcriptLower.includes('api') || transcriptLower.includes('system');
    
    const hasExamples = transcriptLower.includes('example') || transcriptLower.includes('for instance') ||
                       transcriptLower.includes('specifically') || transcriptLower.includes('project');
    
    // Generate personalized feedback based on actual content with more analysis
    const strengths = [];
    const improvements = [];
    
    // Analyze structure usage
    const structuredAnswers = answerQualities.filter(q => q.hasStructure).length;
    const exampleAnswers = answerQualities.filter(q => q.hasExamples).length;
    const technicalAnswers = answerQualities.filter(q => q.hasTechnicalTerms).length;
    
    if (avgAnswerLength > 30) {
      strengths.push(`You provided detailed answers averaging ${Math.round(avgAnswerLength)} words, demonstrating thoroughness in your responses`);
    } else if (avgAnswerLength > 15) {
      improvements.push(`Your answers averaged ${Math.round(avgAnswerLength)} words - expand to 40-60 words to provide more depth and context`);
    } else {
      improvements.push(`Your answers were quite brief (${Math.round(avgAnswerLength)} words average) - aim for 40-60 words with specific examples`);
    }
    
    if (structuredAnswers >= questions.length * 0.5) {
      strengths.push(`You structured ${structuredAnswers} out of ${questions.length} answers well, using logical flow and connecting ideas`);
    } else if (structuredAnswers > 0) {
      improvements.push(`Only ${structuredAnswers} of your answers had clear structure - practice using "first, then, finally" or "because, therefore" to organize thoughts`);
    } else {
      improvements.push('Your answers lacked clear structure - organize thoughts using "first, second, finally" or cause-and-effect connections');
    }
    
    if (exampleAnswers >= questions.length * 0.4) {
      strengths.push(`You used concrete examples in ${exampleAnswers} answers, which made your points more tangible and relatable`);
    } else if (exampleAnswers > 0) {
      improvements.push(`You used examples in only ${exampleAnswers} answers - increase to ${Math.ceil(questions.length * 0.6)}+ answers for better impact`);
    } else {
      improvements.push('Your answers lacked concrete examples - include specific projects, technologies, or situations using "for example" or "specifically"');
    }
    
    if (technicalAnswers >= questions.length * 0.5) {
      strengths.push(`You demonstrated technical knowledge in ${technicalAnswers} answers, showing familiarity with ${jobRole} concepts`);
    } else if (technicalAnswers > 0) {
      improvements.push(`You mentioned technical details in only ${technicalAnswers} answers - incorporate more technical terminology relevant to ${jobRole}`);
    } else {
      improvements.push(`For a ${jobRole} role, incorporate technical terminology, tools, and concepts to demonstrate your expertise`);
    }
    
    if (mentionsSkills) {
      strengths.push('You referenced specific projects and work experiences, which added credibility to your answers');
    } else {
      improvements.push('Include specific examples from past projects or work experiences to make your answers more credible and memorable');
    }
    
    // Add score-based feedback with more nuance
    if (finalScore >= 75) {
      strengths.push('Overall, you communicated clearly and demonstrated good understanding throughout the interview');
    } else if (finalScore >= 60) {
      if (strengths.length < 2) {
        strengths.push('You showed engagement and completed all questions thoughtfully');
      }
      improvements.push('Focus on adding more depth and technical detail to elevate your answers to the next level');
    } else {
      if (strengths.length === 0) {
        strengths.push('You completed all interview questions and showed willingness to engage');
      }
      improvements.push('Structure your answers with clear beginning, middle, and end to improve clarity');
      improvements.push('Practice explaining concepts more clearly and confidently before interviews');
    }
    
    // Ensure we have enough items
    if (strengths.length < 3) {
      strengths.push('Showed engagement and willingness to participate');
      strengths.push('Attempted to address all questions thoughtfully');
    }
    
    if (improvements.length < 4) {
      improvements.push('Practice using the STAR method (Situation, Task, Action, Result) for behavioral questions');
      improvements.push('Research the company and role requirements more thoroughly before interviews');
    }
    
    const recommendations = [
      'Practice answering interview questions out loud to improve fluency',
      'Prepare 3-5 specific examples from your experience using the STAR method',
      'Record yourself answering questions and listen for clarity and structure',
      'Research the company and role thoroughly to tailor your answers',
      avgAnswerLength < 30 ? 'Practice giving longer, more detailed responses' : 'Continue practicing to maintain detail while improving precision'
    ];
    
      // Generate default resources and courses based on job role
      const defaultResources = [
        { title: `${jobRole} Interview Guide`, url: 'https://www.interviewbit.com/blog/interview-questions', type: 'article' },
        { title: 'STAR Method for Behavioral Interviews', url: 'https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique', type: 'article' },
        { title: 'Technical Interview Preparation', url: 'https://www.hackerrank.com/interview', type: 'article' }
      ];
      
      const defaultCourses = [
        { title: `${jobRole} Masterclass`, platform: 'Udemy', url: 'https://www.udemy.com' },
        { title: 'Interview Skills Course', platform: 'Coursera', url: 'https://www.coursera.org' },
        { title: 'Technical Interview Prep', platform: 'freeCodeCamp', url: 'https://www.freecodecamp.org' }
      ];

      return {
      overallScore: finalScore,
      strengths: strengths.slice(0, 6),
      improvements: improvements.slice(0, 6),
      recommendations,
      resources: defaultResources,
      courses: defaultCourses,
      summary: finalScore >= 75 
        ? `You performed well with a score of ${finalScore}/100. Your answers demonstrated ${avgAnswerLength > 30 ? 'good depth and detail' : 'adequate detail'}. ${structuredAnswers >= questions.length * 0.5 ? 'You organized your thoughts well' : 'Focus on better structure'}, and ${hasTechnicalTerms ? 'you showed technical knowledge relevant to ' + jobRole : 'incorporate more technical depth'}. Continue practicing to refine your responses further.`
        : finalScore >= 60
        ? `You scored ${finalScore}/100. ${avgAnswerLength > 25 ? 'While your answers had detail' : 'Your answers were somewhat brief'}. ${structuredAnswers > 0 ? 'Some structure was present, but' : 'Focus on'} adding more organization, ${hasTechnicalTerms ? 'and' : 'plus more'} technical terminology specific to ${jobRole}. Practice structuring answers and including concrete examples.`
        : `You scored ${finalScore}/100. ${avgAnswerLength < 25 ? 'Your answers were quite brief' : 'While you answered the questions'}, focus on ${avgAnswerLength < 20 ? 'providing more detailed responses (aim for 40-60 words), ' : ''}structuring your thoughts clearly, and ${mentionsSkills ? 'expanding your examples with more technical detail' : 'including specific examples from your experience'}. Practice organizing answers with clear beginning, middle, and end.`
    };
  }

  cleanQuestion(text) {
    return text
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '') // Remove quotes
      .replace(/^\*\*|\*\*$/g, '') // Remove bold markers
      .replace(/^Question:\s*/i, '') // Remove "Question:" prefix
      .trim();
  }

  // Cleanup old sessions (call periodically)
  cleanupOldSessions() {
    if (this.askedQuestions.size > 100) {
      console.log('🧹 Cleaning up old session questions...');
      this.askedQuestions.clear();
    }
  }
}

module.exports = new GeminiService();

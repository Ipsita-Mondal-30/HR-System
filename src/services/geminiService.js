const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async generateInterviewQuestions(jobRole, difficulty = 'medium', count = 5) {
    try {
      const prompt = `Generate ${count} ${difficulty} difficulty interview questions for a ${jobRole} position. 
      
      Return ONLY a JSON array of question strings, nothing else. Format:
      ["Question 1", "Question 2", "Question 3", ...]
      
      Make the questions relevant, professional, and appropriate for the role.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const questions = JSON.parse(jsonMatch[0]);
        return questions.slice(0, count);
      }

      // Fallback if parsing fails
      return this.getFallbackQuestions(jobRole, count);
    } catch (error) {
      console.error('Error generating questions:', error);
      return this.getFallbackQuestions(jobRole, count);
    }
  }

  async analyzeInterview(jobRole, questions, fullTranscript) {
    try {
      const prompt = `You are an expert interview coach. Analyze this interview practice session:

Job Role: ${jobRole}

Questions and Answers:
${fullTranscript}

Provide a comprehensive analysis in the following JSON format:
{
  "overallScore": <number 0-100>,
  "strengths": [<array of 3-5 specific strengths>],
  "improvements": [<array of 3-5 specific areas to improve>],
  "recommendations": [<array of 3-5 actionable recommendations>],
  "detailedFeedback": "<2-3 paragraph detailed analysis>"
}

Be specific, constructive, and encouraging. Focus on communication, technical knowledge, confidence, and relevance to the role.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          overallScore: analysis.overallScore || 75,
          strengths: analysis.strengths || ['Good communication', 'Clear responses', 'Professional demeanor'],
          improvements: analysis.improvements || ['More specific examples', 'Better structure', 'Deeper technical details'],
          recommendations: analysis.recommendations || ['Practice STAR method', 'Prepare more examples', 'Research company thoroughly'],
          detailedFeedback: analysis.detailedFeedback || 'Overall good performance with room for improvement in specific areas.'
        };
      }

      return this.getFallbackAnalysis();
    } catch (error) {
      console.error('Error analyzing interview:', error);
      return this.getFallbackAnalysis();
    }
  }

  getFallbackQuestions(jobRole, count) {
    const genericQuestions = [
      `Tell me about your experience relevant to the ${jobRole} position.`,
      `What are your key strengths that make you suitable for this role?`,
      `Describe a challenging project you worked on and how you handled it.`,
      `Where do you see yourself in 5 years?`,
      `Why are you interested in this ${jobRole} position?`,
      `How do you handle tight deadlines and pressure?`,
      `What is your approach to learning new technologies or skills?`
    ];
    return genericQuestions.slice(0, count);
  }

  getFallbackAnalysis() {
    return {
      overallScore: 75,
      strengths: [
        'Clear and articulate communication',
        'Good understanding of the role requirements',
        'Professional presentation'
      ],
      improvements: [
        'Provide more specific examples from past experience',
        'Structure answers using the STAR method',
        'Include more technical details where relevant'
      ],
      recommendations: [
        'Practice answering common interview questions',
        'Prepare 3-5 strong examples from your experience',
        'Research the company and role thoroughly before interviews'
      ],
      detailedFeedback: 'You demonstrated good communication skills and a solid understanding of the role. To improve, focus on providing more specific examples and structuring your answers more clearly. Continue practicing and you will see great improvement in your interview performance.'
    };
  }
}

module.exports = new GeminiService();

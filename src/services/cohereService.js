const { CohereClient } = require('cohere-ai');

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY
});

/**
 * Generate interview feedback using Cohere AI
 * @param {Array} questionsAndAnswers - Array of {question, answer} objects
 * @param {Object} jobDetails - Job title and requirements
 * @returns {Promise<Object>} - Structured feedback
 */
async function generateInterviewFeedback(questionsAndAnswers, jobDetails) {
  try {
    console.log('🤖 Generating interview feedback with Cohere AI');

    const prompt = `You are an expert interviewer analyzing a candidate's interview responses for a ${jobDetails.title} position.

Job Requirements:
${jobDetails.requirements || 'General technical role'}

Interview Questions and Answers:
${questionsAndAnswers.map((qa, i) => `
Q${i + 1}: ${qa.question}
A${i + 1}: ${qa.answer}
`).join('\n')}

Analyze the candidate's responses and provide detailed feedback in JSON format with the following structure:
{
  "communicationClarity": {
    "score": <1-10>,
    "comments": "<detailed feedback on how clearly they communicated>"
  },
  "confidence": {
    "score": <1-10>,
    "comments": "<feedback on their confidence level>"
  },
  "relevance": {
    "score": <1-10>,
    "comments": "<how relevant their answers were to the questions>"
  },
  "technicalAccuracy": {
    "score": <1-10>,
    "comments": "<assessment of technical knowledge and accuracy>"
  },
  "overallScore": <1-10>,
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "summary": "<overall summary of the interview performance>"
}

Provide constructive, specific, and actionable feedback.`;

    const response = await cohere.chat({
      message: prompt,
      model: 'command',
      temperature: 0.7
    });

    const feedbackText = response.text;
    
    // Try to parse JSON from response
    let feedback;
    try {
      const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.warn('⚠️ Could not parse JSON, using fallback structure');
      feedback = generateFallbackFeedback(questionsAndAnswers);
    }

    console.log('✅ Interview feedback generated');
    return feedback;
  } catch (error) {
    console.error('❌ Cohere feedback generation error:', error);
    // Return fallback feedback instead of throwing
    return generateFallbackFeedback(questionsAndAnswers);
  }
}

/**
 * Generate fallback feedback when AI fails
 */
function generateFallbackFeedback(questionsAndAnswers) {
  const answerLengths = questionsAndAnswers.map(qa => qa.answer.length);
  const avgLength = answerLengths.reduce((a, b) => a + b, 0) / answerLengths.length;
  
  return {
    communicationClarity: {
      score: avgLength > 100 ? 7 : 5,
      comments: 'Your responses show effort. Focus on being more specific and structured in your answers.'
    },
    confidence: {
      score: 6,
      comments: 'Continue practicing to build confidence. Consider using the STAR method for behavioral questions.'
    },
    relevance: {
      score: 7,
      comments: 'Your answers addressed the questions. Try to provide more concrete examples from your experience.'
    },
    technicalAccuracy: {
      score: 6,
      comments: 'Review technical concepts related to the role. Practice explaining complex topics clearly.'
    },
    overallScore: 6.5,
    strengths: [
      'Completed all interview questions',
      'Showed willingness to engage with the process',
      'Provided thoughtful responses'
    ],
    improvements: [
      'Provide more specific examples from your experience',
      'Practice the STAR method for behavioral questions',
      'Review technical concepts and practice explaining them clearly'
    ],
    summary: 'You completed the practice interview successfully. Focus on providing more detailed, structured responses with specific examples. Keep practicing to build confidence and improve your technical communication.'
  };
}

module.exports = {
  generateInterviewFeedback
};

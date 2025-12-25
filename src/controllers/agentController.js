const axios = require('axios');
const pdfParse = require('pdf-parse');
const Application = require('../models/Application');
const { sendEmail } = require('../utils/email');
const { CohereClient } = require("cohere-ai"); // ✅ New import

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY, // ✅ No .init()
});


// Expanded skill list for keyword matching
const SKILL_KEYWORDS = [
  // Programming Languages
  'Java', 'JavaScript', 'Python', 'TypeScript', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift', 'Kotlin', 'Rust', 'Scala',
  // Web Technologies
  'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Next.js', 'HTML', 'CSS', 'SASS', 'SCSS', 'Tailwind', 'Bootstrap',
  // Backend Frameworks
  'Spring Boot', 'Django', 'Flask', 'FastAPI', 'Laravel', 'Rails', 'ASP.NET', 'NestJS',
  // Databases
  'MongoDB', 'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Oracle', 'SQL Server', 'Cassandra', 'Elasticsearch',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Terraform', 'Ansible',
  // Mobile
  'React Native', 'Flutter', 'iOS', 'Android', 'Xamarin',
  // Data & ML
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Data Science', 'Data Analysis',
  // Other
  'REST API', 'GraphQL', 'Microservices', 'Agile', 'Scrum', 'DevOps', 'Full Stack', 'Frontend', 'Backend'
];

function extractSkills(text) {
  if (!text || typeof text !== 'string') return [];
  
  const found = [];
  const lowerText = text.toLowerCase();
  
  for (const skill of SKILL_KEYWORDS) {
    const skillLower = skill.toLowerCase();
    // Check for exact word match
    if (new RegExp(`\\b${skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      found.push(skill);
    }
  }
  
  return found;
}

// Use AI to extract skills from text
async function extractSkillsWithAI(text, context = '') {
  try {
    const prompt = `Extract all technical skills, programming languages, frameworks, tools, and technologies mentioned in the following text. Return ONLY a JSON array of skill names, nothing else.

${context ? `Context: ${context}\n\n` : ''}Text:
${text.substring(0, 4000)}

Return format: ["Skill1", "Skill2", "Skill3"]`;

    const response = await cohere.chat({
      model: "command-r",
      message: prompt,
      temperature: 0.1,
    });

    const responseText = response.text.trim();
    let jsonText = responseText;
    
    // Extract JSON from markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i) || responseText.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }
    
    try {
      const skills = JSON.parse(jsonText);
      if (Array.isArray(skills)) {
        return skills.filter(s => s && typeof s === 'string').map(s => s.trim()).filter(Boolean);
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse AI-extracted skills:', parseError.message);
    }
    
    return [];
  } catch (error) {
    console.warn('⚠️ AI skill extraction failed:', error.message);
    return [];
  }
}

const getMatchScore = async (req, res) => {
  // Declare variables outside try block so they're accessible in catch
  let application, hrEmail, candidateEmail, candidateName, jobTitle, companyName, resumeUrl;
  let finalScore = 50; // Default score if AI analysis fails
  let parsed = { explanation: "AI analysis could not be completed.", tags: [] };
  let matchingSkills = [];
  let missingSkills = [];
  let resumeText = '';
  let finalResumeSkills = [];
  let finalJdSkills = [];

  try {
    const { applicationId } = req.params;
    console.log('🤖 Starting AI match score calculation for application:', applicationId);

    application = await Application.findById(applicationId)
      .populate({ 
        path: 'job', 
        populate: { path: 'createdBy', select: 'email name' } 
      });

    if (!application || !application.job) {
      console.error('❌ Application or job not found:', applicationId);
      if (res && res.status) {
        return res.status(404).json({ error: "Application or job not found" });
      }
      return;
    }

    resumeUrl = application.resumeUrl;
    const { resumeText: existingResumeText } = application;
    const { description } = application.job;
    hrEmail = application.job.createdBy?.email;
    candidateEmail = application.email;
    candidateName = application.name;
    jobTitle = application.job.title;
    companyName = application.job.companyName;

    console.log(`📧 Application details - HR: ${hrEmail || 'NOT FOUND'}, Candidate: ${candidateEmail}, Job: ${jobTitle}`);

    resumeText = existingResumeText || '';
    
    // Try to parse resume if URL is available
    if (resumeUrl && resumeUrl.startsWith('http')) {
      try {
        console.log('📄 Fetching resume from:', resumeUrl);
        const response = await axios.get(resumeUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const resumeData = await pdfParse(response.data);
        resumeText = resumeData.text;
        console.log('✅ Resume parsed successfully, length:', resumeText.length);
      } catch (resumeError) {
        console.warn('⚠️ Could not fetch resume from URL:', resumeUrl, resumeError.message);
        // Use existing resumeText if available
        if (!resumeText) {
          resumeText = `Resume provided but not accessible.`;
        }
      }
    } else if (existingResumeText) {
      resumeText = existingResumeText;
      console.log('📄 Using existing resume text from application');
    } else {
      // Fallback: create resume text from application data and user profile
      const User = require('../models/User');
      const user = await User.findById(application.candidate);
      if (user) {
        resumeText = `Name: ${user.name}. Email: ${user.email}. Phone: ${user.phone || 'Not provided'}. Skills: ${user.skills?.join(', ') || 'Not specified'}. Experience: ${user.experience || 'Not specified'}. Bio: ${user.bio || 'Not specified'}. Location: ${user.location || 'Not specified'}.`;
        if (application.coverLetter) {
          resumeText += ` Cover Letter: ${application.coverLetter}.`;
        }
        console.log('📄 Created resume text from user profile');
      } else {
        resumeText = `Application from ${candidateName} (${candidateEmail}). Cover Letter: ${application.coverLetter || 'Not provided'}.`;
        console.log('📄 Created resume text from application data');
      }
    }

    if (!resumeText || resumeText.trim().length < 10) {
      console.warn('⚠️ Resume text is too short, using fallback');
      resumeText = `Candidate: ${candidateName}. Email: ${candidateEmail}. Applied for: ${jobTitle}.`;
    }

    // Step 1: Extract skills using multiple methods
    console.log('🔍 Extracting skills from resume and job description...');
    
    // Get skills from Job model (if available)
    const jobSkills = application.job.skills || [];
    
    // Get skills from User model (if available)
    const User = require('../models/User');
    const user = await User.findById(application.candidate);
    const userSkills = user?.skills || [];
    
    // Extract skills using keyword matching
    const keywordResumeSkills = extractSkills(resumeText);
    const keywordJdSkills = extractSkills(description || '');
    
    // Combine all sources
    const allResumeSkills = [...new Set([...keywordResumeSkills, ...userSkills])];
    const allJdSkills = [...new Set([...keywordJdSkills, ...jobSkills])];
    
    // Use AI to extract additional skills if keyword matching found few skills
    // NOTE: Cohere API has rate limits, so we use it sparingly
    let aiResumeSkills = [];
    let aiJdSkills = [];
    
    if (allResumeSkills.length < 5 || allJdSkills.length < 3) {
      console.log('🤖 Using AI to extract additional skills...');
      try {
        [aiResumeSkills, aiJdSkills] = await Promise.all([
          extractSkillsWithAI(resumeText, 'resume'),
          extractSkillsWithAI(description || '', 'job description')
        ]);
        console.log(`✅ AI extracted ${aiResumeSkills.length} resume skills, ${aiJdSkills.length} JD skills`);
      } catch (aiError) {
        console.warn('⚠️ AI skill extraction failed (may be rate limited):', aiError.message);
        // Continue without AI-extracted skills - keyword matching will be used
      }
    }
    
    // Final skill lists
    finalResumeSkills = [...new Set([...allResumeSkills, ...aiResumeSkills])];
    finalJdSkills = [...new Set([...allJdSkills, ...aiJdSkills])];
    
    // Normalize skills (case-insensitive matching)
    const normalizeSkill = (skill) => skill.toLowerCase().trim();
    const resumeSkillsNormalized = finalResumeSkills.map(normalizeSkill);
    const jdSkillsNormalized = finalJdSkills.map(normalizeSkill);
    
    // Find matching and missing skills
    matchingSkills = finalResumeSkills.filter((skill, idx) => 
      jdSkillsNormalized.includes(normalizeSkill(skill))
    );
    
    missingSkills = finalJdSkills.filter((skill, idx) => 
      !resumeSkillsNormalized.includes(normalizeSkill(skill))
    );
    
    const keywordScore = finalJdSkills.length > 0 
      ? Math.round((matchingSkills.length / finalJdSkills.length) * 100) 
      : 50;

    console.log(`📊 Skills extracted - Resume: ${finalResumeSkills.length}, JD: ${finalJdSkills.length}, Matching: ${matchingSkills.length}, Missing: ${missingSkills.length}, Score: ${keywordScore}`);

    // Step 2: Cohere Evaluation for comprehensive analysis
    // NOTE: Cohere API may have rate limits - we have fallback handling
    try {
      console.log('🤖 Calling Cohere API for AI analysis...');
      
      // Build comprehensive prompt with extracted skills
      const skillsContext = `
Candidate Skills Found: ${finalResumeSkills.slice(0, 15).join(', ')}
Job Required Skills: ${finalJdSkills.slice(0, 15).join(', ')}
Matching Skills: ${matchingSkills.slice(0, 10).join(', ')}
Missing Skills: ${missingSkills.slice(0, 10).join(', ')}
      `.trim();
      
      const cohereResponse = await cohere.chat({
        model: "command-r",
        message: `You are an expert hiring assistant analyzing a job application. Provide a comprehensive match analysis.

RESUME/CANDIDATE PROFILE:
${resumeText.substring(0, 3000)}${resumeText.length > 3000 ? '...' : ''}

JOB DESCRIPTION:
${description ? description.substring(0, 2000) : 'No description provided'}${description && description.length > 2000 ? '...' : ''}

SKILLS ANALYSIS:
${skillsContext}

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON, no additional text
2. "tags" must be an array of at least 5-10 relevant skills, technologies, or keywords
3. "explanation" must be specific and mention actual skills from the resume and job description
4. "matchScore" should be 0-100 based on skill alignment, experience match, and overall fit

Return this EXACT JSON format:
{
  "matchScore": <number 0-100>,
  "explanation": "<detailed 2-3 sentence explanation mentioning specific skills and qualifications>",
  "tags": ["skill1", "skill2", "skill3", "skill4", "skill5", ...]
}

IMPORTANT: Include ALL relevant skills, technologies, and keywords in the tags array. Tags should reflect both candidate skills and job requirements.`,
        temperature: 0.2,
      });

      // Parse Cohere response
      try {
        // Remove code block markers if present
        let jsonText = cohereResponse.text.trim();
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        }
        
        // Try to extract JSON from the response
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
        
        parsed = JSON.parse(jsonText);
        
        // Ensure tags is an array and has values
        if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) {
          parsed.tags = [...matchingSkills.slice(0, 5), ...finalJdSkills.slice(0, 3)].slice(0, 8);
        }
        
        // Ensure explanation exists
        if (!parsed.explanation) {
          parsed.explanation = `Match score: ${parsed.matchScore}/100. Candidate has ${matchingSkills.length} matching skills out of ${finalJdSkills.length} required skills.`;
        }
        
        console.log('✅ Cohere analysis successful:', {
          matchScore: parsed.matchScore,
          tagsCount: parsed.tags?.length || 0,
          hasExplanation: !!parsed.explanation
        });
      } catch (parseError) {
        console.error('⚠️ Error parsing Cohere response:', parseError.message);
        console.log('Raw Cohere response (first 500 chars):', cohereResponse.text.substring(0, 500));
        
        // Enhanced fallback with extracted skills
        parsed = {
          matchScore: keywordScore,
          explanation: `Based on skill analysis: Candidate matches ${matchingSkills.length} out of ${finalJdSkills.length} required skills. ${missingSkills.length > 0 ? `Missing key skills: ${missingSkills.slice(0, 5).join(', ')}.` : 'Good skill alignment.'}`,
          tags: [...matchingSkills.slice(0, 5), ...finalJdSkills.slice(0, 5)].slice(0, 10)
        };
      }
    } catch (cohereError) {
      const errorMsg = cohereError.message || '';
      const isRateLimited = errorMsg.includes('429') || 
                           errorMsg.includes('TooManyRequests') || 
                           errorMsg.includes('rate limit') ||
                           errorMsg.includes('Trial key');
      
      if (isRateLimited) {
        console.warn('⚠️ Cohere API rate limit reached - using enhanced keyword-based analysis');
      } else {
        console.error('❌ Cohere API error:', errorMsg);
      }
      
      // Enhanced fallback with all extracted skills and meaningful analysis
      const allTags = [...new Set([
        ...matchingSkills,
        ...finalJdSkills,
        ...finalResumeSkills
      ])].slice(0, 12);
        
      parsed = {
        matchScore: keywordScore,
        explanation: `Skill-based analysis: Candidate has ${matchingSkills.length} matching skills (${finalResumeSkills.length} total) out of ${finalJdSkills.length} required skills. ${missingSkills.length > 0 ? `Key missing skills: ${missingSkills.slice(0, 6).join(', ')}.` : 'Strong skill alignment with job requirements.'}${isRateLimited ? ' (AI analysis temporarily unavailable due to rate limits - using keyword matching)' : ''}`,
        tags: allTags.length > 0 ? allTags : ['Analysis Complete']
      };
    }

    finalScore = Math.round((keywordScore + (parsed.matchScore || keywordScore)) / 2);
    console.log(`📊 Final AI Match Score: ${finalScore}/100`);

    // Step 3: Ensure tags and missing skills are never empty
    if (!parsed.tags || parsed.tags.length === 0) {
      // Generate tags from available skills
      parsed.tags = [...new Set([
        ...matchingSkills.slice(0, 5),
        ...finalJdSkills.slice(0, 5),
        ...finalResumeSkills.slice(0, 5)
      ])].slice(0, 10);
    }
    
    if (parsed.tags.length === 0) {
      parsed.tags = [jobTitle, 'Application Review', 'Candidate Assessment'];
    }
    
    // Ensure missing skills list is meaningful
    if (missingSkills.length === 0 && finalJdSkills.length > 0) {
      // If no missing skills but job has skills, check if candidate is missing ALL
      if (matchingSkills.length === 0) {
        missingSkills = finalJdSkills.slice(0, 8);
      }
    }
    
    // Ensure explanation is comprehensive
    if (!parsed.explanation || parsed.explanation.length < 50) {
      parsed.explanation = `Match score: ${finalScore}/100. Candidate has ${matchingSkills.length} matching skills (${finalResumeSkills.length} total skills) out of ${finalJdSkills.length} required skills. ${missingSkills.length > 0 ? `Key missing skills: ${missingSkills.slice(0, 5).join(', ')}.` : 'Strong alignment with job requirements.'}`;
    }
    
    // Step 4: Save to DB
    try {
      application.matchScore = finalScore;
      application.matchInsights = {
        matchScore: parsed.matchScore || finalScore,
        explanation: parsed.explanation,
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 15) : [],
        matchingSkills: matchingSkills.slice(0, 20),
        missingSkills: missingSkills.slice(0, 20),
      };
      await application.save();
      console.log('✅ Application updated with AI insights', {
        matchScore: finalScore,
        tagsCount: application.matchInsights.tags.length,
        matchingSkillsCount: matchingSkills.length,
        missingSkillsCount: missingSkills.length
      });
    } catch (saveError) {
      console.error('⚠️ Failed to save AI insights to DB:', saveError.message);
      // Continue to send emails even if DB save fails
    }

    // Step 4: Notify HR with detailed analysis
    if (hrEmail) {
      let subject, recommendation, bgColor, borderColor;
      if (finalScore >= 85) {
        subject = `🌟 STRONG CANDIDATE - ${candidateName} - ${finalScore}/100 Match`;
        recommendation = "HIGHLY RECOMMENDED for interview - Strong fit for this role";
        bgColor = "#d1fae5";
        borderColor = "#059669";
      } else if (finalScore >= 70) {
        subject = `✅ GOOD CANDIDATE - ${candidateName} - ${finalScore}/100 Match`;
        recommendation = "RECOMMENDED for review - Good potential fit";
        bgColor = "#dbeafe";
        borderColor = "#2563eb";
      } else if (finalScore >= 60) {
        subject = `🤔 MODERATE MATCH - ${candidateName} - ${finalScore}/100 Match`;
        recommendation = "CONSIDER for interview - Moderate fit, may need additional skills";
        bgColor = "#fef3c7";
        borderColor = "#f59e0b";
      } else {
        subject = `⚠️ LOW MATCH - ${candidateName} - ${finalScore}/100 Match`;
        recommendation = "NOT RECOMMENDED - Low alignment with job requirements";
        bgColor = "#fee2e2";
        borderColor = "#dc2626";
      }

      const hrHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">New Job Application Received</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <div style="background: ${bgColor}; padding: 20px; border-left: 4px solid ${borderColor}; border-radius: 8px; margin-bottom: 25px;">
              <h2 style="margin-top: 0; color: ${borderColor};">
                ${finalScore >= 85 ? '🌟' : finalScore >= 70 ? '✅' : finalScore >= 60 ? '🤔' : '⚠️'} 
                AI Match Score: ${finalScore}/100
              </h2>
              <p style="font-size: 16px; font-weight: bold; margin: 10px 0; color: #374151;">
                Recommendation: ${recommendation}
              </p>
            </div>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #374151;">Candidate Information</h3>
              <p><strong>Name:</strong> ${candidateName}</p>
              <p><strong>Email:</strong> ${candidateEmail}</p>
              <p><strong>Applied For:</strong> ${jobTitle}</p>
              <p><strong>AI Analysis:</strong> ${parsed.explanation}</p>
            </div>

            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #374151;">Skills Analysis</h3>
              <div style="margin-bottom: 15px;">
                <strong style="color: #059669;">Matching Skills (${matchingSkills.length}):</strong>
                <p style="color: #374151;">${matchingSkills.length > 0 ? matchingSkills.join(', ') : 'None identified'}</p>
              </div>
              <div>
                <strong style="color: #dc2626;">Missing Skills (${missingSkills.length}):</strong>
                <p style="color: #374151;">${missingSkills.length > 0 ? missingSkills.slice(0, 10).join(', ') : 'None'}</p>
              </div>
            </div>

            <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <strong style="color: #1e40af;">AI Tags:</strong>
              <p style="color: #374151; margin: 5px 0;">${Array.isArray(parsed.tags) ? parsed.tags.join(', ') : 'N/A'}</p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
              ${resumeUrl ? `<a href="${resumeUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 5px;">
                📄 View Full Resume
              </a>` : '<p style="color: #6b7280;">Resume not available</p>'}
              <p style="margin-top: 15px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/hr/applications" style="color: #2563eb; text-decoration: none;">
                  👁️ View Application in Dashboard →
                </a>
              </p>
            </div>

            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; text-align: center;">
              This is an automated AI analysis. Please review the application thoroughly before making a decision.
            </p>
          </div>
        </div>
      `;

      try {
        await sendEmail({ to: hrEmail, subject, html: hrHtml });
        console.log(`✅ HR notification email sent to: ${hrEmail}`);
      } catch (hrEmailError) {
        console.error('❌ Failed to send HR email:', hrEmailError);
      }
    } else {
      console.warn('⚠️ No HR email found for job:', jobTitle);
    }

    // Step 5: Notify Candidate with detailed score and feedback
    if (candidateEmail) {
      let scoreColor, scoreMessage;
      if (finalScore >= 85) {
        scoreColor = "#059669";
        scoreMessage = "Excellent match! You have strong qualifications for this role.";
      } else if (finalScore >= 70) {
        scoreColor = "#2563eb";
        scoreMessage = "Good match! Your profile aligns well with the job requirements.";
      } else if (finalScore >= 60) {
        scoreColor = "#f59e0b";
        scoreMessage = "Moderate match. Consider highlighting additional relevant skills.";
      } else {
        scoreColor = "#dc2626";
        scoreMessage = "Lower match. Focus on developing skills mentioned in the job description.";
      }

      const candidateHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">Your Application Has Been Analyzed! 🎯</h1>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #374151;">Hi <strong>${candidateName}</strong>,</p>
            <p style="color: #6b7280;">Thank you for applying to <strong>${jobTitle}</strong>!</p>
            
            <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <div style="display: inline-block; background: ${scoreColor}; color: white; padding: 15px 40px; border-radius: 50px; font-size: 32px; font-weight: bold; margin-bottom: 15px;">
                ${finalScore}/100
              </div>
              <p style="font-size: 18px; font-weight: bold; color: ${scoreColor}; margin: 10px 0;">
                AI Match Score
              </p>
              <p style="color: #374151; margin-top: 10px;">
                ${scoreMessage}
              </p>
            </div>
            
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #374151; margin-top: 0;">AI Analysis Feedback</h3>
              <p style="color: #6b7280; line-height: 1.6;">${parsed.explanation}</p>
            </div>

            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #374151; margin-top: 0;">Skills Summary</h3>
              <div style="margin-bottom: 15px;">
                <strong style="color: #059669;">✓ Matching Skills:</strong>
                <p style="color: #374151; margin: 5px 0;">${matchingSkills.length > 0 ? matchingSkills.join(', ') : 'None identified'}</p>
              </div>
              ${missingSkills.length > 0 ? `
              <div>
                <strong style="color: #f59e0b;">→ Skills to Develop:</strong>
                <p style="color: #374151; margin: 5px 0;">${missingSkills.slice(0, 5).join(', ')}</p>
                <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">
                  Consider taking courses or gaining experience in these areas to improve your profile.
                </p>
              </div>
              ` : ''}
            </div>

            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
              <p style="margin: 0; color: #374151;"><strong>📧 Next Steps:</strong></p>
              <ul style="color: #6b7280; line-height: 1.8; margin: 10px 0;">
                <li>The HR team will review your application</li>
                <li>You'll be notified if you're selected for an interview</li>
                <li>Track your application status in your candidate dashboard</li>
              </ul>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 12px; color: #92400e;">
                <strong>Note:</strong> This AI score is for preliminary screening only. The HR team makes the final hiring decision after reviewing all applications.
              </p>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="color: #374151; font-weight: bold; margin: 10px 0;">Best of luck!</p>
              <p style="color: #6b7280; margin: 10px 0;">The ${companyName || application.job.companyName || 'Company'} Hiring Team</p>
            </div>
          </div>
        </div>
      `;

      try {
        await sendEmail({
          to: candidateEmail,
          subject: `Your Application Score: ${finalScore}/100 - ${jobTitle}`,
          html: candidateHtml
        });
        console.log(`✅ Candidate score email sent to: ${candidateEmail}`);
      } catch (candidateEmailError) {
        console.error('❌ Failed to send candidate email:', candidateEmailError);
      }
    } else {
      console.warn('⚠️ No candidate email found');
    }
    // Step 6: Final Response (only if res object exists)
    if (res && typeof res.json === 'function') {
      try {
        let tags = parsed.tags;
        if (typeof tags === 'string') {
          try {
            tags = JSON.parse(tags.replace(/'/g, '"'));
          } catch (e) {
            tags = [];
          }
        }
        res.json({
          matchScore: finalScore,
          explanation: parsed.explanation || "Analysis completed.",
          matchingSkills,
          missingSkills,
          tags: Array.isArray(tags) ? tags : [],
          resumePreview: resumeText ? resumeText.slice(0, 300) : '',
        });
      } catch (resError) {
        console.error('⚠️ Error sending response:', resError.message);
      }
    }

  } catch (err) {
    console.error("🔥 Agent Error:", err.message);
    console.error("🔥 Full error:", err);
    
    // Even on error, try to send basic emails
    try {
      if (hrEmail && candidateName && jobTitle) {
        const errorSubject = `⚠️ Application Received - ${candidateName} - ${jobTitle}`;
        const errorHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>New Application Received</h2>
            <p><strong>Candidate:</strong> ${candidateName}</p>
            <p><strong>Email:</strong> ${candidateEmail || 'N/A'}</p>
            <p><strong>Position:</strong> ${jobTitle}</p>
            <p><strong>Note:</strong> AI analysis encountered an error. Please review the application manually.</p>
            <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/hr/applications">View Application</a></p>
          </div>
        `;
        await sendEmail({ to: hrEmail, subject: errorSubject, html: errorHtml });
        console.log('✅ Sent error notification to HR');
      }
      
      if (candidateEmail && candidateName && jobTitle) {
        const candidateErrorHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Application Submitted Successfully</h2>
            <p>Hi ${candidateName},</p>
            <p>Thank you for applying to <strong>${jobTitle}</strong>!</p>
            <p>Your application has been received and is being reviewed. You will hear back from the HR team soon.</p>
          </div>
        `;
        await sendEmail({ 
          to: candidateEmail, 
          subject: `Application Submitted: ${jobTitle}`, 
          html: candidateErrorHtml 
        });
        console.log('✅ Sent confirmation to candidate');
      }
    } catch (emailError) {
      console.error('❌ Failed to send error emails:', emailError.message);
    }

    if (res && typeof res.status === 'function') {
      res.status(500).json({ error: "Agent failed", message: err.message });
    }
  }
};

// General AI text generation function
const generateResponse = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('🤖 Generating AI response for prompt length:', prompt.length);

    // Use Cohere for text generation
    const cohereResponse = await cohere.chat({
      model: "command-r",
      message: prompt,
      temperature: 0.7,
      max_tokens: 1000
    });

    console.log('✅ AI response generated successfully');
    
    res.json({
      response: cohereResponse.text,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error("🔥 AI Generation Error:", err.message);
    
    // Provide a fallback response
    res.json({
      response: "AI service temporarily unavailable. Please try again later.",
      error: true,
      generatedAt: new Date().toISOString()
    });
  }
};

module.exports = { getMatchScore, generateResponse };

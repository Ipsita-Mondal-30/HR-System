const { AssemblyAI } = require('assemblyai');

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || '82ee5d2890664f708810326b1be304fe'
});

/**
 * Transcribe audio/video file to text
 * @param {string} audioUrl - URL or path to audio/video file
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioUrl) {
  try {
    console.log('🎙️ Starting transcription for:', audioUrl);
    
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl
    });

    if (transcript.status === 'error') {
      throw new Error(`Transcription failed: ${transcript.error}`);
    }

    console.log('✅ Transcription completed');
    return transcript.text;
  } catch (error) {
    console.error('❌ Transcription error:', error);
    throw error;
  }
}

/**
 * Transcribe multiple audio files
 * @param {Array<string>} audioUrls - Array of audio URLs
 * @returns {Promise<Array<string>>} - Array of transcribed texts
 */
async function transcribeMultiple(audioUrls) {
  try {
    console.log(`🎙️ Starting batch transcription for ${audioUrls.length} files`);
    
    const transcriptions = await Promise.all(
      audioUrls.map(url => transcribeAudio(url))
    );

    console.log('✅ Batch transcription completed');
    return transcriptions;
  } catch (error) {
    console.error('❌ Batch transcription error:', error);
    throw error;
  }
}

module.exports = {
  transcribeAudio,
  transcribeMultiple
};

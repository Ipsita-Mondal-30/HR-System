// Placeholder logic — replace with OpenAI/HuggingFace embeddings

function getEmbedding(text) {
    // Very dumb tokenizer for now: character count → embedding
    const vector = Array(100).fill(0);
    for (let i = 0; i < text.length && i < 100; i++) {
      vector[i] = text.charCodeAt(i) / 255; // normalize
    }
    return Promise.resolve(vector);
  }
  
  function cosineSimilarity(vecA, vecB) {
    const dot = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));
    return dot / (magA * magB);
  }
  
  module.exports = { getEmbedding, cosineSimilarity };
  
import natural from 'natural';
const tokenizer = new natural.WordTokenizer();

export default class WordFrequencyAnalyzer {
    calculateWordFrequency(descriptions, prompt = "") {
        const promptWords = this.preprocessText(prompt).split(' ');
        let wordScores = {};

        // Calculate word scores based on frequency and position in descriptions
        descriptions.forEach((description, index) => {
            const processedText = this.preprocessText(description);
            const tokens = tokenizer.tokenize(processedText);

            // Consider individual words
            tokens.forEach((word, position) => {
                // Exclude prompt words from scoring
                if (!promptWords.includes(word)) {
                    const score = 1 / (position + 1);
                    wordScores[word] = (wordScores[word] || 0) + score;
                }
            });

            // Consider phrases (n-grams)
            const phraseMaxLength = 5; // Arbitrary
            for (let i = 2; i <= phraseMaxLength; i++) {
                const ngrams = natural.NGrams.ngrams(processedText, i);
                ngrams.forEach((ngram, position) => {
                    const ngramStr = ngram.join(' ');
                    // Exclude prompt words from scoring
                    if (!promptWords.some(word => ngram.includes(word))) {
                        const score = 1 / (position + 1);
                        wordScores[ngramStr] = (wordScores[ngramStr] || 0) + score;
                    }
                });
            }
        });
        
        // Filter out word scores that are superior to 1
        wordScores = Object.fromEntries(
            Object.entries(wordScores).filter(([word, score]) => score > 1)
        );

        // Prioritize phrases based on scores compared to individual words
        const phrases = Object.keys(wordScores)
            .filter(phrase => phrase.split(' ').length > 1); // Filter out single words

        phrases.forEach(phrase => {
            const words = phrase.split(' ');
            const phraseScore = wordScores[phrase];

            let individualWordsScore = [];
            words.forEach((word) => {
                individualWordsScore.push(wordScores[word]);
            });

            // Check if phrase score has equal or better score than one of its individual words
            if (individualWordsScore.some(word => word <= phraseScore)) {
                wordScores[phrase] *= 3; // Triple the score to prioritize phrase
            }
        });

        // Sort word scores in descending order
        return Object.entries(wordScores).sort((a, b) => b[1] - a[1]);
    }
    
    preprocessText(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/'/g, "")
            .replace('-', ' ');
    }
}
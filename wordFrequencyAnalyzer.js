import natural from 'natural';
import { removeStopwords, eng, fra } from 'stopword';
import Utils from './utils.js';
const tokenizer = new natural.WordTokenizer();

export default class WordFrequencyAnalyzer {
    calculateWordFrequency(descriptions, language, question) {
        const questionWords = Utils.preprocessText(question).split(' ');
        let wordCounts = {};

        // Calculate word frequencies
        descriptions.forEach((description) => {
            const processedText = Utils.preprocessText(description);
            const tokens = tokenizer.tokenize(processedText);

            // Extract individual words and apply stopword removal
            const individualWords = tokens.filter(word => !questionWords.includes(word) && !Utils.isNumber(word));
            const noStopWords = removeStopwords(individualWords, language == 'fr' ? fra : eng);

            // Consider individual words
            noStopWords.forEach((cleanedWord) => {
                wordCounts[cleanedWord] = (wordCounts[cleanedWord] || 0) + 1;
            });

            // Consider phrases (n-grams)
            const phraseMaxLength = 5; // Arbitrary
            for (let i = 2; i <= phraseMaxLength; i++) {
                const ngrams = natural.NGrams.ngrams(processedText, i);
                ngrams.forEach((ngram) => {
                    const ngramStr = ngram.join(' ');
                    // Exclude question words from scoring
                    if (!questionWords.some(word => ngram.includes(word))) {
                        wordCounts[ngramStr] = (wordCounts[ngramStr] || 0) + 1;
                    }
                });
            }
        });

        // Filter out word counts that are superior to 1
        wordCounts = Object.fromEntries(
            Object.entries(wordCounts).filter(([word, count]) => count > 1)
        );

        // Prioritize phrases based on counts compared to individual words
        const phrases = Object.keys(wordCounts)
            .filter(phrase => phrase.split(' ').length > 1); // Filter out single words

        phrases.forEach(phrase => {
            const words = phrase.split(' ');

            let individualWordsCount = [];
            words.forEach((word) => {
                individualWordsCount.push(wordCounts[word]);
            });
        });

        // Sort words in descending order by count
        // Entries with same count are then sorted by length (longer first)
        const sortedWordCounts = Object.entries(wordCounts).sort((a, b) => {
            const countDiff = b[1] - a[1];
            if (countDiff !== 0) return countDiff;
            return b[0].split(' ').length - a[0].split(' ').length;
        });

        return sortedWordCounts;
    }
}
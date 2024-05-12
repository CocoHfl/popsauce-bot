import natural from 'natural';
const tokenizer = new natural.WordTokenizer();

export default class WordFrequencyAnalyzer {
    calculateWordFrequency(descriptions, topResultsNumber) {
        const wordFrequency = {};

        descriptions.forEach(description => {
            const processedText = this.preprocessText(description);
            const singleWords = tokenizer.tokenize(processedText);

            singleWords.forEach(word => {
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            });

            const maxPhraseLength = topResultsNumber;
            for (let i = 2; i <= maxPhraseLength; i++) {
                const ngrams = natural.NGrams.ngrams(processedText, i);
                ngrams.forEach(ngram => {
                    const ngramStr = ngram.join(' ');
                    wordFrequency[ngramStr] = (wordFrequency[ngramStr] || 0) + 1;
                });
            }
        });

        return this.extractTopWords(wordFrequency, topResultsNumber);
    }

    preprocessText(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/'/g, "");
    }

    extractTopWords(frequencyMap, n) {
        const topWords = [];
        const topPhrases = {};

        const sortedWords = Object.entries(frequencyMap).sort((a, b) => b[1] - a[1]);

        sortedWords.forEach(([word, frequency]) => {
            const wordCount = word.split(' ').length;
            if (frequency > 1) { // Exclude words with frequency of one
                if (wordCount === 1 && topWords.length === 0) {
                    topWords.push([word, frequency]);
                }
                else if (wordCount > 1 && !topPhrases[wordCount]) {
                    topPhrases[wordCount] = [word, frequency];
                }
            }
        });

        Object.values(topPhrases).forEach(phrase => {
            topWords.push(phrase);
        });

        // Return the top words and phrases
        return topWords.slice(0, n);
    }
}
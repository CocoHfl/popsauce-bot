import google from 'googlethis';
import WordFrequencyAnalyzer from './wordFrequencyAnalyzer.js';
import Utils from './utils.js'

export default class QuestionAsk {
    constructor(request) {
        this.request = request;
        this.question = Utils.preprocessText(`${this.request.body['Prompt']} ${this.request.body['Text']}`);
        this.language = this.request.body['Language'];
    }

    async askQuestion() {
        const googleSearchOptions = {
            page: 0,
            safe: false,
            parse_ads: false,
            additional_params: {
                hl: this.language
            }
        }
        try {
            const googleRes = await google.search(this.question, googleSearchOptions);
            return await this.getGuesses(googleRes);
        } catch (err) {
            throw new Error(`Failed to perform google search: ${err}`);
        }
    }

    getGuesses(googleRes) {
        return new Promise((resolve, reject) => {
            try {
                let searchResults = this.extractSearchResults(googleRes);
        
                const analyzer = new WordFrequencyAnalyzer();
                const calculatedGuesses = analyzer.calculateWordFrequency(searchResults, this.language, this.question);
            
                const firstValues = calculatedGuesses.map(subArray => subArray[0]);
                const top5words = firstValues.slice(0, 5);

                resolve(top5words);
            } catch (err) {
                reject(new Error(`Failed to get guesses: ${err}`));
            }
        })
    }

    extractSearchResults(googleResults) {
        let resultsArray = [];

        if(googleResults.featured_snippet.title != null)
            resultsArray.push(googleResults?.featured_snippet.title);
    
        if(googleResults.featured_snippet.description != null)
            resultsArray.push(googleResults?.featured_snippet.description);
    
        googleResults.results.forEach(element => {
            resultsArray.push(element.title);
            resultsArray.push(element.description);
        });

        return resultsArray;
    }
}
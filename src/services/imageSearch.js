import https from 'https';
import FormData from 'form-data';
import svg2img from 'svg2img';
import WordFrequencyAnalyzer from '../utils/wordFrequencyAnalyzer.js';
import Utils from '../utils/utils.js'

export default class ImageSearch {
    constructor(request, page) {
        this.request = request;
        this.page = page;

        this.imageData = this.request.body['ImageData'];
        this.imageType = this.request.body['ImageType'];
        this.question = Utils.preprocessText(this.request.body['Prompt']);
        this.language = this.request.body['Language'];
    }
    
    async searchImage() {
        try {
            const binary = await this.getBinaryFromBase64();
            return await this.callGoogleLens(binary);
        } catch (error) {
            throw new Error('Error in searchImage: ' + error.message);
        }
    }

    getBinaryFromBase64() {
        if (this.imageType === "svg+xml") {
            return new Promise((resolve, reject) => {
                svg2img(this.imageData, (error, buffer) => {
                    if (error) {
                        reject(new Error(`Failed to convert SVG: ${error}`));
                    } else {
                        resolve(buffer);
                    }
                });
            });
        } else {
            let base64Data = this.imageData.replace(`data:image/${this.imageType};base64,`, '');
            base64Data = base64Data.replace(/\s/g, '+');
            return Buffer.from(base64Data, 'base64');
        }
    }

    callGoogleLens(binaryData) {
        const form = new FormData();
        form.append('encoded_image', binaryData, 'image.jpg');
    
        const options = {
            hostname: 'lens.google.com',
            path: '/upload',
            method: 'POST',
            headers: form.getHeaders()
        };
    
        return new Promise((resolve, reject) => {
            const req = https.request(options, (httpRes) => {
                const chunks = [];
        
                httpRes.on('data', (chunk) => {
                    chunks.push(chunk);
                });
        
                httpRes.on('end', async () => {
                    try {
                        const headersUrl = httpRes.headers['location'];

                        const url = new URL(headersUrl);
                        url.searchParams.set('hl', this.language);

                        const gLensUrl = url.toString();
    
                        console.log('Google Lens URL', gLensUrl);
    
                        const guesses = await this.getLensResults(gLensUrl);
                        const associatedSearchesFormat = guesses.associatedSearches.map(str => Utils.preprocessText(str).substring(0, 50));

                        const analyzer = new WordFrequencyAnalyzer();
                        const calculatedGuesses = analyzer.calculateWordFrequency(guesses.descriptions, this.language, this.question);
                        const calculatedGuessesValues = calculatedGuesses.map(subArray => subArray[0]);
                        
                        const mergedArray = associatedSearchesFormat.concat(calculatedGuessesValues);
                        const top5words = mergedArray.slice(0, 5);
    
                        resolve(top5words);
                    } catch (err) {
                        reject(new Error(`Failed to process Google Lens page: ${err}`));
                    }
                });
            });

            req.on('error', (err) => {
                reject(new Error(`Request failed: ${err}`));
            });
        
            form.pipe(req);
        });
    }

    async getLensResults(url) {
        await this.page.goto(url);
    
        const rejectCookiesBtn = "#yDmH0d > c-wiz > div > div > div > div.NIoIEf > div.G4njw > div.AIC7ge > div.CxJub > div.VtwTSb > form:nth-child(1) > div > div > button";
    
        if (await this.page.$(rejectCookiesBtn))
            this.page.$eval(rejectCookiesBtn, form => form.click());
    
        return await this.getResultsFromPage(10);
    }

    async getResultsFromPage(maxResults) {
        const searchItemClass = ".G19kAf";

        try {
            await this.page.waitForSelector(searchItemClass, {timeout: 1000});
        } catch {
            // Case where page is invalid: reload and try once more
            await this.page.reload();
            await this.page.waitForSelector(searchItemClass, {timeout: 1000});
        }
    
        let results = {
            associatedSearches: [],
            descriptions: []
        };
    
        let associatedSearches = await this.page.$$(".LzliJc");
        await this.pushResults(associatedSearches, results.associatedSearches, maxResults);
    
        if (results.length >= maxResults) return results;

        let descriptions = await this.page.$$(".UAiK1e");
        await this.pushResults(descriptions, results.descriptions, maxResults);
    
        return results;
    }

    async pushResults(elements, results, maxResults) {
        if (elements != null) {
            for (let element of elements) {
                if (results.length >= maxResults) return;
                let value = await this.page.evaluate(el => el.textContent, element);
                results.push(value);
            }
        }
    }
}
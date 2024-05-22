import https from 'https';
import FormData from 'form-data';
import svg2img from 'svg2img';
import WordFrequencyAnalyzer from './wordFrequencyAnalyzer.js';
import Utils from './utils.js'

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
                        const body = Buffer.concat(chunks).toString();
                        const id = body?.split('search?p=')[1]?.split('>')[0];
                        const gLensUrl = `https://lens.google.com/search?hl=${this.language}&p=${id}`;
    
                        console.log('Google Lens URL', gLensUrl);
    
                        const results = await this.getLensResults(gLensUrl);
                        let guesses = Object.fromEntries(
                            Object.entries(results).map(([key, arr]) => [key, arr.map(str => str.replace(/[\/\\#,+()$~%.'":*?<>{}-]/g, '').substring(0, 50))])
                        );
                        const analyzer = new WordFrequencyAnalyzer();
                        const calculatedGuesses = analyzer.calculateWordFrequency(guesses.descriptions, this.language, this.question);
    
                        const firstValues = calculatedGuesses.map(subArray => subArray[0]);
                        const mergedArray = guesses.associatedSearches.concat(firstValues);
    
                        resolve(mergedArray);
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
        await this.page.setDefaultNavigationTimeout(60000);
        await this.page.goto(url);
    
        const rejectCookiesBtn = "#yDmH0d > c-wiz > div > div > div > div.NIoIEf > div.G4njw > div.AIC7ge > div.CxJub > div.VtwTSb > form:nth-child(1) > div > div > button"
    
        if (await this.page.$(rejectCookiesBtn))
            this.page.$eval(rejectCookiesBtn, form => form.click());
    
        return await this.getResultsFromPage(10);
    }

    async getResultsFromPage(maxResults) {
        await this.page.waitForSelector(".G19kAf", {timeout: 5000});
    
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
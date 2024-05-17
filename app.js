import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import FormData from 'form-data';
import google from 'googlethis';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import svg2img from 'svg2img';
import wordFrequencyAnalyzer from './wordFrequencyAnalyzer.js';

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 5000;
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

var browser = null;
var page = null;

initializeChrome();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
})

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.post('/api/askQuestion', async (req, res) => {
    const options = {
        page: 0,
        safe: false,
        parse_ads: false,
        additional_params: {
            hl: req.body['Language']
        }
    }

    const prompt = preprocessText(req.body['Data']);
    const response = await google.search(prompt, options);

    let answers = [];
    if(response.featured_snippet.title != null)
        answers.push(response?.featured_snippet.title);

    if(response.featured_snippet.description != null)
        answers.push(response?.featured_snippet.description);

    response.results.forEach(element => {
        answers.push(element.title);
        answers.push(element.description);
    });

    const analyzer = new wordFrequencyAnalyzer();
    const calculatedAnswers = analyzer.calculateWordFrequency(answers, prompt);

    const firstValues = calculatedAnswers.map(subArray => subArray[0]);
    res.status(200).send(firstValues);
});

app.post('/api/searchImage', (req, res) => {
    let base64Data;
    let binaryData;
    
    if(req.body['ImageType'] == "svg+xml") {
        svg2img(
            req.body['Data'],
            function (error, buffer) {
                if (error) {
                    res.status(500).send();
                    console.log('Failed to convert svg: ', err);
                }

                binaryData = buffer;
            });
    } else {
        base64Data = req.body['Data'].replace(`data:image/${req.body['ImageType']};base64,`, "");
        base64Data += base64Data.replace('+', ' ');
        binaryData = Buffer.from(base64Data, 'base64');
    }

    callGoogleLens(binaryData, req.body['Language'], res);
})

function callGoogleLens(binaryData, language, res) {
    const form = new FormData();
    form.append('encoded_image', binaryData, 'image.jpg');

    const options = {
        hostname: 'lens.google.com',
        path: '/upload',
        method: 'POST',
        headers: form.getHeaders()
    };

    const req = https.request(options, function (httpRes) {
        const chunks = [];

        httpRes.on('data', function (chunk) {
            chunks.push(chunk);
        });

        httpRes.on('end', async function () {
            const body = Buffer.concat(chunks).toString();
            const id = body?.split('search?p=')[1]?.split('>')[0];
            const gLensUrl = `https://lens.google.com/search?hl=${language}&p=${id}`;

            console.log('Google Lens URL', gLensUrl);

            getLensResults(gLensUrl)
                .then(results => {
                    let guesses = Object.fromEntries(
                        Object.entries(results).map(([key, arr]) => [key, arr.map(str => str.replace(/[\/\\#,+()$~%.'":*?<>{}-]/g, '').substring(0, 50))])
                    );
                    const analyzer = new wordFrequencyAnalyzer();
                    const calculatedGuesses = analyzer.calculateWordFrequency(guesses.descriptions);

                    const firstValues = calculatedGuesses.map(subArray => subArray[0]);
                    const mergedArray = guesses.associatedSearches.concat(firstValues);

                    res.status(200).send(mergedArray);
                })
                .catch(function (err) {
                    res.status(500).send();
                    console.log('Failed to fetch page: ', err);
                });
        });
    });

    form.pipe(req);
}

async function initializeChrome() {
    browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    page = await browser.newPage();
}

async function getLensResults(url) {
    await page.setDefaultNavigationTimeout(60000);
    await page.goto(url);

    const rejectCookiesBtn = "#yDmH0d > c-wiz > div > div > div > div.NIoIEf > div.G4njw > div.AIC7ge > div.CxJub > div.VtwTSb > form:nth-child(1) > div > div > button"

    if (await page.$(rejectCookiesBtn))
        page.$eval(rejectCookiesBtn, form => form.click());

    return await getResultsFromPage(page, 10);
}

async function getResultsFromPage(page, maxResults) {
    await page.waitForSelector(".G19kAf", {timeout: 5000});

    let results = {
        associatedSearches: [],
        descriptions: []
    };

    let associatedSearches = await page.$$(".LzliJc");
    await pushResults(associatedSearches, page, results.associatedSearches, maxResults);

    if (results.length >= maxResults) return results;

    let descriptions = await page.$$(".UAiK1e");
    await pushResults(descriptions, page, results.descriptions, maxResults);

    return results;
}

async function pushResults(elements, page, results, maxResults) {
    if (elements != null) {
        for (let element of elements) {
            if (results.length >= maxResults) return;
            let value = await page.evaluate(el => el.textContent, element);
            results.push(value);
        }
    }
}

function preprocessText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/'/g, "")
        .replace(/(\r\n|\n|\r)/gm, " ")
        .replace('-', ' ')
        .replace(/[\u266b]/g, "") //♫
        .replace(/\s+/g, " ");
}
import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import FormData from 'form-data';
import google from 'googlethis';
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const app = express();
const PORT = 5000;
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

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
    }

    const response = await google.search(req.body['Data'], options);

    let answers = {
        title: [],
        descriptions: []
    };

    response.results.forEach(element => {
        answers.title.push(element.title);
        answers.descriptions.push(element.description);
    });

    res.status(200).send(answers);
})

app.post('/api/searchImage', (req, res) => {
    let base64Data;
    let binaryData;
    base64Data = req.body['Data'].replace(/^data:image\/jpeg;base64,/, "");
    base64Data += base64Data.replace('+', ' ');
    binaryData = Buffer.from(base64Data, 'base64');
    callGoogleLens(binaryData, res);
})

function callGoogleLens(binaryData, res) {
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
            const id = body.split('search?p=')[1].split('>')[0];
            const gLensUrl = 'https://lens.google.com/search?p=' + id;

            console.log('Google Lens URL', gLensUrl);

            getLensResults(gLensUrl)
                .then(results => {
                    res.status(200).send(results);
                })
                .catch(function (err) {
                    res.status(500).send();
                    console.log('Failed to fetch page: ', err);
                });
        });
    });

    form.pipe(req);
}

async function getLensResults(url) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    await page.setDefaultNavigationTimeout(60000);
    await page.goto(url);

    const results = await getResultsFromPage(page, 10);

    await browser.close();

    return results;
}

async function getResultsFromPage(page, maxResults) {
    const rejectCookiesBtn = "#yDmH0d > c-wiz > div > div > div > div.NIoIEf > div.G4njw > div.AIC7ge > div.CxJub > div.VtwTSb > form:nth-child(1) > div > div > button"
    page.$eval(rejectCookiesBtn, form => form.click());

    await page.waitForSelector(".G19kAf");

    let results = [];

    let associatedSearches = await page.$$(".LzliJc");
    await pushResults(associatedSearches, page, results, maxResults);

    if (results.length >= maxResults) return results;

    let resultDescriptions = await page.$$(".UAiK1e");
    await pushResults(resultDescriptions, page, results, maxResults);

    return results;
}

async function pushResults(elements, page, results, maxResults) {
    if (elements != null) {
        for(let element of elements) {
            if(results.length >= maxResults) return;
            let value = await page.evaluate(el => el.textContent, element);
            results.push(value);
        }
    }
}
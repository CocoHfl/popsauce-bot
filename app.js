import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import FormData from 'form-data';
import fs from 'fs';
import jsdom from 'jsdom';
import google from 'googlethis';
import fetch from 'node-fetch';
const { JSDOM } = jsdom;

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
        title : [],
        descriptions : []
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
    binaryData = new Buffer(base64Data, 'base64').toString('binary');

    fs.writeFile("image/out.jpeg", binaryData, "binary", function (err) {
        if (err) {
            console.log(err);
        } else {
            callGoogleLens(res);
        }
    });
})

function callGoogleLens(res) {
    const form = new FormData();
    form.append('encoded_image', fs.readFileSync('image/out.jpeg'), '/path/to/image.jpg');

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

        httpRes.on('end', function () {
            const body = Buffer.concat(chunks).toString();
            const id = body.split('search?p=')[1].split('>')[0];
            const gLensUrl = 'https://lens.google.com/search?p=' + id;

            console.log('Google Lens URL', gLensUrl);

            fetch(gLensUrl)
                .then(function (response) {
                    return response.text()
                })
                .then(function (html) {
                    const dom = new JSDOM(html);
                    const results = dom.serialize().split(' results"')[1]
                    const regex = /"[^"]*\s[^"]*"/g;
                    const matches = results.match(regex);
                    let searchResults = [];

                    //Skipping first index ("See exact matches" text)
                    //Returning 10 results
                    for (let index = 1; index < 11; index++) {
                        searchResults.push(matches[index]);
                    }

                    console.log('Results', searchResults);
                    res.status(200).send(searchResults);
                })
                .catch(function (err) {
                    console.log('Failed to fetch page: ', err);
                });
        });
    });

    form.pipe(req);
}
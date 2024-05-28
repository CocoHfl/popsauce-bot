import express from 'express';
import bodyParser from 'body-parser';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import ImageSearch from './services/imageSearch.js';
import QuestionAsk from './services/questionAsk.js';

class Server {
    constructor() {
        this.app = express();
        this.PORT = 5000;
        this.browser = null;
        this.page = null;
        this.initializeChrome();
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    initializeChrome() {
        puppeteer.use(StealthPlugin());
        puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        }).then(browser => {
            this.browser = browser;
            this.browser.newPage().then(page => {
                this.page = page;
            });
        }).catch(error => {
            console.error('Error initializing Chrome:', error);
        });
    }

    setupMiddleware() {
        this.app.use(function (req, res, next) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
            res.setHeader('Access-Control-Allow-Credentials', true);
            next();
        });

        this.app.use(bodyParser.json({ limit: '50mb' }));
        this.app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
    }

    setupRoutes() {
        this.app.post('/api/askQuestion', this.askQuestion.bind(this));
        this.app.post('/api/searchImage', this.searchImage.bind(this));
    }

    start() {
        this.app.listen(this.PORT, () => {
            console.log(`Server running on http://localhost:${this.PORT}`);
        });
    }

    async askQuestion(req, res) {
        try {
            const questionAsk = new QuestionAsk(req);
            const results = await questionAsk.askQuestion();
            res.status(200).send(results);
        } catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    }

    async searchImage(req, res) {
        try {
            const imageSearch = new ImageSearch(req, this.page);
            const results = await imageSearch.searchImage();
            res.status(200).send(results);
        } catch (err) {
            console.error(err);
            res.status(500).send(err.message);
        }
    }
}

const server = new Server();
server.start();
let imageDetected = false;
let textQuestionDetected = false;

// Guess time, in milliseconds
window.guessTime = 0;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.clear();
console.log('%c Pop Sauce Bot 🥤%c \n\n https://github.com/CocoHfl/popsauce-bot', 'font-size: 25px; color:white; background:#5c415a', '')

if (typeof playersByPeerId !== 'undefined') {
    console.log('✔️ Bot started!');

    setInterval(async function () {
        if (playersByPeerId[selfPeerId] == null)
            return;

        if (milestone?.challenge?.text === undefined)
            textQuestionDetected = false;

        if (milestone?.challenge?.text && !textQuestionDetected)
            handleDetection('Text')

        if (milestone?.challenge?.image?.data === undefined)
            imageDetected = false;

        if (milestone?.challenge?.image?.data && !imageDetected)
            handleDetection('Image');
    }, 10);
} else {
    console.log('❌ Could not start Pop Sauce Bot');
}

async function handleDetection(questionType) {
    let jsonBody;
    let startTime = new Date();
    if(questionType == 'Image') {
        console.log('🛎️ Image question detected!');
        imageDetected = true;
        const base64data = await blobToBase64(new Blob([milestone.challenge.image.data], { type: milestone.challenge.image.type }))
        jsonBody = JSON.stringify({
            "Prompt": milestone?.challenge?.prompt,
            "ImageData": base64data,
            "ImageType": milestone.challenge.image.type.split("/")[1],
            "Language": rules.dictionaryId.value ?? 'en'
        });
    } else {
        console.log('🔔 Text question detected!');
        textQuestionDetected = true;
        jsonBody = JSON.stringify({
            "Prompt": milestone?.challenge?.prompt,
            "Text": milestone.challenge.text,
            "Language": rules.dictionaryId.value ?? 'en'
        });
    }

    const results = await callApi(questionType, jsonBody);

    const timeElapsed = new Date() - startTime;
    if(window.guessTime > timeElapsed)
        await delay(window.guessTime - timeElapsed);

    if (results !== undefined)
        await attemptGuesses(results);
}

async function callApi(questionType, body) {
    const action = questionType == 'Image' ? 'searchImage' : 'askQuestion';
    const nodeSrvUrl = `http://localhost:5000/api/${action}`;
    const results = await fetch(nodeSrvUrl, {
        method: "POST",
        body: body,
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then(async response => {
        if (response.ok) {
            return await response.json();
        }
        throw new Error('An error occured. Response not OK');
    })
    .catch((error) => {
        console.error('Error:', error);
    });

    return results;
}

async function attemptGuesses(guesses) {
    console.log(JSON.stringify(guesses));

    for (let i = 0; i < guesses?.length; i++)
        socket.emit("submitGuess", guesses[i]);

    await delay(500);
    
    if (milestone.playerStatesByPeerId[selfPeerId]?.hasFoundSource) {
        console.log('✔️ Answer found!');
        return;
    }

    if (guesses?.length > 0)
        socket.emit("submitGuess", guesses[0].charAt(0));

    console.log("❌ No answer found");
}

const blobToBase64 = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result)
    reader.onerror = err => reject(err)
    reader.readAsDataURL(blob)
});
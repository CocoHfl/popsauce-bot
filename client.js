let startTime;
let endTime;
let imageDetected = false;
let textQuestionDetected = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.clear();

setInterval(async function () {
    if (playersByPeerId[selfPeerId] == null)
        return;

    if (milestone?.challenge?.text === undefined)
        textQuestionDetected = false;

    if (milestone?.challenge?.text && !textQuestionDetected) {
        console.log('🔔 Question texte détectée !');
        textQuestionDetected = true;
        const jsonBody = JSON.stringify({
            "Prompt": milestone?.challenge?.prompt,
            "Text": milestone?.challenge?.text,
            "Language": rules.dictionaryId.value ?? 'en'
        });

        let results = await callApi('askQuestion', jsonBody);
        await attemptGuesses(results);
    }

    if (milestone?.challenge?.image?.data === undefined)
        imageDetected = false;

    if (milestone?.challenge?.image?.data && !imageDetected) {
        console.log('🛎️ Question image détectée !');
        imageDetected = true;

        const blob = new Blob([milestone.challenge.image.data], { type: milestone.challenge.image.type });
        let reader = new FileReader();
        reader.readAsDataURL(blob);

        reader.onloadend = async function () {
            let base64data = reader.result;
            const jsonBody = JSON.stringify({
                "Prompt": milestone?.challenge?.prompt,
                "ImageData": base64data,
                "ImageType": milestone.challenge.image.type.split("/")[1],
                "Language": rules.dictionaryId.value ?? 'en'
            });

            const results = await callApi('searchImage', jsonBody);

            if (results !== undefined)
                await attemptGuesses(results);
        }
    }
}, 10);

async function callApi(action, body) {
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

    for (let i = 0; i < guesses?.length; i++) {
        socket.emit("submitGuess", guesses[i]);
    }
    
    await delay(500);
    
    if (milestone.playerStatesByPeerId[selfPeerId]?.hasFoundSource) {
        console.log('✔️ Réponse trouvée !', milestone.playerStatesByPeerId[selfPeerId]?.guess);
        return;
    }

    if (guesses?.length > 0)
        socket.emit("submitGuess", guesses[0].charAt(0));

    console.log("❌ Aucune réponse n'a été trouvée");
}
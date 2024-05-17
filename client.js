let startTime;
let endTime;
let imageDetected = false;
let textQuestionDetected = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

console.clear();

setInterval(async function () { 
    if(milestone?.challenge?.text === undefined) {
        textQuestionDetected = false;
    }

    if(milestone?.challenge?.text && !textQuestionDetected) {
        console.log('Question texte détectée !');
        textQuestionDetected = true;
        const jsonBody = JSON.stringify({ 
            "Data": milestone?.challenge?.prompt + ' ' + milestone?.challenge?.text, 
            "Language": rules.dictionaryId.value ?? 'en'
         });

        let results = await callApi('askQuestion', jsonBody);
        await attemptGuesses(results);
    }

    if(milestone?.challenge?.image?.data === undefined) {
        imageDetected = false;
    }

    if (milestone?.challenge?.image?.data && !imageDetected) {
        console.log('Question image détectée !');
        imageDetected = true;
        startTime = new Date();
    
        const blob = new Blob([milestone.challenge.image.data], { type: milestone.challenge.image.type });
        let reader = new FileReader();
        reader.readAsDataURL(blob);
    
        reader.onloadend = async function () {
            let base64data = reader.result;
            const jsonBody = JSON.stringify({ 
                "Data": base64data, 
                "ImageType": milestone.challenge.image.type.split("/")[1],
                "Language": rules.dictionaryId.value ?? 'en' 
            });

            let results = await callApi('searchImage', jsonBody);
            await attemptGuesses(results);

            let endTime = new Date();
            let timeElapsed = endTime - startTime;
            console.log('Temps de réponse (ms)', timeElapsed);
        }
    }
}, 10);

async function callApi(action, body) {
    const nodeSrvUrl = `http://localhost:5000/api/${action}`;

    let results = await fetch(nodeSrvUrl, {
        method: "POST",
        body: body,
        headers: {
            "Content-Type": "application/json"
        }
    })
        .then(response => {
            if (!response.ok) {
                //TODO
            } else {
                return response.json();
            }
        })

    return results;
}

async function attemptGuesses(guesses) {
    if(guesses.length < 1) {
        console.log("Aucune réponse n'a été trouvée");
        return;
    }

    console.log(JSON.stringify(guesses));

    for (let i = 0; i < guesses.length; i++) {
        socket.emit("submitGuess", guesses[i]);
        
        await delay(100);
        
        if (milestone.playerStatesByPeerId[selfPeerId]?.hasFoundSource) {
            console.log('Réponse trouvée !', guesses[i]);
            break;
        }
    }
    
    if(!milestone.playerStatesByPeerId[selfPeerId]?.hasFoundSource)
        socket.emit("submitGuess", guesses[0].charAt(0));
}
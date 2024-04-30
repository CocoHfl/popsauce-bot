let startTime;
let endTime;
let imageDetected = false;
let textQuestionDetected = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

setInterval(async function () { 
    if(milestone?.challenge?.text === undefined) {
        textQuestionDetected = false;
    }

    if(milestone?.challenge?.text && !textQuestionDetected) {
        console.log('Question texte détectée !');
        textQuestionDetected = true;
        let answers = await callApi('askQuestion', milestone?.challenge?.text);
        answers.title.forEach(title => {
            console.log('title', title);
        });
        answers.descriptions.forEach(desc => {
            console.log('description',desc);
        });
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
            let results = await callApi('searchImage', base64data);

            for(let result of results) {
                let guess = result.trim().replace(/[^a-zA-Z ]/g, "").substring(0, 50);
                socket.emit("submitGuess", guess);

                await delay(100);

                if(milestone.playerStatesByPeerId[selfPeerId]?.hasFoundSource) {
                    console.log('Réponse trouvée !', guess);
                    break;
                }
            }

            if(!milestone.playerStatesByPeerId[selfPeerId]?.hasFoundSource)
                socket.emit("submitGuess", results[0].charAt(0));

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
        body: JSON.stringify({ "Data": body, "Language": rules.dictionaryId.value ?? 'en' }),
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
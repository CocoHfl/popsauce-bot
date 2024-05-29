# Pop Sauce Bot
Pop Sauce Bot is an automated script for the game PopSauce on [jklm.fun](https://jklm.fun).

This bot handles image and text-based questions, and automatically submits guesses in an attempt to find the correct answer.

**Disclaimer:**  This project is for educational purposes only.  
Please note that the usage of this bot may violate the terms of service of jklm.fun. Use it at your own risk.

## Setup
### Start NodeJS server
```
npm install
node app.js
```

### Inject client script into PopSauce lobby
1. Join a PopSauce lobby
2. Open Chrome console
3. Select the "popsauce" [execution context](https://developer.chrome.com/docs/devtools/console/reference#context) within the console
4. Paste the following code into the console:

    ```javascript
    fetch("https://raw.githubusercontent.com/coco13579/popsauce-bot/main/client.js")
        .then(response => response.text())
        .then(script => eval(script));
    ```

   Alternatively, you can manually copy the content of `client.js` from the repository and paste it into the console.


That's it! You're now ready to use Pop Sauce Bot.

### Commands list
- **guessTime:** Sets a delay (in milliseconds) for the bot to wait before submitting answers. Note that if the processing time prior to submitting exceeds this set time, the delay may not be respected.  
_Default value: 0_
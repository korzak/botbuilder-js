const mainState = require('./mainState');

const WEATHER_DIALOG = 'weatherDialog';
const QNA_DIALOG = 'qnaDialog';
const homeAutomationDialog = require('../homeAutomation/home-automation');
const weatherDialog = require('../weather/weather');
const QnADialog = require('../qnaDialog/qna');
const { DialogSet } = require('botbuilder-dialogs');
class MainDialog {
    constructor (convoState, userState) {
        this.state = new mainState(convoState);
        this.homeAutomationDialog = new homeAutomationDialog(convoState, userState);
    }
    async onTurn(context) {
        if (context.activity.type === 'message') {
            // hand this over to home automation dialog
            await this.homeAutomationDialog.onTurn(context);
        }
        else {
            await context.sendActivity(`[${context.activity.type} event detected]`);
        }
    }
}

module.exports = MainDialog;
const mainState = require('./mainState');

const WEATHER_DIALOG = 'weatherDialog';
const QNA_DIALOG = 'qnaDialog';
const homeAutomationDialog = require('../homeAutomation');
const weatherDialog = require('../weather');
const QnADialog = require('../qnaDialog');
const { DialogSet } = require('botbuilder-dialogs');
class MainDialog {
    constructor (convoState, userState, botConfig) {
        this.state = new mainState(convoState);
        this.homeAutomationDialog = new homeAutomationDialog(convoState, userState, botConfig);
        this.weatherDialog = new weatherDialog(convoState, userState, botConfig);
        this.qnaDialog = new QnADialog(botConfig);
    }
    async onTurn(context) {
        if (context.activity.type === 'message') {
            // hand this over to home automation dialog
            // await this.homeAutomationDialog.onTurn(context);
            // hand this over to weather dialog
            // await this.weatherDialog.onTurn(context);
            await this.qnaDialog.onTurn(context);
        }
        else {
            await context.sendActivity(`[${context.activity.type} event detected]`);
        }
    }
}

module.exports = MainDialog;
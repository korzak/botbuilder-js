

const DIALOG_STATE_PROPERTY = 'dialogState';
const HOME_AUTOMATION_PROPERTY = 'homeAutomation';
const WEATHER_PROPERTY = 'weather';
const QNA_PROPERTY = 'QnA';


class DispatcherState {
    /**
     * 
     * @param {object} state state instance - can be user or conversation state.
     */
    constructor(state) {
        if(!state || !state.createProperty) throw('Invalid state provided. Need either converesation or user state');

        // property accessors for the different dialogs
        this.homeAutomationProperty = state.createProperty(HOME_AUTOMATION_PROPERTY);
        //this.weatherProperty = state.createProperty(WEATHER_PROPERTY);
        //this.qnaProperty = state.createProperty(QNA_PROPERTY);
        // dialog state
        //this.dialogState = state.createProperty(DIALOG_STATE_PROPERTY);
    }

    // TODO: do we need getters and setters?
}

module.exports = DispatcherState;
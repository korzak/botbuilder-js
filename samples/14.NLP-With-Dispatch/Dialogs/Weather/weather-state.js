const WEATHER_STATE_PROPERTY = 'weather.state';

class WeatherState {
    /**
     * 
     * @param {object} convoState Conversation state
     * @param {object} userState User state 
     */
    constructor(convoState, userState) {
        if(!convoState || !convoState.createProperty) throw('Invalid conversation state provided.');
        if(!userState || !userState.createProperty) throw('Invalid user state provided.');

        // device property accessor for home automation scenario.
        this.weatherProperty = convoState.createProperty(WEATHER_STATE_PROPERTY);
        
    }
}

module.exports = WeatherState;
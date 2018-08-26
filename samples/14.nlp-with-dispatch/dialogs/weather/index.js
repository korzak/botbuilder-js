
const { LuisRecognizer } = require('botbuilder-ai');

// LUIS intent names. you can get this from the .lu file.
const GET_CONDITION_INTENT = 'Get_Weather_Condition';
const GET_FORECAST_INTENT = 'Get_Weather_Forecast';
const NONE_INTENT = 'None';

// LUIS entity names. 
const LOCATION_ENTITY = 'Location';
const LOCATION_PATTERNANY_ENTITY = 'Location_PatternAny';

// STATE
const WeatherState = require('./weather-state');

// this is the LUIS service type entry in the .bot file.
const WEATHER_LUIS_CONFIGURATION = 'weather-LUIS';

class Weather {
    /**
     * 
     * @param {Object} convoState conversation state
     * @param {Object} userState user state
     * @param {Object} botConfig bot configuration from .bot file
     */
    constructor(convoState, userState, botConfig) {
        if(!convoState) throw ('Need converstaion state');
        if(!userState) throw ('Need user state');
        if(!botConfig) throw ('Need bot config');

        // home automation state
        this.state = new WeatherState(convoState, userState);
        
        // add recogizers
        const luisConfig = botConfig.findServiceByNameOrId(WEATHER_LUIS_CONFIGURATION);
        this.luisRecognizer = new LuisRecognizer({
            applicationId: luisConfig.appId,
            azureRegion: luisConfig.region,
            // CAUTION: Its better to assign and use a subscription key instead of authoring key here.
            endpointKey: luisConfig.authoringKey
        });
    }
    /**
     * 
     * @param {Object} context context object
     */
    async onTurn(context) {
        // make call to LUIS recognizer to get home automation intent + entities
        const weatherResults = await this.luisRecognizer.recognize(context);
        const topWeatherIntent = LuisRecognizer.topIntent(weatherResults);
        // get location entity if available.
        const locationEntity = (LOCATION_ENTITY in weatherResults.entities)?weatherResults.entities[LOCATION_ENTITY][0] : undefined;
        const locationPatternAnyEntity = (LOCATION_PATTERNANY_ENTITY in weatherResults.entities)?weatherResults.entities[LOCATION_PATTERNANY_ENTITY][0]:undefined;
        // depending on intent, call turn on or turn off or return unknown
        switch(topWeatherIntent) {
            case GET_CONDITION_INTENT: 
                await context.sendActivity(`You asked for current weather condition in Location = ` + (locationEntity || locationPatternAnyEntity));
                break;
            case GET_FORECAST_INTENT: 
                await context.sendActivity(`You asked for weather forecast in Location = ` + (locationEntity || locationPatternAnyEntity));
                break;
            case NONE_INTENT:
            default:
                await context.sendActivity(`Weather dialog cannot fulfill this request. Bubbling up`);
                // this dialog cannot handle this specific utterance. bubble up to parent
        }
    }
};

module.exports = Weather;
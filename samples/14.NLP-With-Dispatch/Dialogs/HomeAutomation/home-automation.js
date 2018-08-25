const STATE_PROPERTY = "homeAutomation.State"
const TURN_OFF_DIALOG = 'Turn Off Device';
const TURN_ON_DIALOG = 'Turn On Device';
const HOME_AUTOMATION_INTENT = 'HomeAutomation';
const NONE = 'None';

const DEVICE_PROPERTY_ENTITY = 'deviceProperty';
const NUMBER_ENTITY = 'number';
const ROOM_ENTITY = 'Room';
const OPERATION_ENTITY = 'Opeartion';
const DEVICE_ENTITY = 'Device';

const { DialogSet, DialogTurnResult } = require('botbuilder-dialogs');
const { LuisRecognizer } = require('botbuilder-ai');
const HomeAutomationState = require('./home-automation-state');
// this is the LUIS service type entry in the .bot file.
const LUIS_CONFIGURATION = 'homeautomation-LUIS';
class homeAutomation {
    constructor(convoState, userState, botConfig) {
        if(!convoState) throw ('Need converstaion state');
        if(!userState) throw ('Need user state');
        if(!botConfig) throw ('Need bot config');

        // home automation state
        this.state = new HomeAutomationState(convoState, userState);
        
        // add recogizers
        const luisConfig = botConfig.findServiceByNameOrId(LUIS_CONFIGURATION);
        this.luisRecognizer = new LuisRecognizer({
            applicationId: luisConfig.appId,
            azureRegion: luisConfig.region,
            // CAUTION: Its better to assign and use a subscription key instead of authoring key here.
            endpointKey: luisConfig.authoringKey
        });
    }

    async onTurn(context) {
        // make call to LUIS recognizer to get home automation intent + entities
        const homeAutoResults = await this.luisRecognizer.recognize(context);
        const topHomeAutoIntent = LuisRecognizer.topIntent(homeAutoResults);
        
        // depending on intent, call turn on or turn off or return unknown
        switch(topHomeAutoIntent) {
            case HOME_AUTOMATION_INTENT: 
                await this.handleDeviceUpdate(this.state, homeAutoResults);
                break;
            case NONE:
            default:
                // this dialog cannot handle this specific utterance. bubble up to parent
        }
        
    }

    async handleDeviceUpdate(state, args) {
        const devices = findEntities(DEVICE_ENTITY, homeAutoResults.entities);
        const operations = findEntities(OPERATION_ENTITY, homeAutoResults.entities);
        const rooms = findEntities(ROOM_ENTITY, homeAutoResults.entities);
        const deviceProperties = findEntities(DEVICE_PROPERTY_ENTITY, homeAutoResults.entities);
        const numberProperties = findEntities(NUMBER_ENTITY, homeAutoResults.entities);

        const state = convoState.get(dialogContext.context);
        state.homeAutomationTurnOff = state.homeAutomationTurnOff ? state.homeAutomationTurnOff + 1 : 1;
        await dialogContext.context.sendActivity(`${state.homeAutomationTurnOff}: You reached the "HomeAutomation_TurnOff" dialog.`);
        if (devices) {
            await dialogContext.context.sendActivity(`Found these "HomeAutomation_Device" entities:\n${devices.join(', ')}`);
        }
        if (operations) {
            await dialogContext.context.sendActivity(`Found these "HomeAutomation_Operation" entities:\n${operations.join(', ')}`);
        }
        await dialogContext.end();
    }

    
};

module.exports = homeAutomation;

// Helper function to retrieve specific entities from LUIS results
function findEntities(entityName, entityResults) {
    let entities = []
    if (entityName in entityResults) {
        entityResults[entityName].forEach(entity => {
            entities.push(entity);
        });
    }
    return entities.length > 0 ? entities : undefined;
}
const DEVICE_PROPERTY = 'homeAutomation.Device';

class deviceState {
    constructor(device, room, deviceProperty, deviceState) { 
        this.deviceName = device?device:'';
        this.room = room?room:'';
        this.deviceProperty = deviceProperty?deviceProperty:'';
        this.deviceState = deviceState?deviceState:'';
    }
}

class HomeAutomationState {
    /**
     * 
     * @param {object} convoState Conversation state
     * @param {object} userState User state 
     */
    constructor(convoState, userState) {
        if(!convoState || !convoState.createProperty) throw('Invalid conversation state provided.');
        if(!userState || !userState.createProperty) throw('Invalid user state provided.');

        // property accessors for the different dialogs
        this.deviceProperty = convoState.createProperty(DEVICE_PROPERTY);
        
    }
    setDevice(device, room, deviceState, deviceProperty, context) {
        // get devices from state.
        const devices = await this.deviceProperty.get(context);
        if(devices === undefined) { 
            devices = [new deviceState(device, room, deviceProperty, deviceState)];
        } else {
            // see if we already have this device.
            let existingDevice = devices.find(device => device.deviceName == device);
            if(existingDevice === undefined) {
                devices = [new deviceState(device, room, deviceProperty, deviceState)];
            } else {
                // update device properties
                existingDevice.room = room === undefined?'':room;
                existingDevice.deviceProperty = deviceProperty === undefined?'':deviceProperty;
                existingDevice.context = context === undefined?'':context;
            }
        }
        return this.deviceProperty.set(context,devices);
    }
    getDevices(context) {
        const returnText = 'No devices configured';
        // read out of current devices from state
        const devices = await this.deviceProperty.get(context);
        if(devices === undefined) {
            return returnText;
        }
        returnText = '';
        devices.forEach((device, idx) => {
            returnText += '\n[' + idx + ']. ' + device.deviceName + 
                          device.room?' in room ' + device.room:'' + 
                          device.deviceState? ' is ' + device.deviceState: '' +
                          device.deviceProperty? ' device property = ' + device.deviceProperty:'';
        });
        return returnText;
    }
}

module.exports = HomeAutomationState;
const DEVICE_PROPERTY = 'homeAutomation.Device';

class DeviceState {
    /**
     * 
     * @param {*} device 
     * @param {*} room 
     * @param {*} deviceProperty 
     * @param {*} deviceState 
     */
    constructor(device, room, deviceProperty, deviceState) { 
        this.deviceName = device?device:'';
        this.room = room?room:'';
        this.deviceProperty = deviceProperty?deviceProperty:'';
        this.deviceState = deviceState?deviceState:'';
    }
};

class HomeAutomationState {
    /**
     * 
     * @param {object} convoState Conversation state
     * @param {object} userState User state 
     */
    constructor(convoState, userState) {
        if(!convoState || !convoState.createProperty) throw('Invalid conversation state provided.');
        if(!userState || !userState.createProperty) throw('Invalid user state provided.');

        // device property accessor for home automation scenario.
        this.deviceProperty = convoState.createProperty(DEVICE_PROPERTY);
        
    }
    async setDevice(device, room, deviceState, deviceProperty, context) {
        // get devices from state.
        let devices = await this.deviceProperty.get(context);
        if(devices === undefined) { 
            devices = new Array(new DeviceState(device, room, deviceProperty, deviceState));
        } else {
            // see if we already have this device.
            let existingDevice = devices.find(device => ((device.deviceName == device) || 
                                                         (device.room == room) || 
                                                         (device.deviceProperty == device.deviceProperty)
                                                        ));
            if(existingDevice === undefined) {
                devices = devices.push(new DeviceState(device, room, deviceProperty, deviceState));
            } else {
                // update device properties
                existingDevice.room = room === undefined?'':room;
                existingDevice.deviceProperty = deviceProperty === undefined?'':deviceProperty;
                existingDevice.deviceState = deviceState === undefined?'off':deviceState;
            }
        }
        return this.deviceProperty.set(context,devices);
    }
    async getDevices(context) {
        let returnText = 'No devices configured';
        // read out of current devices from state
        const devices = await this.deviceProperty.get(context);
        if(devices === undefined) {
            return returnText;
        }
        returnText = '';
        devices.forEach((device, idx) => {
            returnText += '\n[' + idx + ']. ' + 
                          (device.deviceName?device.deviceName:'Unknown device') + 
                          (device.room?' in room = ' + device.room:'') + 
                          (device.deviceState? ' is ' + device.deviceState: '') +
                          (device.deviceProperty? ' device property = ' + device.deviceProperty:'');
        });
        return returnText;
    }
}

module.exports = HomeAutomationState;
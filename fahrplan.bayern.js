const AbstractEFAProvider = require('./provider.defas').AbstractEFAProvider

class BayernFahrplan extends AbstractEFAProvider {
    constructor () {
        super()
        this.XML_STOPFINDER_REQUEST = 'https://mobile.defas-fgi.de/beg/XML_STOPFINDER_REQUEST'
        this.XML_TRIP_REQUEST2 = 'https://mobile.defas-fgi.de/beg/XML_TRIP_REQUEST2'
    }
}
module.exports = BayernFahrplan
const AbstractHafasProvider = require('./provider.hafas').AbstractHafasProvider

class RheinMainVerkehrsbund extends AbstractHafasProvider {
    constructor (accessId) {
        super(accessId)
        this.location_name = 'https://www.rmv.de/hapi/location.name'
    }
}
module.exports = RheinMainVerkehrsbund
/*

let rmvProvider = new RheinMainVerkehrsbund('43152f3c-9a0c-4c43-af6c-76fb04186c95')
rmvProvider.stopFinder()
.setQuery('Auer Straße 97209')
.exec()
.done(($trip) => {
    console.log(JSON.stringify($trip, null, '  '))
})
*/

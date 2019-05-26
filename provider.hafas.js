'use strict'
// ! HAFAS PROVIDER FÜR RHEIN MAIN VERKEHRSBUND (GOOD SHIT!!!)

// Inoffizielle API für defas-fgi
const requestPromise = require('request-promise')
const fs = require('fs')
const moment = require('moment')

class AbstractHafasProvider {
    constructor (accessId) {
        this.accessId = accessId

        this.location_name = 'location.name'

        this.proxy = false
    }
    setProxy (proxyURL) {
        this.proxy = proxyURL
    }
    request (url, qs) {
        qs.accessId = this.accessId
        qs.format = 'json'

        return requestPromise({
            url: url,
            qs: qs,
            proxy: this.proxy,
        })
        .then((data) => JSON.parse(data))
    }

    stopFinder () {
        return (new HAFAS_StopfinderRequest(this))
    }
}
class HAFAS_Location {
    constructor () {
    }
    // Mathematische, überflüssige, uninteressante Eigenschaften
    fromKeyObject ($key, $station) {
        console.log($station)
        this.$station_type = $key
        this.$station_data = $station

        switch (this.$station_type) {
            case 'StopLocation':
                this.name = this.$station_data.name
            break;
        }
        this.type = $station.ty[0]
        console.log(JSON.stringify($station, null, '\t'))
        switch (this.type) {
            case 'stop':
            break
            case 'street':
                if ($station.postCode)
                    this.postCode = $station.postCode
            break
        }
        if ($station.r[0].id)
            this.id = $station.r[0].id[0]
        if ($station.r[0].gid)
            this.gid = $station.r[0].gid[0]
        if ($station.r[0].omc)
            this.omc = $station.r[0].omc[0]
        if ($station.r[0].stateless)
            this.stateless = $station.r[0].stateless[0]
        if ($station.r[0].pc)
            this.pc = $station.r[0].pc[0]
        return this
    }
}
class HAFAS_StopfinderRequest {
    constructor (hafasBase) {
        this.hafasBase = hafasBase
        this.query = ''
        this.queryType = 'any'
    }

    setQuery (query) {
        this.query = query
        return this
    }
    setType (type) {
        this.queryType = type
        return this
    }

    exec () {
        
        //  Type filter for location types:
        //  ALL:  search in all existing location pools
        //  S: Search for stations only
        //  A: Search for addresses only
        //  P: Search for POI’s only
        //  SA: Search for stations and addresses
        //  SP: search for stations and POIs
        //  AP: search for addresses and pois
        
        return this.hafasBase.request(this.hafasBase.location_name, {
            input: this.query,
            type: {
                'any': 'ALL',
                'stop': 'S',
                'poi': 'P',
                'street': 'A',
            }[ this.queryType ] || this.queryType,
        })
        .then(($json) => {
            console.log($json)
            if (!$json.hasOwnProperty('stopLocationOrCoordLocation')) {
                throw 'WTF 420'
            }
            return $json.stopLocationOrCoordLocation.map(($station, $index) => {
                let $key = Object.keys($json.stopLocationOrCoordLocation)[ $index ]
                return new HAFAS_Location().fromKeyObject($key, $station)
            })
        })
    }
}

module.exports = {
    AbstractHafasProvider: AbstractHafasProvider,
    HAFAS_Location: HAFAS_Location,
    HAFAS_StopfinderRequest: HAFAS_StopfinderRequest,
}
'use strict'
// Inoffizielle API für defas-fgi
const requestPromise = require('request-promise')
const fs = require('fs')
const moment = require('moment')
const parseString = require('xml2js').parseString

class AbstractEFAProvider {
    constructor () {
        this.XML_STOPFINDER_REQUEST = 'XML_STOPFINDER_REQUEST'
        this.XML_TRIP_REQUEST2 = 'XML_TRIP_REQUEST2'
        this.proxy = false
    }
    setProxy (proxyURL) {
        this.proxy = proxyURL
    }
    request (url, qs) {
        return requestPromise({
            url: url,
            qs: qs,
            proxy: this.proxy,
            /*headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
            },*/
        })
    }
    requestXML (url, qs) {
        return requestPromise({
            url: url,
            qs: qs,
            proxy: this.proxy
        })
        .then((xml) => {
            return new Promise(function (success, reject) {
                parseString(xml, function (err, res) {
                    if (err)
                        reject(err)
                    else
                        success(res)
                })
            })
        })
    }

    stopFinder () {
        return (new EFA_StopfinderRequest(this))
    }
    tripRequest () {
        return (new EFA_TripRequest(this))
    }
}
class EFA_Location {    
    constructor () {
        /*if (arguments.length === 3) {
            this.fromValues(arguments[0], arguments[1], arguments[2])
        }
        if (arguments.length === 1 && typeof(arguments[0]) === 'object')
            this.fromObject(arguments[0])
        if (arguments.length === 2 && typeof(arguments[0]) === 'string')
            this.fromStateless(arguments[0], arguments[2])*/
    }
    fromObject ($station) {
        this.name = $station.n[0]
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
    fromValues (name, type, gid) {
        this.name = name
        this.type = type
        this.gid = gid
        return this
    }
    fromStateless (stateless, type) {
        this.name = stateless
        this.stateless = stateless
        this.type = type
        return this
    }
}
class EFA_StopfinderRequest {
    constructor (efaBase) {
        this.efaBase = efaBase
        this.query = ''
        this.queryType = false
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
        return this.efaBase.requestXML(this.efaBase.XML_STOPFINDER_REQUEST, {
            language: 'de',
            coordOutputFormat: 'WGS84',
            locationServerActive: 1,
            stateless: 1,
            
            anyMaxSizeHitList: 20,
            name_sf: this.query,
            type_sf: this.queryType || 'any',

            odvSortingMacro: 'beg',
        })
        .then(($xml) => {
            if (!$xml.efa.sf[0].p) {
                throw $xml
            }
            return $xml.efa.sf[0].p.map(($station) => {
                return new EFA_Location().fromObject($station)
            }).filter(($station) => {
                return this.queryType ? this.queryType == $station.type : true
            })
        })
    }
    execAlt () {
        return this.efaBase.request('https://www.bayern-fahrplan.de/autosuggest',{
            anyObjFilter_sf: 0,
            odvSortingMacro: 'beg',
            locationServerActive: 1,
            outputFormat: 'JSON',

            anyMaxSizeHitList: 20,

            name_sf: this.query,
            type_sf: this.queryType || 'any',
            // trans_company: 'wvv',
        })
        .then((res) => {
            let data = JSON.parse(res)
            console.log(JSON.stringify(data, null , '\t'))
            if (!data.stopFinder) 
                throw data.err
            if (data.stopFinder.points && data.stopFinder.points.point && (this.queryType == false || (this.queryType && data.stopFinder.points.point.anyType === this.queryType))) {
                return [ data.stopFinder.points.point ]
            }
            return data.stopFinder.points.filter(
                (point) => {
                    return this.queryType == false || point.anyType === 'stop'
                }).map(
                    (point) => {
                        return new EFA_Location().fromObject({
                            n: [ point.name ],
                            ty: [ point.anyType || point.type ],
                            r: [{
                                stateless: point.stateless ? [ point.stateless ] : undefined,
                                id: (point.ref && point.ref.id)  ? [ point.ref.id ] : undefined,
                                gid: (point.ref && point.ref.gid)  ? [ point.ref.gid ] : undefined,
                                omc: (point.ref && point.ref.omc)  ? [ point.ref.omc ] : undefined,
                            }],
                        })
                    }
                )
        })
    }
}
const EFA_RouteType = {
    LEAST_DURATION: 'LEASTTIME',
    LEAST_CHANGES: 'LEASTINTERCHANGE',
    LEAST_WALKING: 'LEASTWALKING',
}
class EFA_TripRequest {
    constructor (efaBase) {
        this.efaBase = efaBase

        this.queryTime = moment()
        this.queryDepature = true
        this.numberOfTrips = 6
        this.routeType = false
    }

    setOrigin (origin) {
        this.origin = origin
        return this
    }
    setDestination (destination) {
        this.destination = destination
        return this
    }

    setTime (time) {
        this.queryTime = time
        return this
    }

    arrivial () {
        this.queryDepature = false
        return this
    }
    departure () {
        this.queryDepature = true
        return this
    }

    numberOfTrips (numberOfTrips) {
        this.numberOfTrips = numberOfTrips
        return this
    }

    routeType (routeType) {
        this.routeType = routeType
        return this
    }
    exec () {
        const query = {
            language: 'de',
            sessionID: 0,
            requestID: 0,
            coordListOutputFormat: 'STRING',
            coordOutputFormat: 'WGS84',
            coordOutputFormatTail: 0,

            useRealtime: 1,
            locationServerActive: 1,

            calcOneDirection: 1,
            calcNumberOfTrips: this.numberOfTrips,

            // ! abfahrt oder ankunft
            itdTripDateTimeDepArr: this.queryDepature ? 'dep' : 'arr',

            itdTime: this.queryTime.format('HHmm'),
            itdDate: this.queryTime.format('YYYYMMDD'),

            name_origin: this.origin.name,
            type_origin: this.origin.type,

            name_destination: this.destination.name,
            type_destination: this.destination.type,

            ptOptionsActive: 1, // enable public transport options
            itOptionsActive: 1, // enable individual transport options

            changeSpeed: 'normal',

            //lineRestriction: 400,
            useProxFootSearch: false,
            excludedMeans: 'checkbox',
            trITMOTvalue100: 10,
            imparedOptionsActive: 1,
            //mobileAppTripMacro: true,
        }
        if (!!this.routeType)
            query.routeType = this.routeType

        return this.efaBase.requestXML(this.efaBase.XML_TRIP_REQUEST2, query)
        /*.then(($xml) => {
            console.log('request sent')
            return new Promise((success, reject) => {
                fs.writeFile('trip.request.json', JSON.stringify($xml, null, '  '),
                (err) => {
                    if (err)
                        reject()
                    else
                        success($xml)
                })
            })
        })*/
        .then(($xml) => {
            if ($xml.efa.ers) {
                throw JSON.stringify($xml.efa.ers, null, '  ')
            }
            if (!$xml.efa.ts[0].tp) {
                throw JSON.stringify($xml, null, '  ')
            }
            return {
                trips: $xml.efa.ts[0].tp.map(($trip) => {
                    // console.log($trip)
                    return {
                        duration: $trip.d[0],
                        details: $trip.ls[0].l.map(($detail) => {
                            const detail = {
                                start: $detail.ps[0].p[0].de[0],
                                ende: $detail.interchange ? $detail.interchange[0].de[0] : $detail.ps[0].p[1].de[0],
        
                                transportInfo: (($publicTransportInfo) => {
                                    const pti = {
                                        type: parseInt($publicTransportInfo.ty[0]),
                                    }
                                    pti.id = pti.type + 0
                                    switch (pti.type) {
                                        case 3:
                                            pti.type = 'Bus'
                                            pti.name = $publicTransportInfo.n[0]
                                            pti.linie = $publicTransportInfo.nu[0]
                                            pti.richtung = $publicTransportInfo.des[0]
                                            pti.desc = $publicTransportInfo.routeDesc[0]
                                        break;
                                        case 6:
                                            pti.type = 'Zug'
                                            pti.name = $publicTransportInfo.n[0]
                                            pti.linie = $publicTransportInfo.nu[0]
                                            pti.tco = $publicTransportInfo.tco[0]
                                            pti.trainType = $publicTransportInfo.trainType[0]
                                        break;
                                        case 99:
                                        case 100:
                                            pti.type = 'Fussweg'
                                        break;
                                        default:
                                            console.log($publicTransportInfo)
                                        break;
                                    }
                                    return pti
                                })($detail.m[0]),
        
                                gid: $detail.ps[0].p[0].gid[0],
                            }
                            if ($detail.pss && $detail.pss[0])
                                detail.stops = $detail.pss[0].s.map(($stop) => {
                                    let stopData = $stop.split(';')
                                    return {
                                        stateless: stopData[0],
                                        name: stopData[1],
                                        D1: stopData[2],
                                        T1: stopData[3],
                                        D2: stopData[8],
                                        T2: stopData[9],
                                    }
                                })
                            
                            return detail
                        }),
                    }
                })
            }
        })
    }
}


module.exports = {
    AbstractEFAProvider: AbstractEFAProvider,
    EFA_Location: EFA_Location,
    EFA_StopfinderRequest: EFA_StopfinderRequest,
    EFA_RouteType: EFA_RouteType,
    EFA_TripRequest: EFA_TripRequest,
}

/* 
WürzburgHbf = 'de:09663:177',
LangenauWürtt = 'de:08425:2102'*/
/*
const fahrplan = new BayernFahrplan()
fahrplan.setProxy('http://10.10.50.1:3128')

const $tripRequest = fahrplan.tripRequest()
$tripRequest.setTime(moment()) // '2018-07-13 12:30'

// Würzburg, Mainfranken Theater
fahrplan.stopFinder().setQuery('Würzburg Rathaus')
.execAlt()
.then(($origin) => {
    $tripRequest.setOrigin($origin[0])

    return fahrplan.stopFinder().setQuery('Würzburg Hbf')
    .execAlt()
})
.then(($destination) => {
    $tripRequest.setDestination($destination[0])
    console.log($tripRequest.origin, $tripRequest.destination)
    return $tripRequest.exec()
})
.done(($trip) => {
    console.log(JSON.stringify($trip, null, '  '))
})


/*
const   WürzburgHbf = 'de:09663:177',
        LangenauWürtt = 'de:08425:2102',
        Wann = moment('2018-07-13 12:30')
// !!!!
//.catch(console.error)
.done(($trip) => {
    console.log(JSON.stringify($trip, null, '  '))
})

*/
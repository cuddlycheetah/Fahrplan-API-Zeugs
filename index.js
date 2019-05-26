const express = require('express')
const moment = require('moment')
const app = express()
const router = express.Router()

const $DefasProvider = require('./provider.defas')
const $BayernFahrplan = require('./fahrplan.bayern')
const $RMVFahrplan = require('./fahrplan.rmv')

const BayernFahrplan = new $BayernFahrplan()

router.get('/', (req, res) => {
  res.json('Hello World!')
})
router.get('/stopfinder/:type/:query', (req, res) => {
  return BayernFahrplan
  .stopFinder()
  .setType(req.params.type == 'any' ? false : req.params.type)
  .setQuery(req.params.query).exec()
  .then((results) => {
    res.json(results)
  })
  .catch((err) => res.status(500).json({error: err}))
})
router.get('/trip/text/:time/:origin/:destination', (req, res) => {
  const tripRequest = BayernFahrplan.tripRequest()
  BayernFahrplan.stopFinder()
  .setQuery(req.params.origin).exec()
  .then((origins) => {
    tripRequest.setOrigin( origins[0] )
    return BayernFahrplan.stopFinder()
    .setQuery(req.params.destination).exec()
  })
  .then((destinations) => {
    tripRequest.setDestination(destinations[0])
    return tripRequest.setTime(
      moment(req.params.time, ["HH:mm MM.DD.YYYY", "HH:mm"])
    ).exec()
  })
  .then((trip) => {
    res.json(trip)
  })
  .catch((err) => res.status(500).json({error: err}))
})
router.get('/trip/stateless/:time/:originStateless/:originType/:destStateless/:destType', (req, res) => {
  BayernFahrplan.tripRequest()
  .setOrigin(
    new $DefasProvider.EFA_Location().fromStateless(req.params.originStateless, req.params.originType)
  )
  .setDestination(
    new $DefasProvider.EFA_Location().fromStateless(req.params.destStateless, req.params.destType)
  )
  .setTime(
    moment(req.params.time, ["HH:mm MM.DD.YYYY", "HH:mm"])
  )
  .exec()
  .then((trip) => {
    return res.json(trip)
  })
  .catch((err) => res.status(500).json({error: err}))
})


app.use('/fahrplan', router)

app.listen(1200, () => {
  console.log('Fahrplan API läuft')
})

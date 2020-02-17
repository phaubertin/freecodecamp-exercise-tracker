const defaults = {
    PORT : 3000
};

const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const tracker = require('./tracker');

/* Load environment variable from .env file. */
dotenv.config();

/* Create Express application. */
const app = express()

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

app.use(express.static('public'))

app.get('/', tracker.sendIndex);

app.use('/api', tracker.apiErrorHandler);

app.use(tracker.errorHandler);

const listener = app.listen(process.env.PORT || defaults.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

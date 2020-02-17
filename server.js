const defaults = {
    PORT : 3000
};

const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const tracker = require('./tracker');

/* Load environment variable from .env file. */
dotenv.config();

/* Create Express application. */
const app = express()

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.use('/api', tracker.apiErrorHandler);
app.use(tracker.errorHandler);

const listener = app.listen(process.env.PORT || defaults.PORT, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

const bodyParser = require('body-parser');
const express = require('express');
const model = require('./model-mongoose');

const RE_USERNAME = /^[a-z][a-z0-9_-]{0,64}$/;

const RE_DATE = /^[1-2][0-9]{3}-[0-9]{2}-[0-9]{2}$/;

const RE_NONZERO_INTEGER = /^[1-9][0-9]{0,5}$/;

class TrackerError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "TrackerError";
    this.status = status;
  }
}
    
let router = express.Router();

router.use(bodyParser.urlencoded({extended: false}))

router.use(bodyParser.json())

function cleanUser(doc) {
    return {
        _id         : doc._id,
        username    : doc.name
    }
}

router.post('/new-user', function(req, res, next) {
    let username = req.body.username;
    
    if(username === undefined) {
        throw new TrackerError(400, 'No user name specified');
    }
    else if((typeof username != 'string') || ! username.match(RE_USERNAME)) {
        throw new TrackerError(400, 'User name is invalid');
    }
    else {
        /* User de-duplication: if a user with this name already exists, return the
         * existing name instead of creating a new one.
         * 
         * Note that there is a race condition here: the lookup then create is not
         * atomic, so the user might be created by another client between both
         * operations. Because of this, we might still end up with two users with
         * the same name. We will live with it for this project. */
        model.getUserByName(username, function(err, doc) {
            if(err) {
                next(err);
            }
            else if(doc) {
                res.json(cleanUser(doc));
            }
            else {
                /* User does not exist. Let's create it. */
                model.createUser(username, function(err, doc) {
                    if(err) {
                        next(err);
                    }
                    else {
                        res.json(cleanUser(doc));
                    }
                });
            }
        });
    }
});

router.get('/users', function(req, res, next) {
    model.getAllUsers(function(err, docs) {
        if(err) {
            next(err);
        }
        else {
            res.json(docs.map(cleanUser));
        }
    });
});

function cleanLogItem(doc, keepId) {
    let item = {
        description : doc.description,
        duration : doc.duration
    }
    
    if(doc.date) {
        /* Keep only the first 4 space-separated fields of the date string. The
         * rest is the time part of it. */
        item.date = doc.date.toString().split(' ').slice(0, 4).join(' ');
    }
    
    if(keepId) {
        item._id = doc._id;
    }
    
    return item;
}

function checkUserId(args) {
    let userId = args.userId;
    
    if(! userId) {
        /* A mixed case query argument is unusual and it is the only one in this
         * API. Let's accept both cases for the I. */
        userId = args.userid;
        
        if(! userId) {
            throw new TrackerError(400, "Invalid 'userId' query argument");
        }
    }
    
    return userId;
}

function checkInteger(integerString, argName) {
    let fail = function() {
        throw new TrackerError(400, "Invalid '" + argName + "' argument");
    }
    
    if(! integerString) {
        /* Optional argument - this is not a failure. */
        return undefined;
    }
    else if(typeof integerString !== 'string' || ! integerString.match(RE_NONZERO_INTEGER)) {
        fail();
    }
    else {
        let value = parseInt(integerString);
        
        if(isNaN(value)) {
            fail();
        }
        else {
            return value;
        }
    }
}

function checkDate(dateString, argName) {
    let fail = function() {
        throw new TrackerError(400, "Invalid '" + argname + "' argument");
    }
    
    if(! dateString) {
        /* Optional argument - this is not a failure. */
        return undefined;
    }
    else if(typeof dateString !== 'string' || ! dateString.match(RE_DATE)) {
        fail();
    }
    else {
        let date = new Date(dateString);
        
        if(isNaN(date.getTime())) {
            fail();
        }
        else {
            return date;
        }
    }
}

router.post('/add', function(req, res, next) {
    let userId      = checkUserId(req.body);
    let duration    = checkInteger(req.body.duration, 'duration');
    let description = req.body.description;
    let date        = checkDate(req.body.date, 'date');
    
    /* Required arguments. */
    if(! duration) {
        throw new TrackerError(400, "Missing 'duration' argument");
    }
    
    if(! description) {
        throw new TrackerError(400, "Missing 'description' argument");
    }
    
    model.getUserById(userId, function(err, doc) {
        if(err) {
            next(err);
        }
        else if(! doc) {
            throw new TrackerError(400, "No such user ID");
        }
        else {
            model.addLogItem(userId, description, duration, date, function(err, doc) {
                if(err) {
                    next(err)
                }
                else {
                    res.json(cleanLogItem(doc, true));
                }
            });
        }
    });
});

router.get('/log', function(req, res, next) {
    let userId  = checkUserId(req.query);
    let from    = checkDate(req.query.from, 'from');
    let to      = checkDate(req.query.to, 'to');
    let limit   = checkInteger(req.query.limit, 'limit');
    
    model.getUserById(userId, function(err, doc) {
        if(err) {
            next(err);
        }
        else if(! doc) {
            throw new TrackerError(400, "No such user ID");
        }
        else {
            let retval = cleanUser(doc);
            
            model.getLogItems(userId, from, to, limit, function(err, docs) {
                if(err) {
                    next(err);
                }
                else {
                    retval.count = docs.length;
                    retval.log = docs.map(function(x) {
                        return cleanLogItem(x, false);
                    });
                    
                    res.json(retval);
                }
            });
        }
    });
});

/* This is a stack of two middleware functions. */
let apiErrorHandler = [
    /* If a response has not been sent yet, set not found error. */
    catchNotFound,
    /* Error handling function: send a JSON (API) response with an error member
     * that contains the error message. */
    function(err, req, res, next) {
        let {status, message} = getErrorStatusAndMessage(err);
        res.status(status).json({
            error : message
        });
    }];
    
module.exports.apiErrorHandler = apiErrorHandler;

router.use(apiErrorHandler);

module.exports.api = router;

function sendIndex(req, res) {
    res.sendFile(__dirname + '/views/index.html')
}

module.exports.sendIndex = sendIndex;

/* Process error to decide on HTTP status and message. */
function getErrorStatusAndMessage(err) {
    if(err.errors) {
        /* This is a mongoose validation error.
         * 
         * Report the first validation error. */
        const keys = Object.keys(err.errors)
        return new TrackerError(400, err.errors[keys[0]].message);
    }
    else {
        let status, message;
        
        if(err.status) {
            status = err.status;
        }
        else {
            status = 500;
        }
        
        if(err.message) {
            return new TrackerError(status, err.message);
        }
        else {
            switch(status) {
            case 400:
                return new TrackerError(status, 'Bad request');
            case 404:
                return new TrackerError(status, 'Not found');
            default:
                return new TrackerError(status, 'Server error');
            }
        }
    }
}

function catchNotFound(req, res, next) {
    next({status : 404});
}

module.exports.catchNotFound = catchNotFound;

/* Stack of two middleware functions as apiErrorHandler above, but this one
 * sends an HTML error document instead of an API response. */
module.exports.errorHandler = [
    catchNotFound,
    function(err, req, res, next) {
        let {status, message} = getErrorStatusAndMessage(err);
        
        /* Try to send an HTML that has the HTTP status code in the name (e.g. 404.html). */
        res.status(status).sendFile(__dirname + '/views/' + status + '.html', function(err) {
            /* If that fails, send the HTML document for 500 Internal Server Error instead. */
            if(err) {
                res.sendFile(__dirname + '/views/500.html', function(err) {
                    /* If all else fails, send a plain text error message. */
                    if(err) {
                        res.type('text/plain').send('Error ('+ status + '): ' + message);
                    }
                });
            }
        });
    }];

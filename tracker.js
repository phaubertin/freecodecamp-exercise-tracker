function sendIndex(req, res) {
    res.sendFile(__dirname + '/views/index.html')
}

module.exports.sendIndex = sendIndex;

/* Extract error HTTP status and message from error object. */
function getErrorStatusAndMessage(err) {
    let errorStatusAndMessage = function(status, message) {
        return {
            status : status,
            message : message
        }
    }
    
    if(err.errors) {
        /* This is a mongoose validation error.
         * 
         * Report the first validation error. */
        const keys = Object.keys(err.errors)
        return errorStatusAndMessage(400, err.errors[keys[0]].message);
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
            return errorStatusAndMessage(status, err.message);
        }
        else {
            switch(status) {
            case 400:
                return errorStatusAndMessage(status, 'Bad request');
            case 404:
                return errorStatusAndMessage(status, 'Not found');
            default:
                return errorStatusAndMessage(status, 'Server error');
            }
        }
    }
}

function catchNotFound(req, res, next) {
    next({status : 404});
}

module.exports.catchNotFound = catchNotFound;

/* This is a stack of two middleware functions. */
module.exports.apiErrorHandler = [
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

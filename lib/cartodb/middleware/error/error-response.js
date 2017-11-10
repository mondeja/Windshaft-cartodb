const _ = require('underscore');

module.exports = function errorResponse (/* options */) {
    return function errorResponseMiddleware (errors, req, res) {
        var errorResponseBody = {
            errors: errors.map(errorMessage),
            errors_with_context: errors.map(errorMessageWithContext)
        };

        if (req.query && req.query.callback) {
            res.jsonp(errorResponseBody);
        } else {
            res.json(errorResponseBody);
        }
    };
};


function errorMessage(err) {
    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
    var message = (_.isString(err) ? err : err.message) || 'Unknown error';

    return stripConnectionInfo(message);
}

//module.exports.errorMessage = errorMessage;

function stripConnectionInfo(message) {
    // Strip connection info, if any
    return message
        // See https://github.com/CartoDB/Windshaft/issues/173
        .replace(/Connection string: '[^']*'\n\s/im, '')
        // See https://travis-ci.org/CartoDB/Windshaft/jobs/20703062#L1644
        .replace(/is the server.*encountered/im, 'encountered');
}

var ERROR_INFO_TO_EXPOSE = {
    message: true,
    layer: true,
    type: true,
    analysis: true,
    subtype: true
};

function shouldBeExposed (prop) {
    return !!ERROR_INFO_TO_EXPOSE[prop];
}

function errorMessageWithContext(err) {
    // See https://github.com/Vizzuality/Windshaft-cartodb/issues/68
    var message = (_.isString(err) ? err : err.message) || 'Unknown error';

    var error = {
        type: err.type || 'unknown',
        message: stripConnectionInfo(message),
    };

    for (var prop in err) {
        // type & message are properties from Error's prototype and will be skipped
        if (err.hasOwnProperty(prop) && shouldBeExposed(prop)) {
            error[prop] = err[prop];
        }
    }

    return error;
}
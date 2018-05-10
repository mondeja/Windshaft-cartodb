var step = require('step');

/**
 *
 * @param metadataBackend
 * @param options
 * @constructor
 * @type {UserLimitsBackend}
 */
function UserLimitsBackend(metadataBackend, options) {
    this.metadataBackend = metadataBackend;
    this.options = options || {};
    this.options.limits = this.options.limits || {};

    this.preprareRateLimit();
}

module.exports = UserLimitsBackend;

UserLimitsBackend.prototype.getRenderLimits = function (username, apiKey, callback) {
    var self = this;

    var limits = {
        cacheOnTimeout: self.options.limits.cacheOnTimeout || false,
        render: self.options.limits.render || 0
    };

    self.getTimeoutRenderLimit(username, apiKey, function (err, timeoutRenderLimit) {
        if (err) {
            return callback(err);
        }

        if (timeoutRenderLimit && timeoutRenderLimit.render) {
            if (Number.isFinite(timeoutRenderLimit.render)) {
                limits.render = timeoutRenderLimit.render;
            }
        }

        return callback(null, limits);
    });
};

UserLimitsBackend.prototype.getTimeoutRenderLimit = function (username, apiKey, callback) {
    var self = this;

    step(
        function isAuthorized() {
            var next = this;

            if (!apiKey) {
                return next(null, false);
            }

            self.metadataBackend.getUserMapKey(username, function (err, userApiKey) {
                if (err) {
                    return next(err);
                }

                return next(null, userApiKey === apiKey);
            });
        },
        function getUserTimeoutRenderLimits(err, authorized) {
            var next = this;

            if (err) {
                return next(err);
            }

            self.metadataBackend.getUserTimeoutRenderLimits(username, function (err, timeoutRenderLimit) {
                if (err) {
                    return next(err);
                }

                next(null, {
                    render: authorized ? timeoutRenderLimit.render : timeoutRenderLimit.renderPublic
                });
            });
        },
        callback
    );
};

UserLimitsBackend.prototype.preprareRateLimit = function () {
    if (this.options.limits.rateLimitsEnabled) {
        this.metadataBackend.loadRateLimitsScript();
    }
};

UserLimitsBackend.prototype.getRateLimit = function (user, endpointGroup, callback) {
    this.metadataBackend.getRateLimit(user, 'maps', endpointGroup, callback);
};
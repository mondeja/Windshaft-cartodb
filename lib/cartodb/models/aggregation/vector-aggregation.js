const BaseAggregation = require('./base-aggregation');
const aggregationTemplate = require('./aggregation-templates');

module.exports = class VectorAggregation extends BaseAggregation {
    constructor () {
        super(...arguments);
    }
    sql () {
        return aggregationTemplate(this)({
            sourceQuery: this.query,
            res: this.resolution,
            columns: this.columns
        });
    }
};
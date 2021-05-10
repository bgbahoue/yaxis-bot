// =======================================================================
// CONSTRUCTOR
// =======================================================================
module.exports = function(parent) {
    return {

        // =======================================================================
        // PUBLIC METHODS
        // =======================================================================
        tokentx(obj) {
            const module = 'account';
            const action = 'tokentx';

            const address = obj.address;
            const startblock = obj.startblock | 0;
            const endblock = obj.endblock | 'latest';
            const page = obj.page | 1;
            const offset = obj.offset | 100;
            const sort = obj.sort | 'asc';

            var queryObject = {
                module, action, address, startblock, endblock, page, offset, sort
            };

            if (obj.ontractaddress) {
                queryObject.contractaddress = contractaddress;
            }

            return parent.getRequest(queryObject);
        }
    }
}
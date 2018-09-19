var bitquery = require('../index')
var bql = {
  request: {
    find: {}, limit: 5
  }
};
(async function() {
  let db = await bitquery.init()
  let response = await db.read(bql)
  console.log("Response = ", response)
  db.exit()
})();

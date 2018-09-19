var bitquery = require('../index')
var bql = {
  request: {
    find: {}, limit: 5
  }
}
bitquery.init().then(function(db) {
  db.read(bql).then(function(response) {
    console.log("Response = ", response)
    db.exit()
  })
})

const bitquery = require('../index')
const bql1 = {
  request: {
    find: {}, limit: 3
  }
};
const bql2 = {
  request: {
    find: {
      $text: {
        $search: "hello"
      }
    },
    limit: 3
  }
};
(async function() {
  let db1 = await bitquery.init({
    url: "mongodb://localhost:27017"
  })
  let db2 = await bitquery.init({
    url: "mongodb://localhost:27017"
  })
  db1.read(bql1).then(function(response) {
    console.log("# Query = ", bql1)
    console.log("# Response from db1= ", JSON.stringify(response, null, 2))
  })
  db2.read(bql2).then(function(response) {
    console.log("# Query = ", bql2)
    console.log("# Response from db2= ", JSON.stringify(response, null, 2))
  })
})();
